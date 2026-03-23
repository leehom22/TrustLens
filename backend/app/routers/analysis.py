import os
import gc
import uuid
import tempfile
import asyncio
import mimetypes
import shutil
import requests
import json
import google.generativeai as genai
import time
from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Request, File, UploadFile, Form
from fastapi.responses import FileResponse
from app.models.files import FilesSchema
from dotenv import load_dotenv
from ..utils.utils import upload_evidence_to_storage

# ------- Import internal modules ------
from ..core.auth import get_current_user
from ..core.config import Config
from ..core.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, EVIDENCE_DIR, DOC_RISK_PROFILES
from ..utils.schemas import FinalReport, LayerStatus, LayerResult, BatchAnalysisResponse
from ..services.layer1 import run_layer_1_metadata
from ..services.layer2 import run_layer_2_ela
from ..services.layer3 import run_layer_3_extraction
from ..services.layer4 import run_layer_4_logic
from ..services.layer0 import run_layer_0_judge

# ------ Import for AI and DB connection ---------
from ..services.agent import run_agent_analysis
from ..utils.schemas import FinalReport, AnalysisRecord
from ..core.firebase import db
from ..core.generatePdf import generate_analysis_pdf


# --- Load Env Vars ---
# This block ensures we find the .env file whether running from root or /app
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

raw_analysis_collection = 'upload_files'
structure_analysis_collection = 'structure_analysis_result'

analysis_router = APIRouter()

# ====== Global Safety Boundary =======
# Limit to handle 2 heavy files concurrently, as to prevent the OOM from being killed by system
MAX_CONCURRENT_ANALYSIS = 3
analysis_semaphore = asyncio.Semaphore(MAX_CONCURRENT_ANALYSIS)

# ======================== Timing and Logging Function =========================
async def measure_task(layer_name: str, req_id: str, awaitable_task):
    start_time = time.perf_counter()
    status = "SUCCESS"
    try:
        result = await awaitable_task
        if hasattr(result, "status"):
            status_value = result.status.value if hasattr(result.status, "value") else str(result.status)
            if status_value.upper() == "ERROR":
                status = "ERROR"
            elif status_value.upper() == "SKIPPED":
                status = "SKIPPED"
    except Exception as e:
        status = f"ERROR: {str(e)}"
        raise e
    finally:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        metric_payload = {
            "event_type": "latency_metric",
            "request_id": req_id,
            "layer": layer_name,
            "duration_ms": duration_ms,
            "status": status
        }
        logger.info(f"[{layer_name}] executed in {duration_ms}ms", extra={"json_fields": metric_payload})
    return result


