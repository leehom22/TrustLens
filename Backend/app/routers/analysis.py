import os
import uuid
import tempfile
import asyncio
import mimetypes
import shutil
import requests
import json
import google.generativeai as genai
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, status, Request, File, UploadFile, Form
from app.models.files import FilesSchema
from dotenv import load_dotenv

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

        # 3. Wait for all layers to complete
        l1_res, l2_res, l3_data_raw = await asyncio.gather(t1, t2, t3)

        # CRITICAL FIX: Prevent 'NoneType' error if extraction failed
        l3_data = l3_data_raw if l3_data_raw is not None else {}

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
        
        # Safety: risk_inference might be None
        l3_inf = l3_data.get("risk_inference") or {}
        
        # --- Check 1: Resume Specific Hidden Text (ATS Cheating) ---
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
        ai_res_raw = await run_agent_analysis(report)
        ai_results = ai_res_raw if ai_res_raw is not None else {}
        
        # [Step 9] Hybrid Merge
        tech_score = report.overall_risk_score or 0
        grounding_score = ai_results.get("grounding_score", 0)
        
        final_risk_score = max(tech_score, grounding_score)
        
        final_rec = "REVIEW"
        if final_risk_score > 80:
            final_rec = "REJECT"
        elif final_risk_score < 30:
            final_rec = "ACCEPT"
        else:
            final_rec = "REVIEW"

        if ai_results.get("verification_status") == "SUSPICIOUS" and final_rec == "ACCEPT":
            final_rec = "REVIEW"

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
            final_recommendation = final_rec
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


# =============== AI for Restructuring Data (Frontend Display Structure) ==============
@analysis_router.post("/ai-restructure-data")
async def generate_document_dashboard(
    documentId: str = Form(...), 
    document_raw_data: str = Form(...),  # Received as a JSON string from FormData
    file: UploadFile = File(...),         # The actual image file
):
    """
    Combines the image and raw data to generate a visually-grounded forensic report.
    """
    model = genai.GenerativeModel('gemini-flash-latest')
    
    # Load the image for Gemini
    image_bytes = await file.read()
    image_parts = [{"mime_type": file.content_type, "data": image_bytes}]
    
    # Parse the raw data to include it in the prompt
    raw_json = json.loads(document_raw_data)
    print("=========================== Raw json is f{raw_json}===========================")
    raw_analysis_id = raw_json.get('request_id', 'unknown')
    prompt = f"""
    You are a forensic document expert. Analyze the attached IMAGE and the provided DATA.
    
    CRITICAL INSTRUCTION: If there is a mismatch between the Image and the Data, or if the Image 
    contains impossible values (like Feb 32nd or 25:73), you MUST flag it as CRITICAL.
    
    EXTRACTED DATA REFERENCE:
    {json.dumps(raw_json, indent=2)}

    ANALYSIS TASKS:
    1. Visual Verification: Cross-check every line item and total in the image.
    2. Logic Check: Verify math (Items sum == Subtotal) and Temporal validity (Dates/Times).
    3. Output the following JSON structure ONLY.

    {{
      "ui_render_mode": "dashboard_v2",
      "document_id": "{raw_json.get('request_id', 'unknown')}",
      "processed_at": "{datetime.utcnow().isoformat()}",
      "dashboard_header": {{
          "overall_score": number,
          "risk_level": "SAFE" | "CAUTION" | "SUSPICIOUS" | "CRITICAL",
          "risk_level_color": "hex_color",
          "verdict_title": "string",
          "ai_executive_summary": "string",
          "grounding_search_reference": "string",
          "next_step_recommendation": "string"
      }},
      "layer_results": [
          {{
            "layer_id": "L1..L4",
            "layer_title": "string",
            "status": "PASS" | "FAIL",
            "status_color": "hex_color",
            "icon": "lucide_icon_name",
            "score": number,
            "ai_analysis": "string",
            "technical_proofs": ["string"]
          }}
      ]
    }}
    """

   
    if raw_json is not None:
        raw_analysis_id = raw_json.get('request_id', 'unknown')
    else:
        # Fallback if raw_json is missing
        raw_analysis_id = 'unknown'
        print("Warning: raw_json was None. Using 'unknown' as ID.")

    # 2. Extract and clean the AI response
    try:
        response = model.generate_content([prompt, image_parts[0]])

        clean_json = response.text.strip().replace('```json', '').replace('```', '')
        analysis_map = json.loads(clean_json)
    except Exception as e:
        # Fallback if JSON parsing fails
        analysis_map = {"error": "Failed to parse AI response", "raw": response.text}

    # 3. Initialize doc_type with a default value to avoid NameErrors
    doc_type = "unknown" 

    # 4. Firestore Fetch
    doc_ref = db.collection('analysis_results').document(raw_analysis_id)
    doc_snap = doc_ref.get()

    if doc_snap.exists:
        doc_data = doc_snap.to_dict()
        doc_type = doc_data.get('doc_type', 'unknown')

    # 5. Build Payload
    db_payload = {
        "documentId": documentId,
        "raw_analysis_id": raw_analysis_id,
        "doc_type": doc_type,
        "analysis_content": analysis_map, 
        "created_at": datetime.utcnow().isoformat()
    }

    # 6. Save and Return
    db.collection("structure_analysis_result").add(db_payload)
    return db_payload  # This is perfectly fine!

    

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
    
        
    
        
    
    