import json
import re
from PIL import Image
from datetime import datetime
from dateutil import parser as date_parser

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