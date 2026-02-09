import os
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from dotenv import load_dotenv

# Force load the .env file from the app folder, just like the test script did
load_dotenv(dotenv_path="app/.env")

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
    
    message = MessageSchema(
        subject="TrustLens Analysis Report",
        recipients=[email],
        body=f"<h3>Analysis Complete</h3><p>Attached is the forensic report for <strong>{file.filename}</strong>.</p>",
        subtype=MessageType.html,
        attachments=[file]
    )

    fm = FastMail(conf)
    
    # Send in background
    background_tasks.add_task(fm.send_message, message)
    
    return {"message": "Email queued successfully"}