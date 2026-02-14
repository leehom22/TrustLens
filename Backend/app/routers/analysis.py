import os
import uuid
import tempfile
import asyncio
import mimetypes
import shutil
import requests
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Request, File, UploadFile
from app.models.files import FilesSchema
from dotenv import load_dotenv

# --- Load Env Vars ---
# This block ensures we find the .env file whether running from root or /app
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()


# ------- Import internal modules ------
from ..core.auth import get_current_user
from ..core.config import Config
from ..core.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, EVIDENCE_DIR, DOC_RISK_PROFILES
from ..utils.schemas import FinalReport, LayerStatus, LayerResult
from ..services.layer1 import run_layer_1_metadata
from ..services.layer2 import run_layer_2_ela
from ..services.layer3 import run_layer_3_extraction
from ..services.layer4 import run_layer_4_logic
from ..services.layer0 import run_layer_0_judge

# ------ Import for AI and DB connection ---------
from ..services.agent import run_agent_analysis
from ..utils.schemas import FinalReport, AnalysisRecord
from ..core.firebase import db

analysis_router = APIRouter()

async def analyze_pipeline(
    doc_id: str, 
    req_id: str,
    user_id: str, 
    file_name: str, 
    original_mime_type: str, 
    local_path_override: str = None,
    file_url: str = None
) -> AnalysisRecord:    
        

    temp_path = local_path_override
    downloaded_temp = False 

    try:
        logger.info(f"🚀 [Analysis Pipeline] Processing {doc_id}...")

        # --- Prepare Document ---
        # If Main.py passes local file path, else try to download from Firestore

        if not temp_path:
            if not file_url:
                raise ValueError("Neither local_path nor file_url provided.")
            
            suffix = os.path.splitext(file_name)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                try:
                    response = requests.get(file_url, stream=True, timeout=30)
                    if response.status_code != 200:
                        raise Exception(f"Download failed: {response.status_code}")
                    shutil.copyfileobj(response.raw, tmp)
                    temp_path = tmp.name
                    downloaded_temp = True
                except Exception as dl_err:
                    logger.error(f"Download error: {dl_err}")
                    raise dl_err

        # Mime Check again        
        verified_content_type = original_mime_type
        guessed_type, _ = mimetypes.guess_type(file_name)
        if guessed_type and guessed_type != verified_content_type:
            logger.info(f"MIME corrected: {verified_content_type} -> {guessed_type}")
            verified_content_type = guessed_type


        # ==================== Execution of Pipeline ======================        
        # Optimization: Run L1, L2, and L3 in parallel to avoid blocking logic
        loop = asyncio.get_running_loop()
        logger.info("Dispatching parallel tasks for L1, L2, L3...", extra={"request_id": req_id})

        # 1. Schedule CPU-bound tasks (L1 & L2) in default executor (ThreadPool)
        # This prevents the main event loop from blocking during image processing
        t1 = loop.run_in_executor(None, run_layer_1_metadata, temp_path, verified_content_type)
        t2 = loop.run_in_executor(None, run_layer_2_ela, temp_path, verified_content_type)
        
        # 2. Schedule IO-bound task (L3) directly
        t3 = run_layer_3_extraction(temp_path, verified_content_type)

        # 3. Wait for all layers to complete
        l1_res, l2_res, l3_data = await asyncio.gather(t1, t2, t3)

        evidence_chain = []
        
        # [Step 1: Process L3 Data & Profile Selection]
        # Determine Doc Type and Load Risk Profile
        doc_type_raw = l3_data.get("doc_type", "unknown").lower().replace(" ", "_")
        
        detected_profile_key = "unknown"
        for key in DOC_RISK_PROFILES:
            if key in doc_type_raw:
                detected_profile_key = key
                break
        profile = DOC_RISK_PROFILES[detected_profile_key]
        logger.info(f"Document Classified as: {detected_profile_key.upper()}", extra={"request_id": req_id})
        
        # [Step 2] Layer 1: Metadata
        evidence_chain.append(l1_res)
        
        # [Step 3] Layer 2: Visual ELA
        evidence_chain.append(l2_res)
            
        # [Step 4] Layer 3: Content
        l3_score = 0
        l3_status = LayerStatus.CLEAN
        l3_risk_signals = []
        
        # Helper: Get inference data safely
        l3_inf = l3_data.get("risk_inference", {})
        
        # --- Check 1: Resume Specific Hidden Text (ATS Cheating) ---
        # Resume Specific Check: Hidden Text
        if detected_profile_key == "resume" and l3_data.get("hidden_text_found"):
            l3_score = 100
            l3_status = LayerStatus.HIGH_RISK
            msg = "Hidden text injection detected (ATS Cheating)."
            l3_data["risk_note"] = msg
            l3_risk_signals.append(msg)

        # --- Check 2: Screenshot Check (Generic) ---
        if l3_data.get("is_screenshot"):
            l3_risk_signals.append("Document appears to be a screenshot/screen-capture")

        # --- Check 3: Urgency Language Check (Scam) ---
        if l3_inf.get("urgency_language"):
            if l3_score < 60: l3_score = 60
            if l3_status == LayerStatus.CLEAN: l3_status = LayerStatus.SUSPICIOUS
            l3_risk_signals.append("High-pressure urgency language detected (Potential Scam Pattern).")

        evidence_chain.append(LayerResult(
            layer_name = "L3_Content", 
            status = l3_status, 
            score = l3_score, 
            risk_signals = l3_risk_signals,
            details = l3_data
        ))
        
        # [Step 5] Layer 4: Logic Audit
        logic_required_types = ["invoice", "receipt", "payment_receipt", "bank_statement", "payslip", "contract", "freelance_contract"]
        
        if detected_profile_key in logic_required_types:
            evidence_chain.append(run_layer_4_logic(l3_data))
        else:
            evidence_chain.append(LayerResult(
                layer_name="L4_Logic", 
                status=LayerStatus.SKIPPED, 
                score=0, 
                risk_signals = [],
                details={"reason": f"Not applicable for {detected_profile_key}"}
            ))
            
            
        # [Step 6] Layer 0: Final Technical Judge (Deterministic)
        judge_res = await run_layer_0_judge(detected_profile_key, evidence_chain, profile)
    
        
        # [Step 7] Packing Analysis Report to AI Agent
        rule_metadata = {
                "description": profile.get("description", ""),
                "hard_fail_triggers": profile.get("hard_fail_checks", []),
                "allow_screenshot": profile.get("allow_screenshot", True)
            }

        grounding_info = {}
        if l3_data:
            # Basic Info
            # Helper to safely get nested dicts
            raw_content = l3_data.get("raw_document_content", "")
            vendor = l3_data.get("vendor_info", {})
            fins = l3_data.get("financials", {})
            dates = l3_data.get("dates", {})
            payment = l3_data.get("payment_info", {})
            contact = vendor.get("contact", {})

            grounding_info = {
                "vendor_name": vendor.get("name"),
                "vendor_address": vendor.get("address"),
                "total_amount": fins.get("total_amount"),
                "currency": fins.get("currency"),
                "invoice_date": dates.get("invoice_date")
            }
            
            # Contact Method (Validate the contacts with vendors' official info)
            contact = l3_data.get("vendor_info", {}).get("contact", {})
            grounding_info["vendor_contact"] = {
                "phone": contact.get("phone"),
                "website": contact.get("website"),
                "email": contact.get("email")
            }

            # Payment Info (Identify personal account as a common scamming mode)
            payment = l3_data.get("payment_info", {})
            grounding_info["payment_details"] = {
                "bank_name": payment.get("bank_name"),
                "account_no": payment.get("account_number"),
                "holder_name": payment.get("account_holder_name")
            }

        report = FinalReport(
            request_id = req_id,
            timestamp = datetime.now(),
            doc_type = detected_profile_key,

            overall_risk_score = judge_res.get("overall_risk_score", 0),
            risk_level = judge_res.get("risk_level", "Unknown"),
            risk_signals = judge_res.get("risk_signals", []),
            summary_code = judge_res.get("summary_code", "UNKNOWN"),
            evidence_chain = evidence_chain,

            rule_metadata = rule_metadata,
            grounding_info = grounding_info,
            raw_document_content = raw_content
        )

        logger.info("Technical Analysis Complete", extra={"request_id": req_id, "score": report.overall_risk_score})


        # [Step 8] AI Agent Investigation (Contextual Layer) 
        ai_results = await run_agent_analysis(report)
        
        # [Step 9] Hybrid Merge (Grounding and Technical)
        tech_score = report.overall_risk_score
        grounding_score = ai_results.get("grounding_score", 0)
        
        # Max Voting
        final_risk_score = max(tech_score, grounding_score)
        
        final_rec = "REVIEW"
        if final_risk_score > 80:
            final_rec = "REJECT"
        elif final_risk_score < 30:
            final_rec = "ACCEPT"
        else:
            final_rec = "REVIEW"

        # If AI feels suspicious, recommend for expert review even with low score
        if ai_results.get("verification_status") == "SUSPICIOUS" and final_rec == "ACCEPT":
            final_rec = "REVIEW"

        # [Step 10] Packaging AnalysisRecord
        final_record = AnalysisRecord(
            **report.dict(),    # parsing report
            doc_id = doc_id, 
            req_id = req_id,
            user_id = user_id, 
            file_name = file_name,

            # Fill in AI result
            agent_summary = ai_results.get("agent_summary"),
            verification_status = ai_results.get("verification_status"),
            grounding_score = grounding_score,
            grounding_result = ai_results.get("grounding_result"),
            layer_summaries = ai_results.get("layer_summaries"),
            active_lessons_applied = ai_results.get("active_lessons_applied", []),
            
            # Fill in Deterministic Score
            final_recommendation = final_rec
        )
        
        # [Step 11] Session Memory in Firestore (As RAG of Chatbot)
        try:
            db.collection("analysis_results").document(req_id).set(final_record.dict())
            logger.info(f"Report saved to Firestore: {req_id} (User: {user_id})")
        except Exception as e:
            logger.error(f"Firestore Save Error: {e}")

        # Sent back to front-end
        return final_record
    
    except Exception as e:
        logger.error(f"Pipeline Critical Error: {e}")
        db.collection("analysis_results").document(doc_id).set({"status": "error", "error_msg": str(e)}, merge=True)
        raise e

    finally:
        if downloaded_temp and temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass


# =============== Backup for Async Calling ==============
@analysis_router.post("/trigger/{doc_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis_endpoint(doc_id: str, background_tasks: BackgroundTasks):
    file_record = FilesSchema.get_selected_file(doc_id)
    if isinstance(file_record, tuple): file_record = file_record[0]
    if "error" in file_record: raise HTTPException(status_code=404, detail="File not found")

    background_tasks.add_task(
        analyze_pipeline,
        doc_id=doc_id,
        user_id=str(file_record.get("user_id", "guest")),
        file_name=file_record.get("fileName", "unknown"),
        original_mime_type=file_record.get("mimeType", "application/octet-stream"),
        file_url=file_record.get("fileUrl")
    )
    return {"message": "Analysis started", "doc_id": doc_id, "status": "processing"}