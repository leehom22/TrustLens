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
       body = f"""
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TrustLens Analysis Completed</title>

            <style>
            @media only screen and (max-width: 600px) {{
                .container {{
                    width: 90% !important;
                    padding: 20px !important;
                }}
                .button {{
                    width: 100% !important;
                    padding: 14px 0 !important;
                }}
            }}
            </style>
            </head>

            <body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, sans-serif;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8;">
            <tr>
            <td align="center" style="padding: 40px 15px;">

                <!-- Main Container -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
                    class="container"
                    style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; padding:40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

                    <tr>
                        <td style="text-align:left;">

                            <h2 style="color:#1f2937; margin-top:0; font-size:24px;">
                                TrustLens Analysis Completed
                            </h2>

                            <p style="color:#4b5563; line-height:1.6;">
                                Dear User,
                            </p>

                            <p style="color:#4b5563; line-height:1.6;">
                                The analysis for <strong>{display_name}</strong> has been completed successfully.
                            </p>

                            <p style="color:#4b5563; line-height:1.6;">
                                Please access your dashboard to review the full forensic report:
                            </p>

                            <!-- Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:35px 0;">
                                <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius:6px;">
                                        <a href="https://trustlens-632fa.web.app/history"
                                        class="button"
                                        style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:bold;
                                        color:#ffffff; text-decoration:none;">
                                            View Analysis
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color:#6b7280; font-size:14px;">
                                If you did not request this service, please ignore this message.
                            </p>

                            <p style="color:#1f2937; line-height:1.6;">
                                Best regards,<br>
                                <strong>TrustLens AI Forensic Team</strong>
                            </p>

                            <hr style="border:none; border-top:1px solid #eeeeee; margin:25px 0;">

                            <p style="font-size:12px; color:#9ca3af; text-align:center;">
                                This is an automated notification. Please do not reply.
                            </p>

                        </td>
                    </tr>

                </table>

            </td>
            </tr>
            </table>

            </body>
            </html>
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
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <style>
            @media only screen and (max-width: 600px) {{
                .container {{
                    width: 92% !important;
                    padding: 20px !important;
                }}
                .mobile-padding {{
                    padding: 20px !important;
                }}
                .button {{
                    width: 100% !important;
                    padding: 14px 0 !important;
                }}
            }}
            </style>
            </head>

            <body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, sans-serif;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8;">
            <tr>
            <td align="center" style="padding:30px 15px;">

                <!-- Main Card -->
                <table role="presentation" width="650" cellspacing="0" cellpadding="0" border="0"
                    class="container"
                    style="max-width:650px; width:100%; background:#ffffff;
                            border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">

                    <tr>
                    <td class="mobile-padding" style="padding:35px; text-align:left;">

                        <h2 style="margin-top:0; color:#1f2937; font-size:22px;">
                            Expert Review Report Completed
                        </h2>

                        <p style="color:#374151; line-height:1.6;">
                            Dear User,
                        </p>

                        <p style="color:#374151; line-height:1.6;">
                            The expert forensic review for the document
                            <strong>{doc_name}</strong> has been completed.
                        </p>

                        <p style="color:#374151; line-height:1.6;">
                            Please find the detailed review report and supporting annotated files attached to this email.
                            The report includes professional findings, risk assessments, and highlighted areas of concern (if applicable).
                        </p>

                        <!-- Attachment Box -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                            style="background:#f9fafb; border-radius:6px; margin:20px 0;">
                            <tr>
                                <td style="padding:15px;">
                                    <strong>Included Attachments:</strong>
                                    <ul style="margin:10px 0 0 20px; padding:0; color:#374151;">
                                        <li>Official Expert Review Report (PDF)</li>
                                        <li>Annotated Document (if applicable)</li>
                                        <li>Annotated Image Evidence (if applicable)</li>
                                    </ul>
                                </td>
                            </tr>
                        </table>

                        <p style="color:#374151; line-height:1.6;">
                            Please access your dashboard to review the full forensic report:
                        </p>

                        <!-- Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px 0;">
                            <tr>
                                <td align="center" bgcolor="#2563eb" style="border-radius:6px;">
                                    <a href="https://trustlens-632fa.web.app/history"
                                    class="button"
                                    style="display:inline-block;
                                            padding:12px 24px;
                                            font-size:15px;
                                            font-weight:bold;
                                            color:#ffffff;
                                            text-decoration:none;">
                                        View Analysis
                                    </a>
                                </td>
                            </tr>
                        </table>

                        <p style="color:#374151; line-height:1.6;">
                            If you have any questions regarding this review, please contact our support team.
                        </p>

                        <br>

                        <p style="color:#1f2937; line-height:1.6;">
                            Best regards,<br>
                            <strong>TrustLens Forensic Expert Team</strong><br>
                            Digital Document Intelligence & Risk Assessment
                        </p>

                        <hr style="border:none; border-top:1px solid #e5e7eb; margin:25px 0;">

                        <p style="font-size:12px; color:#6b7280; line-height:1.5;">
                            This email contains confidential information intended only for the recipient.
                            If you received this message in error, please delete it immediately.
                            This is an automated notification. Please do not reply directly to this email.
                        </p>

                    </td>
                    </tr>

                </table>

            </td>
            </tr>
            </table>

            </body>
            </html>
            """,
            subtype="html",
            attachments=attachments  
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
