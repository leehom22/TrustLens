import os
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr, BaseModel
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional
import tempfile

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
    
    # --- CLEAN UP THE FILENAME ---
    # This removes '_Report.pdf' so it just shows the original file name
    display_name = file.filename.replace("_Report.pdf", "")
    
    # --- UPDATED MESSAGE SCHEMA ---
    message = MessageSchema(
        subject="TrustLens Analysis Report",
        recipients=[email],
       body=f"""
            <div style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding:30px;">
                <div style="max-width:600px; background:#ffffff; padding:30px; border-radius:8px;">
                    
                    <h2 style="color:#1f2937; margin-top:0;">TrustLens Analysis Completed</h2>
                    
                    <p>Dear User,</p>
                    
                    <p>
                    The analysis for <strong>{display_name}</strong> has been completed successfully.
                    </p>
                    
                    <p>Please access your dashboard to review the full forensic report:</p>
                    
                    <p style="text-align:center; margin:30px 0;">
                    <a href="https://trustlens-632fa.web.app/history"
                        style="background-color:#2563eb; color:#ffffff; padding:12px 24px;
                        text-decoration:none; border-radius:6px; font-weight:bold;">
                        View Analysis
                    </a>
                    </p>
                    
                    <p>
                    If you did not request this service, please ignore this message.
                    </p>
                    
                    <p>
                        Best regards,<br>
                        <strong>TrustLens AI Forensic Team</strong>
                    </p>
                    
                    <hr style="border:none; border-top:1px solid #eeeeee; margin:20px 0;">
                    
                    <p style="font-size:12px; color:#888;">
                    This is an automated notification. Please do not reply.
                    </p>
                    
                </div>
            </div>
            """,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    
    # Send in background
    background_tasks.add_task(fm.send_message, message)
    
    return {"message": "Email queued successfully"}


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
                <div style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding:30px;">
                    <div style="max-width:650px; margin:auto; background:#ffffff; padding:35px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">

                        <h2 style="margin-top:0; color:#1f2937;">
                         Expert Review Report Completed
                        </h2>

                        <p>Dear User,</p>

                        <p>
                            The expert forensic review for the document 
                            <strong>{doc_name}</strong> has been completed.
                        </p>

                        <p>
                            Please find the detailed review report and supporting annotated files attached to this email.
                            The report includes professional findings, risk assessments, and highlighted areas of concern (if applicable).
                        </p>

                        <div style="background:#f9fafb; padding:15px; border-radius:6px; margin:20px 0;">
                            <strong>Included Attachments:</strong>
                            <ul style="margin:10px 0 0 20px; padding:0;">
                                <li>Official Expert Review Report (PDF)</li>
                                <li>Annotated Document (if applicable)</li>
                                <li>Annotated Image Evidence (if applicable)</li>
                            </ul>
                        </div>

                        <p>Please access your dashboard to review the full forensic report:</p>
                            <p style="text-align:center; margin:30px 0;">
                            <a href="https://trustlens-632fa.web.app/history"
                                style="background-color:#2563eb; color:#ffffff; padding:12px 24px;
                                text-decoration:none; border-radius:6px; font-weight:bold;">
                                View Analysis
                            </a>
                        </p>
                        <p>
                            If you have any questions regarding this review, please contact our support team.
                        </p>

                        <br>

                        <p>
                            Best regards,<br>
                            <strong>TrustLens Forensic Expert Team</strong><br>
                            Digital Document Intelligence & Risk Assessment
                        </p>

                        <hr style="border:none; border-top:1px solid #e5e7eb; margin:25px 0;">

                        <p style="font-size:12px; color:#6b7280;">
                            This email contains confidential information intended only for the recipient.
                            If you received this message in error, please delete it immediately.
                            This is an automated notification. Please do not reply directly to this email.
                        </p>

                    </div>
                </div>
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
