import json
import mimetypes
import re
from PIL import Image
from datetime import datetime
from dateutil import parser as date_parser
from fastapi import logger
from ..core.firebase import bucket

def clean_and_repair_json(json_str: str) -> dict:
    
    try:
        cleaned = re.sub(r"```json\s*", "", json_str, flags=re.IGNORECASE)
        cleaned = re.sub(r"```", "", cleaned)
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            if start != -1 and end != -1:
                return json.loads(cleaned[start:end])
        except:
            pass
        return {} 

def parse_pdf_date(date_str: str):
    if not date_str: return None
    try:
        # Remove prefix D
        clean = date_str.replace("D:", "")

        # Crop standard PDF YYYYMMDDHHMMSS format part (first 14 digits)
        if len(clean) >= 14 and clean[:14].isdigit():
            return datetime.strptime(clean[:14], "%Y%m%d%H%M%S")
        
        clean = clean.replace("'", "").replace("Z", "")
        return date_parser.parse(clean, fuzzy=True)
    except:
        return None

def downsample_image(img: Image.Image, max_dim: int = 1500) -> Image.Image:
    width, height = img.size
    if max(width, height) > max_dim:
        ratio = max_dim / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        return img.resize(new_size, Image.Resampling.LANCZOS)
    return img

# Upload file to Firebase Storage and return public URL
def upload_evidence_to_storage(local_path: str, destination_path: str, content_type: str = None) -> str:
    try:
        # Guess Mime Type
        guessed_type, _ = mimetypes.guess_type(local_path)
        if guessed_type and guessed_type != content_type:
            logger.info(f"MIME corrected: {content_type} -> {guessed_type}")
            content_type = guessed_type
        
        final_content_type = content_type or "application/octet-stream"

        # Upload to Firebase Storage
        blob = bucket.blob(destination_path)
        blob.upload_from_filename(local_path, content_type=final_content_type)
        
        # Make the file publicly accessible
        blob.make_public() 
        
        logger.info(f"Successfully uploaded to {destination_path}")
        return blob.public_url
    
    except Exception as e:
        logger.error(f"Upload Failed: {e}")
        return None