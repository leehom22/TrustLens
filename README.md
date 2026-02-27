🔍 TrustLens: AI Document Authenticity Suite
TrustLens is an advanced document analysis platform designed to detect fraud, forgery, and tampering using Gemini AI and forensic analysis.

🏗️ Project Structure
/frontend: React-based dashboard for document uploads and report visualization. (Front End)

/backend: FastAPI server handling AI processing, file validation, and voice analysis. (Backend)

🛠️ Tech Stack
Frontend: React, TypeScript, Tailwind CSS, Firebase (Auth/Storage).

Backend: Python, FastAPI, Gemini AI, Deepgram (Voice-to-Text), Firebase Admin SDK.

Communication: REST API & fastapi-mail for automated alerts.

🚀 Quick Start
Clone the Repo: git clone https://github.com/leehom22/TrustLens.git

Environment: Set up your .env files in both subdirectories (see sub-folder READMEs).

Run Backend: cd backend && pip install -r requirements.txt && python -m app.main

Run Frontend: cd frontend && npm install && npm run dev