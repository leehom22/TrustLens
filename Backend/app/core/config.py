import os
import sys
import logging
import json
import shutil
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # Backend/app/core -> Backend/
# print(f"BASE_DIR set to: {BASE_DIR}")
load_dotenv(BASE_DIR / ".env")  # Make sure .env is loaded

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

# print(f"Current Directory: {os.getcwd()}")
# print(f"GEMINI_API_KEY exists in env: {GEMINI_API_KEY is not None} - {GEMINI_API_KEY}")
# =================== Basic Architecture Set-up =======================
# load API Key from .env
load_dotenv()

# API Key Check
class Config:
    if not GEMINI_API_KEY:
        print("CRITICAL: GOOGLE_API_KEY environment variable not set.")
    
    @staticmethod
    def setup_ai():
        if not GEMINI_API_KEY:
            raise ValueError("No GEMINI_API_KEY found in environment variables")
        pass
        

# Safety Limitation
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
PDF_ELA_MAX_PAGES = 3

# Manage the Static Evidence of heatmaps storage
EVIDENCE_DIR = "/tmp/Backend/static_evidence"
if os.path.exists(EVIDENCE_DIR):
    shutil.rmtree(EVIDENCE_DIR)   # delete the old directory
os.makedirs(EVIDENCE_DIR, exist_ok=True)   # create a new directory


# ======================== Risk Profiles ==========================
# Unified Standards:
# 1. STRICT_FINANCIAL: Bank Statements, Payslips -> No Creative Software, Strict Math/Time.
# 2. TRANSACTIONAL: Invoices, Receipts -> No Creative Software, Strict Math.
# 3. LEGAL: Contracts -> No Creative Software, Strict Time Logic.
# 4. CREATIVE_OFFICIAL: Resumes, Certificates -> Creative Software OK, Strict Hidden/Visual checks.
# - allow_creative_software: L1 structure and metadata check will be ignored in Layer 0
# - allow_screenshot: Allow the PDF file looks like screenshot
# - hard_fail_checks: One fails, considered fails, final score follows it

# Common Standard Categories 
_STRICT_FINANCIAL_RULES = {
    "description": "Official financial record (Bank/HR). Must be system-generated.",
    "allow_creative_software": False,
    "allow_screenshot": False,
    "weights": {"L1": 0.3, "L2": 0.2, "L3": 0.1, "L4": 0.4},
    "hard_fail_checks": ["software_risk", "time_paradox", "math_mismatch"]
}

_TRANSACTIONAL_RULES = {
    "description": "Commercial transaction proof.",
    "allow_creative_software": False, # Commercial docs should be standard
    "allow_screenshot": True,
    "weights": {"L1": 0.2, "L2": 0.2, "L3": 0.3, "L4": 0.3},
    "hard_fail_checks": ["math_mismatch", "time_paradox"]
}

# Full Profiles and Weightages Standard for Different Doc Types
DOC_RISK_PROFILES = {
    # --- Group 1: Personal & Creative ---
    "resume": {
        "description": "Personal branding. Visual editing expected.",
        "allow_creative_software": True,
        "allow_screenshot": False,
        "weights": {"L1": 0.05, "L2": 0.05, "L3": 0.9, "L4": 0.0},
        "hard_fail_checks": ["hidden_data_found", "ATS_Hacking"]
    },
    "certificate": {
        "description": "Official award/verification.",
        "allow_creative_software": True,
        "allow_screenshot": True,
        "weights": {"L1": 0.2, "L2": 0.5, "L3": 0.3, "L4": 0.0},
        "hard_fail_checks": ["visual_tampering"] # ELA is key here
    },

    # --- Group 2: Strict Financials (Merged Standard) ---
    "bank_statement": _STRICT_FINANCIAL_RULES,
    "payslip": _STRICT_FINANCIAL_RULES,  # Payslip uses same strict rules as Bank Statement

    # --- Group 3: Transactional (Merged Standard) ---
    "invoice": _TRANSACTIONAL_RULES,
    "receipt": _TRANSACTIONAL_RULES,
    "payment_receipt": _TRANSACTIONAL_RULES,

    # --- Group 4: Legal / Contracts ---
    "contract": {
        "description": "Legal agreement (Freelance/Employment).",
        "allow_creative_software": False, # Contracts should be Word/PDF
        "allow_screenshot": False,
        "weights": {"L1": 0.2, "L2": 0.1, "L3": 0.3, "L4": 0.4},
        "hard_fail_checks": ["time_paradox"] # Start Date > End Date is critical
    },
    # Alias for fuzzy matching
    "freelance_contract": {
        "description": "Freelance Service Agreement.",
        "allow_creative_software": False,
        "allow_screenshot": False,
        "weights": {"L1": 0.2, "L2": 0.1, "L3": 0.3, "L4": 0.4},
        "hard_fail_checks": ["time_paradox"]
    },

    # Default (Average Weightage)
    "unknown": {
        "description": "Unclassified document.",
        "allow_creative_software": False,
        "allow_screenshot": True,
        "weights": {"L1": 0.25, "L2": 0.25, "L3": 0.25, "L4": 0.25},
        "hard_fail_checks": []
    }
}


# ================= Logger for testing details ====================
# timestamp, INFO/ERROR, console messages, modules involed, request ID
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        }
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
        return json.dumps(log_record)   # dict return as JSON string

logger = logging.getLogger("TrustLens-Backend-Logger")
handler = logging.StreamHandler(sys.stdout)   # Send the logs to the terminal
handler.setFormatter(JsonFormatter())   # Set logger output formatter
logger.addHandler(handler)
logger.setLevel(logging.INFO)   # Show only from layer INF ignored DEBUG (DEBUG - INFO - WARNING - ERROR - CRITICAL)