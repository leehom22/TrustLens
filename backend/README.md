⚙️ TrustLens Backend (AI Engine)
The core logic layer that orchestrates Gemini AI and Deepgram to verify document integrity.

🧠 Core Logic
Gemini AI: 

- Performs visual forensic analysis
- Analyzes document pixels, metadata, and structured content
- Supports AI chat and semantic interpretation

Firebase: 

- Stores document metadata
- Store files (in Storage)
- Handles authentication & structured data

Deepgram: 

- Supports audio-log / speech-to-text analysis

FastAPI Mail:

- Notifies users and experts about analysis results


🛠️ Installation & API

1. Navigate to folder: cd backend
2. Create virtual environment: python -m venv venv && source venv/bin/activate
3. Install dependencies: pip install -r requirements.txt


Environment Variables:

PORT = 8000
GOOGLE_API_KEY=your_gemini_key
DEEPGRAM_API_KEY=your_deepgram_key
FIREBASE_SERVICE_ACCOUNT=path_to_json
FIREBASE_CREDENTIALS=serviceAccountKey.json
MAIL_USERNAME=your_email
MAIL_PASSWORD=email_password


📡 API Endpoints (Core)

/feedback (Handling user feedback related the AI Analysis)
/user (Handling user registration and authentication)
/email (Handling email sending)
/files (Handling document upload, delete, and read operation. It also handle flagging document operation)
/chat (Handling AI Chatbot)
/analysis (Handling AI Document Analysis)
/annotate (Handling Document Annotation (by expert))
/api (Handling speech-to-text)


🚀 Architecture Role

The backend acts as:

- Deterministic forensic engine
- AI orchestration layer
- Secure document processor
- Real-time alert system
- Continuous learning interface