import os
import asyncio
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from dotenv import load_dotenv

# 1. Load your .env file
load_dotenv(dotenv_path="app/.env")

# 2. Print what we found (to check for typos)
print(f"User: {os.getenv('MAIL_USERNAME')}")
print(f"Pass: {os.getenv('MAIL_PASSWORD')}")

# 3. Configure
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

async def send_test():
    print("Attempting to connect to Gmail...")
    message = MessageSchema(
        subject="TrustLens Test Email",
        recipients=[os.getenv("MAIL_USERNAME")], # Send to yourself
        body="<h1>It Works!</h1><p>Your backend can send emails.</p>",
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    print("✅ Email Sent Successfully! Check your inbox.")

if __name__ == "__main__":
    asyncio.run(send_test())