# ======================== Pipeline Execution =========================
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

    # Label as start processing
    if doc_id:
        try:
            db.collection("upload_files").document(doc_id).set({"analysis_status": "PROCESSING"}, merge=True)
        except Exception as e:
            logger.warning(f"DB State Update Failed (PROCESSING) for {doc_id}: {e}")

    try:
        logger.info(f"🚀 [Analysis Pipeline] Processing {doc_id}...")

        # --- Prepare Document ---
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
        loop = asyncio.get_running_loop()
        logger.info("Dispatching parallel tasks for L1, L2, L3...", extra={"request_id": req_id})

        t1 = loop.run_in_executor(None, run_layer_1_metadata, temp_path, verified_content_type)
        t2 = loop.run_in_executor(None, run_layer_2_ela, temp_path, verified_content_type)
        t3 = run_layer_3_extraction(temp_path, verified_content_type, req_id)

        # 3. Wait for all layers to complete and gather results
        l1_res, l2_res, l3_data_raw = await asyncio.gather(
            measure_task("L1_Metadata", req_id, t1),
            measure_task("L2_Visual", req_id, t2),
            measure_task("L3_Extraction", req_id, t3)
        )
        l3_data = l3_data_raw if l3_data_raw is not None else {}

        evidence_urls = {
            "original_document": file_url,
            "all_heatmaps": []    # For appending heatmap URLs
        }
        
        # Extract all heatmap pages info from L2 result
        all_pages = l2_res.details.get("all_pages", [])
        if not all_pages and l2_res.details.get("temp_path"):
            all_pages = [{"local_path": l2_res.details.get("temp_path"), "page": 1}]

        # Upload all heatmaps and collect URLs
        for idx, page_info in enumerate(all_pages):
            local_path = page_info.get("local_path")
            
            if local_path and os.path.exists(local_path):
                # Naming: visual_ela_p1.jpg, visual_ela_p2.jpg, etc.
                page_num = page_info.get("page", idx + 1)
                # Add user id 
                ela_dest = f"evidence/{user_id}/{req_id}/visual_ela_p{page_num}.jpg"
                
                cloud_url = upload_evidence_to_storage(local_path, ela_dest, "image/jpeg")
                
                if cloud_url:
                    page_info["url"] = cloud_url
                    evidence_urls["all_heatmaps"].append(cloud_url)
                    
                    # Keep the first heatmap URL at the top level
                    if "ela_heatmap" not in evidence_urls:
                        l2_res.visual_evidence_url = cloud_url
                        l2_res.details["visual_evidence_url"] = cloud_url
                        evidence_urls["ela_heatmap"] = cloud_url
                    
                    logger.info(f"Uploaded Page {page_num}: {cloud_url}")

                # Clean up local heatmap file
                try: os.remove(local_path)
                except: pass

        evidence_chain = []
        
        # [Step 1: Process L3 Data & Profile Selection]
        # Use str() and .get() with fallback to avoid crash on None
        doc_type_raw = str(l3_data.get("doc_type", "unknown")).lower().replace(" ", "_")
        
        detected_profile_key = "unknown"
        for key in DOC_RISK_PROFILES:
            if key in doc_type_raw:
                detected_profile_key = key
                break
        
        # Safety check for profile dictionary
        profile = DOC_RISK_PROFILES.get(detected_profile_key, DOC_RISK_PROFILES.get("unknown", {}))
        logger.info(f"Document Classified as: {detected_profile_key.upper()}", extra={"request_id": req_id})
        
        # [Step 2] Layer 1: Metadata
        if l1_res: evidence_chain.append(l1_res)
        
        # [Step 3] Layer 2: Visual ELA
        if l2_res: evidence_chain.append(l2_res)
            
        # [Step 4] Layer 3: Content
        l3_score = 0
        l3_status = LayerStatus.CLEAN
        l3_risk_signals = []
        
        trace = l3_data.get("forensic_reasoning_trace", {})

        # --- Check 1: Screenshot Check (Generic) ---
        if l3_data.get("is_screenshot"):
            l3_risk_signals.append("Document appears to be a screenshot/screen-capture")

        # --- Check 2: Scam Pattern Check ---
        if "SCAM_PATTERN_DETECTED" in l3_risk_signals:
            l3_score = max(l3_score, 85)
            l3_status = LayerStatus.HIGH_RISK
            scams = trace.get("scam_pattern_analysis", [])
            for s in scams:
                l3_risk_signals.append(f"Scam Analysis: {s}")

        # --- Check 3: Semantic Paradox Check ---
        if "SEMANTIC_PARADOX_DETECTED" in l3_risk_signals:
            l3_score = max(l3_score, 65)
            if l3_status == LayerStatus.CLEAN:
                l3_status = LayerStatus.SUSPICIOUS
            paradoxes = trace.get("internal_semantic_paradoxes", [])
            for p in paradoxes:
                l3_risk_signals.append(f"Logic Anomaly: {p}")
            
        evidence_chain.append(LayerResult(
            layer_name = "L3_Content", 
            status = l3_status, 
            score = l3_score, 
            risk_signals = l3_risk_signals,
            details = l3_data
        ))
        
        # [Step 5] Layer 4: Logic Audit
        start_l4 = time.perf_counter()   # Start timing for Layer 4

        logic_required_types = ["invoice", "receipt", "payment_receipt", "bank_statement", "payslip", "contract", "legal_document", "summon"]
        
        if detected_profile_key in logic_required_types:
            if l1_res:
                l3_data["_l1_metadata"] = l1_res.details   # For cross-layer chronology check
            evidence_chain.append(run_layer_4_logic(l3_data))
        else:
            evidence_chain.append(LayerResult(
                layer_name="L4_Logic", 
                status=LayerStatus.SKIPPED, 
                score=0, 
                risk_signals = [],
                details={"reason": f"Not applicable for {detected_profile_key}"}
            ))

        # Timing log for Layer 4
        l4_duration_ms = int((time.perf_counter() - start_l4) * 1000)
        logger.info(f"[L4_Logic] executed in {l4_duration_ms}ms", extra={
            "json_fields": {
                "event_type": "latency_metric",
                "request_id": req_id,
                "doc_type": detected_profile_key,
                "layer": "L4_Logic",
                "duration_ms": l4_duration_ms,
                "status": "SUCCESS"
            }
        })
            
        # [Step 6] Layer 0: Final Technical Judge (Deterministic)
        judge_res_raw = await run_layer_0_judge(detected_profile_key, evidence_chain, profile)
        judge_res = judge_res_raw if judge_res_raw is not None else {}
        
        # [Step 7] Packing Analysis Report to AI Agent
        rule_metadata = {
                "description": profile.get("description", ""),
                "hard_fail_triggers": profile.get("hard_fail_checks", []),
                "allow_screenshot": profile.get("allow_screenshot", True)
            }

        grounding_info_raw = {}
        grounding_info = {}
        raw_content = l3_data.get("raw_document_content", "")
        
        # Nested safety check for Step 7
        vendor = l3_data.get("vendor_info") or {}
        fins = l3_data.get("financials") or {}
        dates = l3_data.get("dates") or {}
        payment = l3_data.get("payment_info") or {}
        contact = vendor.get("contact") or {}
        summon = l3_data.get("summon_details") or {}
        legal = l3_data.get("legal_details") or {}

        grounding_info_raw = {
            "vendor_name": vendor.get("name"),
            "vendor_address": vendor.get("address"),
            "total_amount": fins.get("total_amount"),
            "currency": fins.get("currency"),
            "invoice_date": dates.get("invoice_date"),
            "vendor_contact": {
                "phone": contact.get("phone"),
                "website": contact.get("website"),
                "email": contact.get("email")
            },
            "payment_details": {
                "bank_name": payment.get("bank_name"),
                "account_no": payment.get("account_number"),
                "holder_name": payment.get("account_holder_name")
            },
            # Entities specific to summons
            "summon_issuing_agency": summon.get("issuing_agency"),
            # Entities specific to contract
            "contract_party_a": legal.get("party_a", {}).get("name"),
            "contract_party_b": legal.get("party_b", {}).get("name")
        }

        # Clean up empty items
        grounding_info = {k: v for k, v in grounding_info_raw.items() if v}

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

        # [Step 8] AI Agent Investigation
        start_agent = time.perf_counter()

        ai_res_raw = await run_agent_analysis(report)
        ai_results = ai_res_raw if ai_res_raw is not None else {}

        agent_duration_ms = int((time.perf_counter() - start_agent) * 1000)
        logger.info(f"[Analysis_Agent] executed in {agent_duration_ms}ms", extra={
            "json_fields": {
                "event_type": "latency_metric",
                "request_id": req_id,
                "doc_type": detected_profile_key,
                "layer": "Analysis_Agent",
                "duration_ms": agent_duration_ms,
                "status": "SUCCESS"
            }
        })
        
        # [Step 9] Hybrid Merge
        tech_score = report.overall_risk_score or 0
        grounding_score = ai_results.get("grounding_score", 0)
        
        final_risk_score = max(tech_score, grounding_score)

        ai_recommendation = ai_results.get("next_step_recommendation", "Review document findings manually.")
        
        """
        final_rec = "REVIEW"
        if final_risk_score > 80:
            final_rec = "REJECT"
        elif final_risk_score < 30:
            final_rec = "ACCEPT"
        else:
            final_rec = "REVIEW"

        if ai_results.get("verification_status") == "SUSPICIOUS" and final_rec == "ACCEPT":
            final_rec = "REVIEW"
        """

        # [Step 10] Packaging AnalysisRecord
        final_record = AnalysisRecord(
            **report.dict(),
            doc_id = doc_id, 
            req_id = req_id,
            user_id = user_id, 
            file_name = file_name,
            agent_summary = ai_results.get("agent_summary"),
            verification_status = ai_results.get("verification_status"),
            grounding_score = grounding_score,
            grounding_result = ai_results.get("grounding_result"),
            layer_summaries = ai_results.get("layer_summaries"),
            active_lessons_applied = ai_results.get("active_lessons_applied", []),
            final_recommendation = ai_recommendation
        )
        
        # [Step 11] Session Memory
        try:
            db.collection("analysis_results").document(req_id).set(final_record.dict())
            logger.info(f"Report saved to Firestore: {req_id} (User: {user_id})")
        except Exception as e:
            logger.error(f"Firestore Save Error: {e}")

        # Analysis success
        if doc_id:
            try:
                db.collection("upload_files").document(doc_id).set({"analysis_status": "SUCCESS"}, merge=True)
            except: pass

        return final_record
    
    except Exception as e:
        logger.error(f"Pipeline Critical Error: {e}")
        # Record reason if analysis crashed, to prevent frontend's deadlock
        if doc_id:
            try:
                db.collection("upload_files").document(doc_id).set({
                    "analysis_status": "FAILED", 
                    "error_msg": str(e)
                }, merge=True)
            except: pass
        raise e

    finally:
        gc.collect()
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



