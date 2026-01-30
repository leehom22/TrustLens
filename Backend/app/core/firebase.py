import os
from pathlib import Path
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load .env file
BASE_DIR = Path(__file__).resolve().parent.parent  # Backend/app/core -> Backend/
load_dotenv(BASE_DIR / ".env")  # Make sure .env is loaded

cred_filename = os.getenv("FIREBASE_CREDENTIALS")
if not cred_filename:
    raise ValueError("FIREBASE_CREDENTIALS not found in .env")

cred_path = BASE_DIR / cred_filename
if not cred_path.exists():
    raise FileNotFoundError(f"Firebase service account file not found at {cred_path}")

# Initialize Firebase
cred = credentials.Certificate(str(cred_path))
firebase_admin.initialize_app(cred)

db = firestore.client()
