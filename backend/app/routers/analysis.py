import os
import uuid
import tempfile
import asyncio
import mimetypes
import shutil
import requests
import json
import google.generativeai as genai
import time
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
        t3 = run_layer_3_extraction(temp_path, verified_content_type)

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

        grounding_info = {}
        raw_content = l3_data.get("raw_document_content", "")
        
        # Nested safety check for Step 7
        vendor = l3_data.get("vendor_info") or {}
        fins = l3_data.get("financials") or {}
        dates = l3_data.get("dates") or {}
        payment = l3_data.get("payment_info") or {}
        contact = vendor.get("contact") or {}

        grounding_info = {
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
            }
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

        return final_record
    
    except Exception as e:
        logger.error(f"Pipeline Critical Error: {e}")
        # Use a safe fallback for Firestore if doc_id exists
        if doc_id:
            try:
                db.collection("analysis_results").document(doc_id).set({"status": "error", "error_msg": str(e)}, merge=True)
            except: pass
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



# ========== API Routing: An endpoint as a tool for the AI Agent =================
@analysis_router.post("/ai-analyze-document", response_model = AnalysisRecord)
async def analyze_document(
    request: Request, 
    file: UploadFile = File(...), 
    doc_id: str = Form(...),
    user_id: str = Form(...)
):
    req_id = str(uuid.uuid4())    # generate an ID for every doc as reference
    logger.info(f"Start Analysis", extra={"request_id": req_id, "doc_name": file.filename})   # initiate logger

    verified_content_type = file.content_type 
    # If the guess type different with the file type sent from the user terminal, follow guess type
    guessed_type, _ = mimetypes.guess_type(file.filename)
    if guessed_type and guessed_type != verified_content_type:
        logger.info(f"MIME type corrected: {verified_content_type} -> {guessed_type}", 
                    extra={"request_id": req_id})
        verified_content_type = guessed_type

    # Security check for invalid or unsafe file source
    if verified_content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Allowed: {ALLOWED_MIME_TYPES}")

    try:
        ext = os.path.splitext(file.filename)[1]
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"{doc_id}{ext}")
        
        size = 0
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (Max 10MB)")
                buffer.write(chunk)

        final_record = await analyze_pipeline(
            doc_id=doc_id,
            req_id=req_id,
            user_id=user_id,
            file_name=file.filename,
            original_mime_type=verified_content_type,
            file_url=None,
            local_path_override=temp_path
        )
        
        # Cleaning
        if os.path.exists(temp_path): os.remove(temp_path)
        return final_record
    
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        if 'temp_path' in locals() and os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))    



# =============== Function for Restructuring Data (Frontend Display Structure) ==============

