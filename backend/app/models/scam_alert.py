from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid
from enum import Enum
import json
 
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional
 
from google import genai
from google.genai import types
import imagehash
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field
 
from app.prompts.scam_analysis_prompt import ANALYSIS_PROMPT
from app.core.firebase import db  
from app.utils.scam_alert import mime_type, utcnow, fetch_and_decrypt_file, validate_image_bytes
import logging

# Pydantic Schema 

# Top-level collection references
DOCS_COL        = db.collection("master_documents")
DOCS_COL_NAME   = "master_documents"
ADMIN_QUEUE_COL = db.collection("admin_queue")
ADMIN_QUEUE_COL_NAME = "admin_queue"
COMMENTS_COL    = db.collection("comments")
COMMENTS_COL_NAME    = "comments"
REPORTS_SUBCOL  = "reports"
REPORTS_SUBCOL_NAME  = "reports"

class MalaysiaState(str, Enum):
    JOHOR = "Johor"
    KEDAH = "Kedah"
    KELANTAN = "Kelantan"
    MELAKA = "Melaka"
    NEGERI_SEMBILAN = "Negeri Sembilan"
    PAHANG = "Pahang"
    PERAK = "Perak"
    PERLIS = "Perlis"
    PULAU_PINANG = "Pulau Pinang"
    SABAH = "Sabah"
    SARAWAK = "Sarawak"
    SELANGOR = "Selangor"
    TERENGGANU = "Terengganu"
    KUALA_LUMPUR = "Kuala Lumpur"
    LABUAN = "Labuan"
    PUTRAJAYA = "Putrajaya"
    

class AnalysisResult(BaseModel):
    document_id:      str
    document_type:    str
    threat_category:  str
    ai_confidence:    float = Field(..., ge=0, le=100)
    scam_indicators:  list[str]
    redacted_preview: str
    reasoning:        str
    is_suspicious:    bool
 
 
class ReportRequest(BaseModel):
    documentId: str
    phone:   str   # OTP-verified phone; only the SHA-256 hash is stored
    state:       str
    comment: str
 
 
class ReportResponse(BaseModel):
    report_id:        str
    masterDocId:      str
    track:            str
    message:          str
    ai_confidence:    float
    report_count:     int
    queued_for_admin: bool
 
 
class PublishedAlert(BaseModel):
    id:               str
    title:            str
    documentType:    str
    threatCategory:  str
    aiConfidence:    float
    reportCount:     int
    avg_report_score: float
    state:  list[str]
    scamIndicators:  list[str]
    redactedPreview: str
    is_national:      bool
    firstFlagged:    str
    lastSeen:        str
    published_at:     Optional[str]
    riskLevel:str
 
 
class AdminDecision(BaseModel):
    document_id: str
    decision:    str            # "APPROVED" | "REJECTED"
    reviewer:    str
    notes:       Optional[str] = None
 
 
class CommentRequest(BaseModel):
    document_id: str
    user_name:   str
    user_id: str
    text:        str
 
 
class CommentResponse(BaseModel):
    comment_id:  str
    document_id: str
    user_name:   str
    text:        str
    created_at:  str
    helpful:     int

client = genai.Client()
logger = logging.getLogger(__name__)

async def analyze_with_gemini(
    fileUrl: str,
    filename: str,
    base64_key: str,
    base64_iv: str,
) -> dict:

    # ── Decrypt ───────────────────────────────────────────────────────────────
    file_bytes = await fetch_and_decrypt_file(fileUrl, base64_key, base64_iv)

    # ── Validate ──────────────────────────────────────────────────────────────
    is_valid, detected_mime = validate_image_bytes(file_bytes, filename)
    logger.info(f"PIPELINE [5/6] — Validation: valid={is_valid}, mime={detected_mime}")
    if not is_valid:
        logger.error(f"PIPELINE [5/6] FAILED — {detected_mime}")
        raise Exception(f"Decrypted file is not a valid image: {detected_mime}")

    # ── Gemini ────────────────────────────────────────────────────────────────
    logger.info("PIPELINE [6/6] — Sending to Gemini...")
    file_part = types.Part.from_bytes(data=file_bytes, mime_type=detected_mime)
    text_part = types.Part.from_text(text=ANALYSIS_PROMPT)

    try:
        resp = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=[types.Content(role="user", parts=[text_part, file_part])],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )
        logger.info("PIPELINE [6/6] — Gemini responded successfully")
        logger.info(f"              — Response preview: {resp.text[:200]}")
    except Exception as e:
        logger.error(f"PIPELINE [6/6] FAILED — Gemini error: {type(e).__name__}: {e}")
        raise

    raw = resp.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())

