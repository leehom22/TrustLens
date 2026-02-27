# setup 
env: put .env under /app
env: dont put "" for the API KEY

# run the server (at Backend path)
python -m app.main
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# to put the env variable in a file, use the following code
<!-- can refer file: routers/user.py at function 'signIn_user' -->
        BASE_DIR = Path(__file__).resolve().parent.parent  # Backend/app/core -> Backend/
        load_dotenv(BASE_DIR / ".env")  # Make sure .env is loaded

        API_KEY = os.getenv("API_KEY")
        if not API_KEY:
            raise ValueError("API_KEY not found in .env")

# put 'serviceAccountKey.json' under /app (to connect with firestore db)

# testing endpoint (eg: Postman)
http://127.0.0.1:8000/

# Backend Testing
# - Set-up Test (Terminal)
python Backend/run.py
# - Endpoint Test
http://127.0.0.1:8000/docs


// README.md

⚙️ TrustLens Backend (AI Engine)
The core logic layer that orchestrates Gemini AI and Deepgram to verify document integrity.

🧠 Core Logic
Gemini AI: Performs visual forensic analysis on document pixels and metadata.

Deepgram: Used for voice-authenticated document release or audio-log analysis.

Firebase: Stores document metadata and manages file triggers.

FastAPI Mail: Sends instant "High-Risk" alerts to administrators when forgery is detected.

🛠️ Installation & API
Navigate to folder: cd backend

Create virtual environment: python -m venv venv && source venv/bin/activate

Install dependencies: pip install -r requirements.txt

Environment Variables:

GOOGLE_API_KEY=your_gemini_key
DEEPGRAM_API_KEY=your_deepgram_key
FIREBASE_SERVICE_ACCOUNT=path_to_json
MAIL_USERNAME=your_email


📡 API Endpoints (Core)

Method,Endpoint,Description
POST,/analyze,Uploads document for Gemini forensic analysis.
POST,/verify-voice,Processes Deepgram audio for biometric confirmation.
GET,/report/{id},Fetches a specific forgery detection report.
