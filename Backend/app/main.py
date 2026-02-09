import os
import uuid
import tempfile
import asyncio
import mimetypes
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- Load Env Vars ---
# This block ensures we find the .env file whether running from root or /app
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# --- Import Routers ---
from .routers.email import router as email_router
from .routers.feedback import feedback_router
from .routers.user import user_router
from .routers.files import files_router
# This is the critical line that was missing or broken before:
from .routers.speech import router as speech_router 

from .core.config import Config
# Import internal modules
from .core.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, EVIDENCE_DIR, DOC_RISK_PROFILES
from .utils.schemas import FinalReport, LayerStatus, LayerResult
from .services.layer1 import run_layer_1_metadata
from .services.layer2 import run_layer_2_ela
from .services.layer3 import run_layer_3_extraction
from .services.layer4 import run_layer_4_logic
from .services.layer0 import run_layer_0_judge

from .routers.feedback import feedback_router
from .routers.user import user_router

# ======================= Backend API set-up =====================================
app = FastAPI(title="TrustLens Backend")
Config.setup_ai()

# An endpoint for frontend to access the saved heatmap
app.mount("/evidence", StaticFiles(directory=EVIDENCE_DIR), name="evidence")

# Allow all(*) terminals / frontend terminal can access data in this terminal
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routing: An endpoint as a tool for the AI Agent
@app.post("/analyze", response_model=FinalReport)
async def analyze_document(request: Request, file: UploadFile = File(...)):
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
        

        # ====================== Pipeline Execution (Parallelized) =======================
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
    
        
        # ================ Packing Analysis Report to AI Agent =====================
        rule_metadata = {
                "description": profile.get("description", ""),
                "hard_fail_triggers": profile.get("hard_fail_checks", []),
                "allow_screenshot": profile.get("allow_screenshot", True)
            }

        grounding_info = {}
        if l3_data:
            # Basic Info
            # Helper to safely get nested dicts
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
        )
        
        logger.info("Analysis Complete", extra={"request_id": req_id, "score": report.overall_risk_score})
        return report   

# ====================== Register Routers =======================

app.include_router(
     feedback_router,
    prefix="/feedback",
    tags=["Feedback"],
)
app.include_router(
    user_router,
    prefix='/user',
    tags=['User']
)
app.include_router(
    email_router,
    prefix="/email",
    tags=["Email"]
)
app.include_router(
    files_router,
    prefix="/files",
    tags=["Files"]   
)

# --- Register the Deepgram/Speech Router ---
# This creates the endpoint http://localhost:8000/api/deepgram
app.include_router(
    speech_router,
    prefix="/api",  
    tags=["Speech"]
)

# ====================== Local Testing ===========================
if __name__ == "__main__":
    import uvicorn
    # IMPORTANT: Ensure "app.main:app" matches your actual folder structure.
    # If your folder is named "Backend" and inside is "app", run this from "Backend" folder.
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)