@analysis_router.post("/ai-restructure-data")
async def generate_document_dashboard(
    documentId: str = Form(...),
    document_raw_data: str = Form(...),
    file: UploadFile = File(...),
):
    """
    PURE DATA RESTRUCTURING ENGINE
    
    STRICT RULES:
    1. NO decision logic - only format existing data
    2. NO recalculation of risk scores or levels
    3. NO generation of new text - only use existing fields
    4. NO mapping of risk levels to different values
    5. NO creation of verdicts or recommendations
    
    This endpoint ONLY restructures the existing analysis data
    into a dashboard-friendly format.
    """
    
    start_restructure = time.perf_counter()

    # -----------------------------
    # 1️. Parse Raw Analysis JSON
    # -----------------------------
    try:
        raw_json = json.loads(document_raw_data)
    except Exception:
        return {
            "success": False,
            "error": "Invalid JSON in document_raw_data"
        }

    raw_analysis_id = raw_json.get("request_id", "unknown")
    
    # -----------------------------
    # 2. Extract Core Data (NO TRANSFORMATION)
    # -----------------------------
    
    # Extract evidence chain
    evidence_chain = raw_json.get("evidence_chain", [])
    
    # Helper function to find layer by name
    def find_layer(layer_name):
        return next((l for l in evidence_chain if l.get("layer_name") == layer_name), {})
    
    # Get individual layers - preserve exact layer names from source
    l1 = find_layer("L1_Metadata")
    l2 = find_layer("L2_Visual")
    l3 = find_layer("L3_Content")
    l4 = find_layer("L4_Logic")
    
    # -----------------------------
    # 3. Extract ALL fields as-is
    # -----------------------------
    
    # Risk data - use EXACT values from source
    overall_score = raw_json.get("overall_risk_score")
    risk_level = raw_json.get("risk_level")
    doc_type = raw_json.get("doc_type", "unknown")
    
    # Agent outputs - use EXACT text from source
    agent_summary = raw_json.get("agent_summary", "")
    
    # Layer summaries - use EXACT text from source if available
    layer_summaries = raw_json.get("layer_summaries", {})
    
    # Grounding results - use EXACT data from source
    grounding_result = raw_json.get("grounding_result", {})
    grounding_notes = grounding_result.get("notes", "")
    
    # Sources - preserve original structure, don't transform
    sources = grounding_result.get("sources", [])
    
    # -----------------------------
    # 4. Extract Evidence URLs
    # -----------------------------
    evidence_urls = []
    
    # Try multiple possible locations where evidence URLs might exist
    # This is data location mapping, NOT decision logic
    if l2.get("visual_evidence_url"):
        evidence_urls.append(l2["visual_evidence_url"])
    
    l2_details = l2.get("details", {})
    all_pages = l2_details.get("all_pages", [])
    for page in all_pages:
        url = page.get("url")
        if url and url not in evidence_urls:
            evidence_urls.append(url)
    
    # -----------------------------
    # 5. Extract ATS Hacking Data
    # -----------------------------
    ats_hacking = l2.get("ATS_Hacking")
    ats_hacking_details = None
    
    if l2_details.get("ats_hacking_details"):
        ats_hacking_details = l2_details["ats_hacking_details"]
    
    # -----------------------------
    # 6. Status Mapping
    # -----------------------------
    # This is purely presentational - maps internal status to UI display values
    # Does NOT change risk assessment, only how it's displayed
    def map_status_to_ui(status_str):
        if not status_str:
            return "SKIPPED", "gray"
        
        # Direct mapping table - 1:1 relationship, no interpretation
        status_map = {
            "clean": ("PASS", "green"),
            "suspicious": ("WARNING", "yellow"),
            "high_risk": ("FAIL", "red"),
            "error": ("FAIL", "red"),
            "skipped": ("SKIPPED", "gray")
        }
        
        return status_map.get(status_str.lower(), ("SKIPPED", "gray"))
    
    # Map each layer's status - preserves original assessment, only changes display format
    l1_status, l1_color = map_status_to_ui(l1.get("status"))
    l2_status, l2_color = map_status_to_ui(l2.get("status"))
    l3_status, l3_color = map_status_to_ui(l3.get("status"))
    l4_status, l4_color = map_status_to_ui(l4.get("status"))
    
    # -----------------------------
    # 7. Extract Technical Proofs
    # -----------------------------
    
    # ------------ Handle Risk Signals with Semantic Translation -------------
    SIGNAL_TRANSLATION_MAP = {
        "STRUCTURE_HIDDEN_DATA": "Hidden data payload detected after file EOF.",
        "STRUCTURE_CORRUPTED_EOF": "Corrupted or strictly truncated file structure.",
        "HIGH_METADATA_SOFTWARE_RISK": "Edited with high-risk image manipulation software.",
        "MEDIUM_METADATA_SOFTWARE_RISK": "Processed by consumer-level PDF/Image tool.",
        "TIME_PARADOX_METADATA": "Logical Time Paradox: File created after it was modified.",
        "VISUAL_TAMPERING_DETECTED": "Inconsistent pixel quality indicating localized manipulation.",
        "ATS_HACKING_DETECTED": "Document Integrity: Hidden formatting anomalies identified (ATS Hacking).",
        "ATS_HACKING_DETECTED_White_Text": "Evidence: Invisible white-on-white text layers found in document content.",
        "ATS_HACKING_DETECTED_Micro_Font": "Evidence: Suspicious micro-sized fonts (< 2pt) used to manipulate machine indexing.",
        "SCAM_PATTERN_DETECTED": "Social engineering or fraud language patterns identified.",
        "SEMANTIC_PARADOX_DETECTED": "Internal logical contradictions found within the document text.",
        "MATH_ROW_MISMATCH": "Line item calculation (Qty × Unit) does not match extracted total.",
        "MATH_TAX_LOGIC_FAIL": "Statutory tax calculation or subtotal aggregation failed.",
        "MISSING_INVOICE_ID": "Missing unique document identifier (Invoice/Receipt No).",
        "MISSING_CORE_ACCOUNT_ID": "Bank Statement is missing core account identifier.",
        "MISSING_PAYMENT_ROUTE": "Invoice is missing bank account details for payment routing.",
        "MISSING_PAYMENT_PROOF": "Missing payment verification data (Account or Ref ID).",
        "BENEFICIARY_MISMATCH": "Account holder name does not match the vendor name.",
        "TIME_PARADOX_LOGIC": "Logical Error: Due Date is earlier than Document Issue Date.",
        "ID_DATE_TIME_PARADOX": "Impossible chronography: Transaction ID generated before document existed.",
        "ID_DATE_LAG_SUSPICIOUS": "Suspicious lag between transaction ID and receipt generation.",
        "ID_DATE_MISMATCH_STRICT": "Transaction ID belongs to a completely different day.",
        "LONG_ENTRY_DELAY": "Unusual processing delay extending beyond normal administrative window.",
        "DATE_FROM_FUTURE": "Transaction date is in the future relative to analysis time.",
        "CHRONOLOGY_INCONSISTENCY": "Sequential order of transactions is corrupted (Time Jump).",
        "BALANCE_RECONCILIATION_FAIL": "Opening Balance + Cash Flows does not equal Closing Balance."
    }

    INTERNAL_SIGNAL_BLACKLIST = {"JSON_REPAIRED"}   # Filter out technical signals that are not meaningful

    def format_proofs(signals_list):
        if not signals_list:
            return []
        return [
            SIGNAL_TRANSLATION_MAP.get(sig, sig) 
            for sig in signals_list 
            if sig not in INTERNAL_SIGNAL_BLACKLIST
        ]

    l1_proofs = format_proofs(l1.get("risk_signals", []))
    l2_proofs = format_proofs(l2.get("risk_signals", []))
    l3_proofs = format_proofs(l3.get("risk_signals", []))
    l4_proofs = format_proofs(l4.get("risk_signals", []))

    # -------------- Data Enrichment from Layer Details ----------------

    # --- L1: Metadata Details ---
    l1_details = l1.get("details", {})
    if l1_details.get("producer_raw"):
        l1_proofs.append(f"Document Generator: {l1_details['producer_raw']}")
    if l1_details.get("software_risk"):
        l1_proofs.append(l1_details["software_risk"])
    if l1_details.get("time_paradox"):
        l1_proofs.append(l1_details["time_paradox"])
    if l1_details.get("structure", {}).get("structure_note"):
        l1_proofs.append(l1_details["structure"]["structure_note"])

    # --- L2: Visual Details ---
    l2_details = l2.get("details", {})
    if l2_details.get("mode"):
        l2_proofs.append(f"Visual Analysis Mode: {l2_details['mode']}")
    
    worst_metrics = l2_details.get("worst_page_details", {}).get("metrics", {})
    if worst_metrics.get("max_z_score"):
        z_score = worst_metrics["max_z_score"]
        if z_score > 0:
            l2_proofs.append(f"Peak ELA Anomaly (Z-Score): {z_score:.2f}")

    # --- L3: Content Details ---
    l3_details = l3.get("details", {})
    vis_elements = l3_details.get("visual_elements", {})
    if vis_elements.get("mixed_fonts"):
        l3_proofs.append("Multiple inconsistent font types detected across text layout.")
    if vis_elements.get("misaligned_layout"):
        l3_proofs.append("Text bounding box misalignments detected in table or layout.")

    reasoning = l3_details.get("forensic_reasoning_trace", {})
    paradoxes = reasoning.get("internal_semantic_paradoxes", [])
    for p in paradoxes:
        l3_proofs.append(f"Logic Anomaly: {p}")
    scams = reasoning.get("scam_pattern_analysis", [])
    for s in scams:
        l3_proofs.append(f"Scam Pattern: {s}")

    # --- L4: Logic Audit Trails ---
    l4_details = l4.get("details", {})
    audit_trails = l4_details.get("audit_trails", [])
    
    # Extract up to 3 FAILs for L4 proofs, with detailed formatting
    fails = [t for t in audit_trails if t.get("status") == "FAIL"]
    for f in fails[:3]:
        # Concatenation Format: "[Row 1 Math] 5.0 * 10.0 = 50.00 (Extracted: 60.00)"
        proof_str = f"[{f.get('check_name', 'Audit')}] {f.get('visual_feedback', '')}"
        if proof_str not in l4_proofs:
            l4_proofs.append(proof_str)
            
    # If no FAILs, then show PASS proofs to provide positive evidence and balance the narrative
    if not fails:
        passes = [t for t in audit_trails if t.get("status") == "PASS"]
        for p in passes[:2]:
            proof_str = f"Verified: {p.get('check_name', 'Audit')} - {p.get('reason', 'OK')}"
            if proof_str not in l4_proofs:
                l4_proofs.append(proof_str)

    # Crop proofs to max 6 per layer for UI display
    l1_proofs = list(dict.fromkeys(l1_proofs))[:5]
    l2_proofs = list(dict.fromkeys(l2_proofs))[:5]
    l3_proofs = list(dict.fromkeys(l3_proofs))[:5]
    l4_proofs = list(dict.fromkeys(l4_proofs))[:5]
    
    # -----------------------------
    # 8. Build Layer Results
    # -----------------------------
    layer_results = [
        {
            "layer_id": "L1",
            "layer_title": "Metadata Forensics",  # Fixed display title
            "status": l1_status,
            "status_color": l1_color,
            "icon": "file-text",
            "score": l1.get("score", 0),
            "ai_analysis": layer_summaries.get("L1_Metadata", "No AI summary available."),
            "technical_proofs": l1_proofs,
            "has_visual_evidence": False,
            "evidence_image_url": []
        },
        {
            "layer_id": "L2",
            "layer_title": "Visual Forensics",
            "status": l2_status,
            "status_color": l2_color,
            "icon": "eye",
            "score": l2.get("score", 0),
            "ai_analysis": layer_summaries.get("L2_Visual", "No AI summary available."),
            "technical_proofs": l2_proofs,
            "has_visual_evidence": len(evidence_urls) > 0,
            "evidence_image_url": evidence_urls,
            "ATS_hacking": ats_hacking if ats_hacking else "None"
        },
        {
            "layer_id": "L3",
            "layer_title": "Content Extraction",
            "status": l3_status,
            "status_color": l3_color,
            "icon": "file-digit",
            "score": l3.get("score", 0),
            "ai_analysis": layer_summaries.get("L3_Content", "No AI summary available."),
            "technical_proofs": l3_proofs,
            "has_visual_evidence": False,
            "evidence_image_url": []
        },
        {
            "layer_id": "L4",
            "layer_title": "Logic Audit",
            "status": l4_status,
            "status_color": l4_color,
            "icon": "calculator",
            "score": l4.get("score", 0),
            "ai_analysis": layer_summaries.get("L4_Logic", "No AI summary available."),
            "technical_proofs": l4_proofs,
            "has_visual_evidence": False,
            "evidence_image_url": []
        }
    ]
    
    # Add ATS hacking data if present
    if ats_hacking:
        layer_results[1]["ATS_hacking"] = ats_hacking
    if ats_hacking_details:
        layer_results[1]["ats_hacking_details"] = ats_hacking_details
    
    # -----------------------------
    # 9. Build Dashboard Header
    # -----------------------------
    risk_upper = str(risk_level).upper()
    
    title_map = {
        "CRITICAL": "Critical Risk Detected",
        "HIGH_RISK": "High Risk Detected",
        "SUSPICIOUS": "Suspicious Elements Found",
        "CAUTION": "Caution Advised",
        "SAFE": "Document Verified",
        "CLEAN": "Document Verified"
    }

    # Risk level color mapping - purely presentational, no semantic change
    color_map = {
        "SAFE": "green",
        "CAUTION": "yellow",
        "SUSPICIOUS": "orange",
        "CRITICAL": "red",
        "HIGH_RISK": "red"
    }
    
    dashboard_header = {
        "overall_score": overall_score,
        "risk_level": risk_level,
        "risk_level_color": color_map.get(str(risk_level).upper(), "gray"),
        "verdict_title": title_map.get(risk_upper, "Analysis Complete"),
        "ai_executive_summary": agent_summary,
        "grounding_search_reference": grounding_notes,
        "doc_type": doc_type,
        "next_step_recommendation": raw_json.get("final_recommendation", "Review document findings manually."),
        "sources": sources  # EXACT structure from source
    }
    
    # -----------------------------
    # 10. Build Final Dashboard
    # -----------------------------
    dashboard = {
        "ui_render_mode": "dashboard_v2",
        "document_id": raw_analysis_id,
        "processed_at": datetime.utcnow().isoformat(),
        "dashboard_header": dashboard_header,
        "layer_results": layer_results
    }

    restructure_duration_ms = int((time.perf_counter() - start_restructure) * 1000)
    logger.info(f"[AI_Restructure] executed in {restructure_duration_ms}ms", extra={
        "json_fields": {
            "event_type": "latency_metric",
            "document_id": documentId,
            "raw_analysis_id": raw_analysis_id,
            "layer": "AI_Restructure",
            "duration_ms": restructure_duration_ms,
            "status": "SUCCESS"
        }
    })
    
    # -----------------------------
    # 11. Fetch Additional Metadata
    # -----------------------------
    # This is adding context, NOT changing the analysis
    try:
        doc_ref = db.collection("analysis_results").document(raw_analysis_id)
        doc_snap = doc_ref.get()
        if doc_snap.exists:
            doc_data = doc_snap.to_dict()
            # Only add fields that don't conflict with existing data
            if not doc_type or doc_type == "unknown":
                dashboard["dashboard_header"]["doc_type"] = doc_data.get("doc_type", "unknown")
    except Exception as e:
        print(f"Warning: Could not fetch additional metadata: {e}")
    
    # -----------------------------
    # 12. Save to Database
    # -----------------------------
    db_payload = {
        "documentId": documentId,
        "raw_analysis_id": raw_analysis_id,
        "doc_type": doc_type,
        "analysis_content": dashboard,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    try:
        db.collection("structure_analysis_result").add(db_payload)
        
        upload_document_db = db.collection('upload_files').document(documentId).get()
        if upload_document_db.exists:
            db.collection('upload_files').document(documentId).update({
                "risk_level": risk_level,
                "risk_level_color": dashboard_header["risk_level_color"],
                "overall_score": overall_score
            })
    except Exception as e:
        print(f"Warning: Firestore save error: {e}")
    
    return db_payload





    

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
    role: str = Form(...)
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
            analysis_content = doc_data.get("analysis_content", {})
            
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
                filename=f"{doc_name}_analysis.pdf"
            )
            
        return {"success": False, "message": "Document not found"}

    except Exception as e:
        import traceback
        print(f"PDF Generation Error: {e}") 
        traceback.print_exc() # This gives you the line number of the error
        return {"success": False, "error": str(e)}