import os
import uuid
import tempfile
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .utils.config import Config
# Import internal modules
from .utils.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, EVIDENCE_DIR, DOC_RISK_PROFILES
from .utils.schemas import FinalReport, LayerStatus, LayerResult
from .services.layer1 import run_layer_1_metadata
from .services.layer2 import run_layer_2_ela
from .services.layer3 import run_layer_3_extraction
from .services.layer4 import run_layer_4_logic
from .services.layer0 import run_layer_0_judge

from .routers.feedback import feedback_router
# ======================= Backend API set-up =====================================
app = FastAPI(title="TrustLens Backend")
Config.setup_ai()
# An endpoint for frontend to access the saved heatmap
app.mount("/evidence", StaticFiles(directory=EVIDENCE_DIR), name="evidence")

# Allow all(*) terminals / frontend terminal can access data in this terminal
# In deploy environment have to alter * into frontend HTTP address
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routing: An endpoint wait for response to POST request from frontend
@app.post("/analyze", response_model=FinalReport)

async def analyze_document(request: Request, file: UploadFile = File(...)):
    req_id = str(uuid.uuid4())    # generate an ID for every doc as reference
    logger.info(f"Start Analysis", extra={"request_id": req_id, "filename": file.filename})   # initiate logger

    # Security check for invalid or unsafe file source
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {ALLOWED_MIME_TYPES}")

    with tempfile.TemporaryDirectory() as temp_dir:

        # Spilt the original filename and .filetype, to insert req_id in between, 
        # for generating a new unique temporary path for every files
        ext = os.path.splitext(file.filename)[1]
        temp_path = os.path.join(temp_dir, f"{req_id}{ext}")
        
        # Stream save: Read and save the file in binary 1MB(1024*1024) by 1MB (chunk) through RAM into Hard Disk(buffer)
        # - prevent RAM Out Of Memory
        # - allow multiple 1MB datas handling by different user at the same time 
        size = 0
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (Max 10MB)")
                buffer.write(chunk)
        

        # ====================== Pipeline Execution =======================
        evidence_chain = []
        
        # [Step 1] Layer 3: Extraction & Classification
        logger.info("Running Layer 3 (Extraction) first for Classification...")
        l3_data = await run_layer_3_extraction(temp_path, file.content_type)
        
        # Determine Doc Type and Load Risk Profile
        doc_type_raw = l3_data.get("doc_type", "unknown").lower().replace(" ", "_")
        
        # Find the correct profile key from config
        detected_profile_key = "unknown"
        for key in DOC_RISK_PROFILES:
            if key in doc_type_raw:
                detected_profile_key = key
                break
        profile = DOC_RISK_PROFILES[detected_profile_key]
        logger.info(f"Document Classified as: {detected_profile_key.upper()}", extra={"request_id": req_id})

        
        # [Step 2] Layer 1: Metadata
        l1_res = run_layer_1_metadata(temp_path, file.content_type)
        evidence_chain.append(l1_res)
        
        # [Step 3] Layer 2: Visual ELA
        evidence_chain.append(run_layer_2_ela(temp_path, file.content_type))
            
        # [Step 4] Layer 3: Content
        # Pre-flag risks for L3 details
        l3_score = 0
        l3_status = LayerStatus.CLEAN
        
        # Resume Specific Check: Hidden Text
        if detected_profile_key == "resume" and l3_data.get("hidden_text_found"):
             l3_score = 100
             l3_status = LayerStatus.HIGH_RISK
             l3_data["risk_note"] = "Hidden text injection detected (ATS Cheating)."

        evidence_chain.append(LayerResult(
            layer_name="L3_Content", 
            status=l3_status, 
            score=l3_score, 
            details=l3_data
        ))
        
        # [Step 5] Layer 4: Logic Audit (The Brain)
        logic_required_types = ["invoice", "receipt", "payment_receipt", "bank_statement", "payslip", "contract", "freelance_contract"]
        
        if detected_profile_key in logic_required_types:
            evidence_chain.append(run_layer_4_logic(l3_data))
        else:
            evidence_chain.append(LayerResult(
                layer_name="L4_Logic", 
                status=LayerStatus.SKIPPED, 
                score=0, 
                details={"reason": f"Not applicable for {detected_profile_key}"}
            ))
            
            
        # [Step 6] Layer 0: Final Judge / Orchestrator
        judge_res = await run_layer_0_judge(detected_profile_key, evidence_chain, profile)
    
        
        # Formatting response with schemas
        report = FinalReport(
            request_id = req_id,
            timestamp = datetime.now(),
            doc_type = detected_profile_key,
            overall_risk_score = judge_res.get("overall_risk_score", 0),
            risk_level = judge_res.get("risk_level", "Unknown"),
            summary = judge_res.get("summary", "Complete."),
            evidence_chain = evidence_chain,
            recommendation = judge_res.get("recommendation", "Review")
        )
        
        # Complete logger
        logger.info("Analysis Complete", extra={"request_id": req_id, "score": report.overall_risk_score})
        return report   
        #FastAPI auto-serialization Dict into JSON, no need json.dumps

app.include_router(
    feedback_router,
    prefix="/feedback",
    tags=["Feedback"],
)

# ====================== Local Testing ===========================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)