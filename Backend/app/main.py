import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import cv2
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
from .routers.analysis import analysis_router
from .routers.annotate import annotate_router

# ------- Import internal modules ------
from .core.config import Config
from .core.config import EVIDENCE_DIR

# ======================= Backend API set-up =====================================
app = FastAPI(title="TrustLens Backend")
Config.setup_ai()

PORT = int(os.getenv("PORT", 8080))
print(f"The port is {PORT}")
# An endpoint for frontend to access the saved heatmap
app.mount("/evidence", StaticFiles(directory=EVIDENCE_DIR), name="evidence")

origins = [
    "http://localhost:5173",    # Your Vite/React/Vue frontend
    "http://127.0.0.1:5173",    # Sometimes browsers use the IP instead of 'localhost'
    "https://trustlens-632fa.web.app"
]

# Allow all(*) terminals / frontend terminal can access data in this terminal
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)


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

app.include_router(
    analysis_router,
    prefix="/analysis",
    tags=["Analysis"]
)

app.include_router(
    annotate_router,
    prefix="/annotate",
    tags=["Annotate"]
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
    # Cloud Run use 8080
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)