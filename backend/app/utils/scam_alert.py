from __future__ import annotations
 
import hashlib
import io

from typing import Optional
 
import imagehash
from PIL import Image
from datetime import datetime, timezone
from ..core.config import HIGH_TRACK_INITIAL_SCORE
import json 
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import httpx
import logging

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
 
 
def fmt_date(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%b %d, %Y")
 
 
def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
 
 
def perceptual_hash(data: bytes) -> Optional[str]:
    """
    pHash for image-based near-duplicate detection.
    Hamming distance < 10 between two hashes = same document cluster,
    even if bytes differ (scammer added whitespace / pixel noise).
    """
    try:
        return str(imagehash.phash(Image.open(io.BytesIO(data)).convert("RGB")))
    except Exception:
        return None
 
 
def hash_phone(phone: str) -> str:
    """One-way hash — no raw phone PII stored (PDPA 2010 compliance)."""
    return hashlib.sha256(phone.encode()).hexdigest()
 
 
def mime_type(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return {"pdf": "application/pdf", "png": "image/png",
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "webp": "image/webp"}.get(ext, "application/octet-stream")
 
 
def determine_track(score: float) -> str:
    if score >= HIGH_TRACK_INITIAL_SCORE:
        return "HIGH"
    if score > 0:
        return "LOW"
    return "REJECTED"

def validate_image_bytes(data: bytes, filename: str) -> tuple[bool, str]:
    """
    Check magic bytes to confirm the file is actually what the extension claims.
    Returns (is_valid, detected_format)
    """
    if len(data) < 16:
        return False, "File too small to be a valid image"

    # PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return True, "image/png"

    # JPEG magic bytes: FF D8 FF
    if data[:3] == b'\xff\xd8\xff':
        return True, "image/jpeg"

    # PDF magic bytes: %PDF
    if data[:4] == b'%PDF':
        return True, "application/pdf"

    # WEBP: RIFF....WEBP
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return True, "image/webp"

    # HTML response (Firebase returned error page instead of image)
    if data[:5] in (b'<!DOC', b'<html', b'<?xml'):
        return False, f"Firebase returned HTML, not image — token may be expired"

    # JSON response (Firebase Storage error JSON)
    if data[:1] == b'{':
        try:
            err = json.loads(data)
            return False, f"Firebase returned JSON error: {err.get('error', {}).get('message', str(err))}"
        except Exception:
            pass

    return False, f"Unknown format. Magic bytes: {data[:16].hex()}"
async def fetch_and_decrypt_file(
    fileUrl: str,
    base64_key: str,
    base64_iv: str,
) -> bytes:
    logger.info("PIPELINE [1/6] — Starting fetch from Firebase Storage...")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as http_client:
        response = await http_client.get(fileUrl)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch file: HTTP {response.status_code}")
        encrypted_bytes = response.content

    logger.info(f"PIPELINE [2/6] — Downloaded {len(encrypted_bytes)} encrypted bytes")
    logger.info(f"              — First 16 bytes: {encrypted_bytes[:16].hex()}")

    # ── Decode key and IV ─────────────────────────────────────────────────────
    try:
        key_bytes = base64.b64decode(base64_key)
        iv_bytes  = base64.b64decode(base64_iv)
        logger.info(f"PIPELINE [3/6] — Decoded key ({len(key_bytes)} bytes), IV ({len(iv_bytes)} bytes)")
    except Exception as e:
        logger.error(f"PIPELINE [3/6] FAILED — base64 decode error: {e}")
        logger.error(f"             — Raw key received: '{base64_key}'")
        logger.error(f"             — Raw IV  received: '{base64_iv}'")
        raise

    # ── Decrypt ───────────────────────────────────────────────────────────────
    try:
        aesgcm          = AESGCM(key_bytes)
        decrypted_bytes = aesgcm.decrypt(nonce=iv_bytes, data=encrypted_bytes, associated_data=None)
        logger.info(f"PIPELINE [4/6] — Decrypted successfully: {len(decrypted_bytes)} bytes")
        logger.info(f"              — Magic bytes: {decrypted_bytes[:16].hex()}")
    except Exception as e:
        logger.error(f"PIPELINE [4/6] FAILED — Decryption error: {e}")
        logger.error(f"             — Key length: {len(key_bytes)} (expected 32)")
        logger.error(f"             — IV  length: {len(iv_bytes)} (expected 12)")
        raise

    return decrypted_bytes