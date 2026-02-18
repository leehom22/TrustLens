import os
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr, BaseModel
from dotenv import load_dotenv
from pathlib import Path

class ReportRequest(BaseModel):
    user_email: EmailStr
    report_title: str
    report_content: str

BASE_DIR = Path(__file__).resolve().parent.parent # Path to Backend/
load_dotenv(BASE_DIR / ".env")


router = APIRouter()
# Use the exact same config that just worked
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_USERNAME"),
    # MAIL_USERNAME="leehom2004@gmail.com",
    # MAIL_PASSWORD="paiusltoqvjyvjsk",
    # MAIL_FROM="leehom2004@gmail.com",
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

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from fastapi_mail import FastMail, MessageSchema
from typing import Optional
import tempfile
import os

router = APIRouter()

@router.post("/send-review-report-to-user")
async def send_report(
    background_tasks: BackgroundTasks,

    email: str = Form(...),
    doc_name: str = Form(...),

    pdf_report: UploadFile = File(...),
    annotated_pdf: Optional[UploadFile] = File(None),
    annotated_image: Optional[UploadFile] = File(None),
):
    
    try:

        attachments = []

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            content = await pdf_report.read()
            temp_pdf.write(content)
            attachments.append(temp_pdf.name)

        # Save annotated PDF (if exists)
        if annotated_pdf:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_ann_pdf:
                content = await annotated_pdf.read()
                temp_ann_pdf.write(content)
                attachments.append(temp_ann_pdf.name)

        # Save annotated Image (if exists)
        if annotated_image:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_img:
                content = await annotated_image.read()
                temp_img.write(content)
                attachments.append(temp_img.name)

        message = MessageSchema(
            subject=f"Expert Review Report: {doc_name}",
            recipients=[email],
            body=f"""
            <h3>Hello,</h3>
            <p>Your expert review report for <b>{doc_name}</b> is attached.</p>
            <p>Please check the attachments.</p>
            <br>
            <p>Best regards,<br>AI Document Review Team</p>
            """,
            subtype="html",
            attachments=attachments  # ✅ Attach files
        )

        fm = FastMail(conf)

        background_tasks.add_task(fm.send_message, message)

        return {
            "success": True,
            "message": "Report is being sent to the user"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
