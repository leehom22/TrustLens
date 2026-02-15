from typing import Dict, Any, List
from PyPDF2 import PdfReader
from PIL import Image
from PIL.ExifTags import TAGS

from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import parse_pdf_date


# ===== Source (Editor tools / Online PDF tools) =====

SOFTWARE_RISK_MAP = {
    "high": ["photoshop", "gimp", "paint", "meitu", "snapseed", "editor"],
    "medium": ["canva", "ilovepdf", "smallpdf", "foxyutils", "phantompdf", "camscanner"]
}

SOFTWARE_WHITELIST = [
    "pdf-xchange", 
    "acrobat distiller", 
    "microsoft word", 
    "canon", 
    "hp", 
    "brother" # 打印机驱动常被误报
]


# =============== Structural Check Function ==================
def analyze_pdf_structure(file_path: str) -> Dict[str, Any]:

    result = {
        "eof_count": 0, 
        "has_incremental_updates": False, 
        "hidden_data_found": False,
        "risk_signal": "none"
    }
    
    try:
        with open(file_path, "rb") as f:   # Read file in binary
            content = f.read()
            
            # 1. EOF Count => Incremental Updates
            eof_count = content.count(b'%%EOF')
            result["eof_count"] = eof_count

            if eof_count > 1:
                result["has_incremental_updates"] = True
                # Note: Increment updates may be legal such as digital signature updates
                result["structure_note"] = "File contains history of modifications (Incremental Updates)."
            elif eof_count == 0:
                result["risk_signal"] = "high"
                result["structure_note"] = "CRITICAL: No EOF marker found. File structure is corrupted or strictly truncated."
            
            # 2. Injection / Hidden Payload => Malicious tempering / changes / hacker
            last_eof_index = content.rfind(b'%%EOF')
            if last_eof_index != -1:
                # EOF usually followed by line break character / Block alignment element, it's suspicious when exists > 1KB data
                trailing_bytes = len(content) - (last_eof_index + 5) 
                if trailing_bytes > 1024: 
                    result["hidden_data_found"] = True
                    result["risk_signal"] = "high"
                    result["hidden_data_size"] = trailing_bytes
                    result["structure_note"] = (
                        f"CRITICAL: Found {trailing_bytes} bytes of hidden data after EOF. "
                        "Note: High probability of injection, but requires cross-layer semantic check."
                    )

    except Exception as e:
        result["error"] = str(e)
    
    return result


# ========================= Layer 1 Export Function ===========================
def run_layer_1_metadata(file_path: str, file_type: str) -> LayerResult:
    details = {}
    score = 0
    status = LayerStatus.CLEAN
    risk_factors = []   # Explaination Source

    try:
        # ===================== PDF Deep Analysis ======================
        if file_type == "application/pdf":

            # Checking 1 : Structural Check
            struct = analyze_pdf_structure(file_path)
            details["structure"] = struct
            
            # Evaluation 1: Structural Check Result
            if struct.get("risk_signal") == "high":
                score += 40
                status = LayerStatus.SUSPICIOUS
                risk_factors.append(struct.get("structure_note"))
            
            # Checking 2: MetaData Check
            reader = PdfReader(file_path)
            meta = reader.metadata or {}
            
            producer = meta.get("/Producer", "").strip()
            creator = meta.get("/Creator", "").strip()
            details["producer_raw"] = producer

            p_lower = producer.lower()
            c_lower = creator.lower()
            full_meta_str = f"{p_lower} {c_lower}"
            
            # Evaluation 2: High Risk Tools and Medium Risk Tools
            is_whitelisted = any(safe in full_meta_str for safe in SOFTWARE_WHITELIST)
            if not is_whitelisted:
                found_high = [t for t in SOFTWARE_RISK_MAP["high"] if t in full_meta_str]
                found_medium = [t for t in SOFTWARE_RISK_MAP["medium"] if t in full_meta_str]
                if found_high:
                    score += 35
                    status = LayerStatus.SUSPICIOUS
                    risk_factors.append(f"Edited with high-risk image software: {found_high[0]}")
                    details["software_risk"] = "High"
                elif found_medium:
                    score += 15
                    risk_factors.append(f"Processed by consumer tool: {found_medium[0]}")
                    details["software_risk"] = "Medium"
            
            # Evaluation 1 + 2: Contextualize (Risk Increases when both incremental updates and tools exist)
            if struct.get("has_incremental_updates") and (found_high or found_medium):
                score += 10
                risk_factors.append("Incremental updates detected alongside non-standard PDF producer.")

            # Checking 3: Time Paradox
            c_date = parse_pdf_date(meta.get("/CreationDate"))
            m_date = parse_pdf_date(meta.get("/ModDate"))
            
            # Evaluation 3
            if c_date and m_date:
                delta = (c_date - m_date).total_seconds()
                if delta > 60: 
                    status = LayerStatus.HIGH_RISK 
                    score = 95
                    msg = f"CRITICAL: Logical Time Paradox. Created {int(delta)}s AFTER Modified."
                    risk_factors.append(msg)
                    details["time_paradox"] = msg


        # ======================= Image Deep Analysis ==========================
        elif file_type.startswith("image/"):

            # Checking & Evaluation 1: EXIF
            with Image.open(file_path) as img:
                exif = img._getexif()
                
                if not exif:
                    # EXIF may be lost in social media sharing and screenshot
                    score += 10 
                    risk_factors.append("Metadata missing (Context: Web/Screenshot)")

                else:
                    # Checking & Evaluation 2: Checking tools from EXIF
                    readable_exif = {TAGS.get(k, k): v for k, v in exif.items()}
                    software = readable_exif.get("Software", "").lower()
                    
                    if software:
                        found_high = [t for t in SOFTWARE_RISK_MAP["high"] if t in software]
                        if found_high:
                            score += 40
                            status = LayerStatus.SUSPICIOUS
                            risk_factors.append(f"Image edited with: {found_high[0]}")

    except Exception as e:
        return LayerResult(layer_name="L1_Metadata", status=LayerStatus.ERROR, score=0, details={"error": str(e)})


    # =================== Final Output ===================
    if risk_factors:
        details["risk_factors"] = "; ".join(risk_factors)

    return LayerResult(
        layer_name = "L1_Metadata", 
        status = status, 
        score = min(score, 100), 
        risk_signals = risk_factors,
        details = details
    )