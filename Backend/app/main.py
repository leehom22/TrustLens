import os
import uuid
import tempfile
import asyncio
import mimetypes
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends, Query
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
from .routers.speech import router as speech_router
from .routers.chat import chat_router
from .routers.analysis import analysis_router, analyze_pipeline

# ------- Import internal modules ------
from .core.auth import get_current_user
from .core.config import Config
from .core.config import logger, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, EVIDENCE_DIR, DOC_RISK_PROFILES
from .utils.schemas import AnalysisRecord
from .services.layer1 import run_layer_1_metadata
from .services.layer2 import run_layer_2_ela
from .services.layer3 import run_layer_3_extraction
from .services.layer4 import run_layer_4_logic
from .services.layer0 import run_layer_0_judge

# ------ Import for AI and DB connection ---------
from .services.agent import run_agent_analysis
from .utils.schemas import FinalReport, AnalysisRecord
from .core.firebase import db


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
@app.post("/analyze", response_model = AnalysisRecord)
async def analyze_document(
    request: Request, 
    file: UploadFile = File(...), 
    doc_id: str = Query(..., description="The Doc ID returned from the upload_files endpoint"), # <--- 必须传 ID
    user_payload: dict = Depends(get_current_user)
):
    user_id = user_payload.get("uid")
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

        # ====================== Pipeline Execution (Parallelized) =======================




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

app.include_router(
    chat_router,
    prefix="/chat",
    tags=["Chatbot"]
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