# ──────────────────────────────────────────────────────────────────────────────
# Firestore — Document Helpers
# ──────────────────────────────────────────────────────────────────────────────
 
def find_duplicate(file_sha256: str, phash: Optional[str]) -> Optional[dict]:
    """
    1. Exact SHA-256 match (fast O(1)-ish index lookup).
    2. pHash near-duplicate scan (O(n) — acceptable at hackathon scale;
       use a vector index or dedicated service in production).
    Returns document dict with injected 'id', or None.
    """
    # Exact match
    for snap in DOCS_COL.where(filter=FieldFilter("file_hash", "==", file_sha256)).limit(1).stream():
        return {**snap.to_dict(), "id": snap.id}
 
    # Near-duplicate via perceptual hash
    if phash:
        target = imagehash.hex_to_hash(phash)
        for snap in DOCS_COL.where(filter=FieldFilter("perceptual_hash", "!=", None)).stream():
            stored = snap.to_dict().get("perceptual_hash")
            if stored:
                try:
                    if (target - imagehash.hex_to_hash(stored)) < 10:
                        return {**snap.to_dict(), "id": snap.id}
                except Exception:
                    pass
    return None
 
 
def get_doc(doc_id: str) -> Optional[dict]:
    snap = DOCS_COL.document(doc_id).get()
    return {**snap.to_dict(), "id": snap.id} if snap.exists else None
 
 
def create_doc(data: dict) -> str:
    doc_id = str(uuid.uuid4())
    DOCS_COL.document(doc_id).set(data)
    return doc_id
 
 
def update_doc(doc_id: str, fields: dict):
    DOCS_COL.document(doc_id).update(fields)
 
 
# ──────────────────────────────────────────────────────────────────────────────
# Firestore — Reports Sub-collection Helpers
# /documents/{doc_id}/reports/{report_id}
# ──────────────────────────────────────────────────────────────────────────────
 
def _reports_ref(doc_id: str):
    return DOCS_COL.document(doc_id).collection(REPORTS_SUBCOL)
 
 
def get_all_reports(doc_id: str) -> list[dict]:
    return [{**r.to_dict(), "id": r.id} for r in _reports_ref(doc_id).stream()]
 
 
def get_report_by_phone(doc_id: str, phone_hash: str) -> Optional[dict]:
    for r in _reports_ref(doc_id).where(
        filter=FieldFilter("user_phone_hash", "==", phone_hash)
    ).limit(1).stream():
        return {**r.to_dict(), "id": r.id}
    return None
 
 
def create_report(doc_id: str, data: dict) -> str:
    rid = str(uuid.uuid4())
    _reports_ref(doc_id).document(rid).set(data)
    return rid
 
 
def report_velocity(doc_id: str, window_hours: int = 1) -> float:
    """Reports submitted in the last N hours — spike = possible bot manipulation."""
    cutoff = utcnow() - timedelta(hours=window_hours)
    return float(sum(
        1 for _ in _reports_ref(doc_id)
        .where(filter=FieldFilter("reported_at", ">=", cutoff))
        .stream()
    ))
 
 
def weighted_avg_score(reports: list[dict]) -> float:
    """
    Recency-weighted average confidence score.
    Newer reports contribute slightly more weight, so an old bot batch
    cannot dominate the average and artificially push a document over threshold.
    """
    if not reports:
        return 0.0
    sorted_r     = sorted(reports, key=lambda r: r.get("reported_at", datetime.min), reverse=True)
    total_w      = 0.0
    weighted_sum = 0.0
    for i, r in enumerate(sorted_r):
        w             = 1.0 / (1 + i * 0.05)
        weighted_sum += r.get("ai_confidence", 0) * w
        total_w      += w
    return round(weighted_sum / total_w, 2) if total_w else 0.0
 
# ──────────────────────────────────────────────────────────────────────────────
# Firestore — Admin Queue Helpers
# ──────────────────────────────────────────────────────────────────────────────
 
def get_queue_item(doc_id: str) -> Optional[dict]:
    for snap in ADMIN_QUEUE_COL.where(
        filter=FieldFilter("document_id", "==", doc_id)
    ).limit(1).stream():
        return {**snap.to_dict(), "id": snap.id}
    return None
 
 
def enqueue_for_admin(doc_id: str, note: str = ""):
    """Add to admin review queue (idempotent — skips if already queued)."""
    if get_queue_item(doc_id):
        return
    ADMIN_QUEUE_COL.document(str(uuid.uuid4())).set({
        "document_id": doc_id,
        "queued_at":   utcnow(),
        "reviewed_at": None,
        "reviewer":    None,
        "decision":    None,
        "notes":       note,
    })
    update_doc(doc_id, {"status": "REVIEW"})