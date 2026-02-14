import uuid
import tempfile
import asyncio
import os
import json
import mimetypes
import google.generativeai as genai
from datetime import datetime
from fastapi import UploadFile, File, HTTPException, Request, APIRouter, Form
from app.utils.schemas import FinalReport, LayerStatus, LayerResult
from app.services.layer1 import run_layer_1_metadata
from app.services.layer2 import run_layer_2_ela
from app.services.layer3 import run_layer_3_extraction
from app.services.layer4 import run_layer_4_logic
from app.services.layer0 import run_layer_0_judge
from app.core.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, DOC_RISK_PROFILES
# ------ Import for AI and DB connection ---------
from app.services.agent import run_agent_analysis
from app.utils.schemas import FinalReport, AnalysisRecord
from app.core.firebase import db

analysis_router = APIRouter()

raw_analysis_collection = 'upload_files'
structure_analysis_collection = 'structure_analysis_result'

# API Routing: An endpoint as a tool for the AI Agent
@analysis_router.post("/ai-analyze-document", response_model = AnalysisRecord)
# async def analyze_document(request: Request, file: UploadFile = File(...)):
async def analyze_document(file: UploadFile = File(...)):
    req_id = str(uuid.uuid4())
    logger.info(f"Start Analysis", extra={"request_id": req_id, "doc_name": file.filename})

    verified_content_type = file.content_type 
    guessed_type, _ = mimetypes.guess_type(file.filename)
    if guessed_type and guessed_type != verified_content_type:
        verified_content_type = guessed_type

    if verified_content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Allowed: {ALLOWED_MIME_TYPES}")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        ext = os.path.splitext(file.filename)[1]
        temp_path = os.path.join(temp_dir, f"{req_id}{ext}")
        
        size = 0
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (Max 10MB)")
                buffer.write(chunk)

        # Pipeline Execution
        loop = asyncio.get_running_loop()
        t1 = loop.run_in_executor(None, run_layer_1_metadata, temp_path, verified_content_type)
        t2 = loop.run_in_executor(None, run_layer_2_ela, temp_path, verified_content_type)
        t3 = run_layer_3_extraction(temp_path, verified_content_type)

        l1_res, l2_res, l3_data = await asyncio.gather(t1, t2, t3)
        
        # Ensure l3_data itself is a dict
        l3_data = l3_data or {}

        evidence_chain = []
        doc_type_raw = l3_data.get("doc_type", "unknown").lower().replace(" ", "_")
        
        detected_profile_key = "unknown"
        for key in DOC_RISK_PROFILES:
            if key in doc_type_raw:
                detected_profile_key = key
                break
        profile = DOC_RISK_PROFILES.get(detected_profile_key, {})
        
        evidence_chain.append(l1_res)
        evidence_chain.append(l2_res)
            
        l3_score = 0
        l3_status = LayerStatus.CLEAN
        l3_risk_signals = []
        l3_inf = l3_data.get("risk_inference", {}) or {} # Safe Guard
        
        if detected_profile_key == "resume" and l3_data.get("hidden_text_found"):
            l3_score = 100
            l3_status = LayerStatus.HIGH_RISK
            l3_risk_signals.append("Hidden text injection detected (ATS Cheating).")

        if l3_data.get("is_screenshot"):
            l3_risk_signals.append("Document appears to be a screenshot/screen-capture")

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
            
        judge_res = await run_layer_0_judge(detected_profile_key, evidence_chain, profile)
    
        rule_metadata = {
                "description": profile.get("description", ""),
                "hard_fail_triggers": profile.get("hard_fail_checks", []),
                "allow_screenshot": profile.get("allow_screenshot", True)
            }

        grounding_info = {}
        # Ensure nested components are always dictionaries even if missing in L3
        raw_content = l3_data.get("raw_document_content", "")
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
            # Re-calculated contact/payment safely within the dict
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

        ai_results = await run_agent_analysis(report)
        
        tech_score = report.overall_risk_score
        grounding_score = ai_results.get("grounding_score", 0)
        final_risk_score = max(tech_score, grounding_score)
        
        if final_risk_score > 80: final_rec = "REJECT"
        elif final_risk_score < 30: final_rec = "ACCEPT"
        else: final_rec = "REVIEW"

        if ai_results.get("verification_status") == "SUSPICIOUS" and final_rec == "ACCEPT":
            final_rec = "REVIEW"

        final_record = AnalysisRecord(
            **report.dict(),
            agent_summary = ai_results.get("agent_summary"),
            verification_status = ai_results.get("verification_status"),
            grounding_score = grounding_score,
            grounding_result = ai_results.get("grounding_result"),
            layer_summaries = ai_results.get("layer_summaries"),
            active_lessons_applied = ai_results.get("active_lessons_applied", []),
            final_recommendation = final_rec
        )
        
        try:
            db.collection("analysis_results").document(req_id).set(final_record.dict())
        except Exception as e:
            logger.error(f"Firestore Save Error: {e}")

        return final_record


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

    try:
        # Multi-modal call: Pass both the prompt text AND the image
        response = model.generate_content([prompt, image_parts[0]])
        
        clean_json = response.text.strip().replace('```json', '').replace('```', '')
        analysis_map = json.loads(clean_json)
        db_payload = {
            "documentId": documentId,
            "raw_analysis_id": raw_analysis_id,
            "analysis_content": analysis_map, # Saving as a Map/Object is better than a string
            "created_at": datetime.utcnow().isoformat()
        }
        # request_id + documentId 
        db.collection("structure_analysis_result").add(db_payload)
        return json.loads(clean_json)

    except Exception as e:
        return {"error": f"Forensic analysis failed: {str(e)}"}
    
    
@analysis_router.post("/get-doc-analysis")
async def get_document_analysis (docId: str = Form(...)):
    try:
        doc_ref = db.collection(structure_analysis_collection).where("documentId","==",docId)
        
        docs = doc_ref.get()
        if docs:
            doc_data = docs[0].to_dict()
            return {"success":True,"data":doc_data}
        
    except Exception as e:
        print("Error occur while fetching document analysis: ",e)
        return {"success":False}
    
        
    
        
    
    