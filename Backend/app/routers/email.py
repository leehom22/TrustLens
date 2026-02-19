import os
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from dotenv import load_dotenv
from pathlib import Path

# Force load the .env file from the app folder, just like the test script did
# load_dotenv(dotenv_path="app/.env")

BASE_DIR = Path(__file__).resolve().parent.parent # Path to Backend/
load_dotenv(BASE_DIR / ".env")


router = APIRouter()

# Use the exact same config that just worked
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_USERNAME"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

@router.post("/send-report")
async def send_report(
    background_tasks: BackgroundTasks,
    email: EmailStr = Form(...),
    file: UploadFile = File(...)
):
    print(f"📩 Processing email request for: {email}") # Log to terminal
    
    # --- CLEAN UP THE FILENAME ---
    # This removes '_Report.pdf' so it just shows the original file name
    display_name = file.filename.replace("_Report.pdf", "")
    
    # --- UPDATED MESSAGE SCHEMA ---
    message = MessageSchema(
        subject="TrustLens Analysis Report",
        recipients=[email],
        body=f"<p>Analysis for <strong>{display_name}</strong> is ready.</p>",
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    
    # Send in background
    background_tasks.add_task(fm.send_message, message)
    
    return {"message": "Email queued successfully"}