# ========== API Routing: An endpoint as a tool for the AI Agent =================
@analysis_router.post("/ai-analyze-document", response_model = BatchAnalysisResponse)
async def analyze_document(
    request: Request, 
    file: List[UploadFile] = File(...), 
    doc_id: List[str] = Form(...),
    user_id: str = Form(...)
):
    # Safetty Check
    if len(file) != len(doc_id):
        raise HTTPException(status_code=400, detail="Mismatch between files and doc_ids count.")
    if len(file) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 files allowed per batch.")
    
    async def process_task(single_file: UploadFile, single_doc_id: str):
        # Queueing Mechanism: Force to limit CPU/RAM computing amount in a same time
        async with analysis_semaphore:
            req_id = str(uuid.uuid4())    # generate an ID for every doc as reference
            logger.info(f"Start Analysis", extra={"request_id": req_id, "doc_name": single_file.filename})   # initiate logger

            verified_content_type = single_file.content_type
            # If the guess type different with the file type sent from the user terminal, follow guess type
            guessed_type, _ = mimetypes.guess_type(single_file.filename)
            if guessed_type and guessed_type != verified_content_type:
                logger.info(f"MIME type corrected: {verified_content_type} -> {guessed_type}", 
                            extra={"request_id": req_id})
                verified_content_type = guessed_type

            # Security check for invalid or unsafe file source
            if verified_content_type not in ALLOWED_MIME_TYPES:
                db.collection("upload_files").document(single_doc_id).set({"analysis_status": "FAILED", "error_msg": "Invalid MIME"}, merge=True)
                return {"doc_id": single_doc_id, "status": "failed", "error": f"Invalid type. Allowed: {ALLOWED_MIME_TYPES}"}
            
            temp_path = None
            try:
                ext = os.path.splitext(single_file.filename)[1]
                temp_dir = tempfile.gettempdir()
                temp_path = os.path.join(temp_dir, f"{single_doc_id}{ext}")
                
                size = 0
                with open(temp_path, "wb") as buffer:
                    while chunk := await single_file.read(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_FILE_SIZE:
                            raise HTTPException(status_code=413, detail="File too large (Max 10MB)")
                        buffer.write(chunk)

                # Execute Pipeline
                final_record = await analyze_pipeline(
                    doc_id=single_doc_id,
                    req_id=req_id,
                    user_id=user_id,
                    file_name=single_file.filename,
                    original_mime_type=verified_content_type,
                    file_url=None,
                    local_path_override=temp_path
                )
                return {"doc_id": single_doc_id, "status": "success", "data": final_record}
                
            except Exception as e:
                logger.error(f"Batch task failed for {single_doc_id}: {e}")
                return {"doc_id": single_doc_id, "status": "failed", "error": str(e)}
            finally:
                # Cleaning
                if temp_path and os.path.exists(temp_path):
                    try: os.remove(temp_path)
                    except: pass

    tasks = [process_task(file[i], doc_id[i]) for i in range(len(file))]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Cleaning and pack up return structure
    final_response = []
    for res in results:
        if isinstance(res, Exception):
            # Capture underlying system anomalies
            final_response.append({"status": "critical_failure", "error": str(res)})
        else:
            final_response.append(res)

    return {"batch_status": "completed", "results": final_response}


# ============= Get Doc Analysis at Frontend for History Chat Display =============
@analysis_router.post("/get-doc-analysis")
async def get_document_analysis(docId: str = Form(...)):
    try:
        # 1. Correctly define the query
        query = db.collection(structure_analysis_collection).where("documentId", "==", docId)
        
        # 2. Execute the query to get a list of snapshots
        docs = query.get()
        
        # 3. Check if any documents were found
        if docs and len(docs) > 0:
            # Get the first document found
            doc_snap = docs[0]
            doc_data = doc_snap.to_dict()
            
            # 4. Correctly attach the document ID to the data
            doc_data['id'] = doc_snap.id
            
            return {"success": True, "data": doc_data}
        
        # Handle case where no document matches the ID
        return {"success": False, "message": "Document not found"}
        
    except Exception as e:
        # Use a logger in production instead of print
        print(f"Error occurred while fetching document analysis: {e}")
        return {"success": False, "error": str(e)}
    
@analysis_router.post("/download-analysis-report")
async def download_analysis_report(
    doc_id: str = Form(...),
    analysis_id: str = Form(...),
    doc_name: str = Form(...),
    role: str = Form(...),
    language: str = Form("en")
):
    try:
        # 1. Ensure the 'reports' directory exists
        report_dir = "/tmp/reports"
        os.makedirs(report_dir, exist_ok=True) # Permission error in Cloud Run
        file_path = os.path.join(report_dir, f"{doc_id}_analysis.pdf")

        # 2. Initialize review_notes empty (safety)
        review_notes = []
        if role == 'expert': # Fixed 'is' to '=='
            # Fixed .query to .where

            review_query = db.collection("document_review").where("docId", "==", doc_id).stream()
            
            for review in review_query:
                print("Looping through review_query...")  # Debugging line to check if loop is entered
                review_data = review.to_dict()

                note = review_data.get("review_notes")
                if note:
                    review_notes.append(note)

        # 4. Fetch Analysis Document
        doc_snap = db.collection(structure_analysis_collection).document(analysis_id).get()

        if doc_snap.exists:
            doc_data = doc_snap.to_dict()

            # Get content with current chosen language
            i18n_content = doc_data.get("i18n_content", {})
            analysis_content = i18n_content.get(language, i18n_content.get("en", {}))
            
            if not analysis_content:
                return {"success": False, "message": "Failed to parse language content"}
            
            # 5. Inject Data
            analysis_content["document_name"] = doc_name
            
            # Using len() instead of .__len__() is more Pythonic
            if role == 'expert' and len(review_notes) > 0:
                analysis_content["expert_review_notes"] = review_notes
                
            # 6. Generate PDF
            generate_analysis_pdf(
                data=analysis_content,
                output_path=file_path
            )

            # 7. Return File
            return FileResponse(
                path=file_path,
                media_type="application/pdf",
                filename=f"{doc_name}_analysis_{language}.pdf"
            )
            
        return {"success": False, "message": "Document not found"}

    except Exception as e:
        import traceback
        print(f"PDF Generation Error: {e}") 
        traceback.print_exc() # This gives you the line number of the error
        return {"success": False, "error": str(e)}