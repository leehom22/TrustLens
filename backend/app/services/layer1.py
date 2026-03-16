from typing import Dict, Any, List
from PyPDF2 import PdfReader
from PIL import Image
from PIL.ExifTags import TAGS
import xml.etree.ElementTree as ET
import re

from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import parse_pdf_date


# ===== Source (Editor tools / Online PDF tools) =====

SOFTWARE_RISK_MAP = {
    # Professional-level image editing software that may indicate potential manipulation
    "high": [
        "photoshop", "gimp", "paint", "meitu", "snapseed", "editor", 
        "illustrator", "coreldraw", "lightroom", "affinity", "pixelmator", 
        "procreate", "picsart", "photopea", "fotor", "pixlr", "inshot"
    ],
    
    # Online PDF tools and consumer-level software that may indicate non-professional handling (but not necessarily malicious)
    "medium": [
        "canva", "ilovepdf", "smallpdf", "foxyutils", "phantompdf", "camscanner",
        "sejda", "pdf24", "pdfescape", "soda pdf", "pdfcandy", "pdfelement", 
        "wondershare", "easepdf", "foxit", "nitro pro", "adobe scan", 
        "vflat", "tapscanner", "figma", "sketch", "visme"
    ]
}

SOFTWARE_WHITELIST = [
    # Common printer drivers and PDF generators
    "canon", "hp", "brother", "epson", "xerox", "ricoh", "lexmark", 
    "konica", "kyocera", "fujitsu", "scansnap",
    
    # Common document creation and editing software
    "microsoft word", "excel", "powerpoint", "google docs", "google sheets", 
    "libreoffice", "openoffice", "pages", "numbers", "acrobat distiller",
    
    # Common enterprise software that may generate PDFs
    "sap", "oracle", "salesforce", "workday", "netsuite", "xero", 
    "quickbooks", "concur", "jasperreports", "crystal reports",
    
    # Common PDF libraries and engines
    "itext", "tcpdf", "fpdf", "mpdf", "pdfkit", "reportlab", 
    "wkhtmltopdf", "ghostscript", "dompdf",
    
    # Common rendering engines and frameworks that may appear in metadata but are not necessarily risky
    "quartz", "skia", "chromium", "mozilla", "webkit", "cairo"
]


# =============== Structural Check Function ==================
def analyze_pdf_structure(file_path: str, reader=None) -> Dict[str, Any]:

    result = {
        "eof_count": 0, 
        "has_incremental_updates": False, 
        "hidden_data_found": False,
        "low_dpi_detected": False,
        "font_multiple_subsets": False,
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

        # 2. Object-Level Analysis (Image DPI, Fonts Only)
        if reader and reader.pages:
            low_dpi_count = 0
            font_names = []

            for page in reader.pages:
                page_width_pt = float(page.mediabox.width)
                page_width_inch = page_width_pt / 72.0 if page_width_pt > 0 else 8.27

                if "/Resources" in page and "/XObject" in page["/Resources"]:
                    xobjects = page["/Resources"]["/XObject"].get_object()
                    for obj in xobjects.values():
                        if obj.get_object().get("/Subtype") == "/Image":
                            img_width = obj.get_object().get("/Width", 0)
                            if img_width and page_width_inch > 0:
                                dpi = float(img_width) / page_width_inch
                                if dpi < 150:
                                    low_dpi_count += 1
                
                if "/Resources" in page and "/Font" in page["/Resources"]:
                    fonts = page["/Resources"]["/Font"].get_object()
                    for font in fonts.values():
                        f_name = font.get_object().get("/BaseFont", "")
                        if f_name: font_names.append(str(f_name))

            # A. Low DPI Forensic
            if low_dpi_count > 0:
                result["low_dpi_detected"] = True
                result["structure_note"].append(f"DPI ANOMALY: Found {low_dpi_count} image(s) with < 150 DPI. Highly indicative of a screenshot or web compression.")

            # B. Font Subset Anomaly
            base_fonts = {}
            for f in font_names:
                match = re.search(r'\+([A-Za-z0-9\-]+)', f)
                if match:
                    core_font = match.group(1)
                    if core_font in base_fonts and base_fonts[core_font] != f:
                        result["font_multiple_subsets"] = True
                        result["structure_note"].append(f"FONT TRACE: Multiple subsets of '{core_font}' detected (Possible localized editing).")
                        break
                    base_fonts[core_font] = f

    except Exception as e:
        result["error"] = str(e)
    
    result["structure_note"] = " | ".join(result["structure_note"])
    return result


# ========================= Layer 1 Export Function ===========================
def run_layer_1_metadata(file_path: str, file_type: str) -> LayerResult:
    details = {}
    score = 0
    risk_factors = []   # Explaination Source

    try:
        # ===================== PDF Deep Analysis ======================
        if file_type == "application/pdf":

            reader = PdfReader(file_path)
            meta = reader.metadata or {}

            # Checking 1 : Structural Check
            struct = analyze_pdf_structure(file_path, reader)
            details["structure"] = struct
            details["hidden_data_found"] = struct.get("hidden_data_found", False)
            
            # Evaluation 1: Structural Check Result
            if struct.get("risk_signal") == "high":
                score += 40
                if struct.get("hidden_data_found"):
                    risk_factors.append("STRUCTURE_HIDDEN_DATA")
                else:
                    risk_factors.append("STRUCTURE_CORRUPTED_EOF")

            if struct.get("low_dpi_detected"):
                score += 15
                risk_factors.append("STRUCTURE_LOW_DPI_IMAGE")
            
            if struct.get("has_incremental_updates"):
                risk_factors.append("STRUCTURE_INCREMENTAL_UPDATES")
                
            if struct.get("font_multiple_subsets"):
                score += 5
                risk_factors.append("STRUCTURE_FONT_MULTIPLE_SUBSETS")
            
            # Checking 2: MetaData Check
            reader = PdfReader(file_path)
            meta = reader.metadata or {}
            
            producer = meta.get("/Producer", "").strip()
            creator = meta.get("/Creator", "").strip()
            details["producer_raw"] = producer

            p_lower = producer.lower()
            c_lower = creator.lower()
            full_meta_str = f"{p_lower} {c_lower}"

            found_high = []
            found_medium = []
            
            # Evaluation 2: High Risk Tools and Medium Risk Tools
            is_whitelisted = any(safe in full_meta_str for safe in SOFTWARE_WHITELIST)
            if not is_whitelisted:
                found_high = [t for t in SOFTWARE_RISK_MAP["high"] if t in full_meta_str]
                found_medium = [t for t in SOFTWARE_RISK_MAP["medium"] if t in full_meta_str]
                if found_high:
                    score += 35
                    risk_factors.append("HIGH_METADATA_SOFTWARE_RISK")
                    details["software_risk"] = f"Edited with high-risk image software: {found_high[0]}"
                elif found_medium:
                    score += 15
                    risk_factors.append("MEDIUM_METADATA_SOFTWARE_RISK")
                    details["software_risk"] = f"Processed by consumer tool: {found_medium[0]}"
            
            # Evaluation 1 + 2: Contextualize (Risk Increases when both incremental updates and tools exist)
            if (struct.get("has_incremental_updates") or struct.get("font_multiple_subsets")) and (found_high or found_medium):
                score += 10
                risk_factors.append("Incremental updates detected alongside non-standard PDF producer.")

            # Checking 3: Time Paradox
            c_date = parse_pdf_date(meta.get("/CreationDate"))
            m_date = parse_pdf_date(meta.get("/ModDate"))

            if c_date: details["pdf_creation_date"] = c_date.isoformat()
            if m_date: details["pdf_mod_date"] = m_date.isoformat()
            
            # Evaluation 3
            if c_date and m_date:
                delta = (c_date - m_date).total_seconds()
                if delta > 60: 
                    score = 95
                    msg = f"CRITICAL: Logical Time Paradox. Created {int(delta)}s AFTER Modified."
                    risk_factors.append("TIME_PARADOX_METADATA")
                    details["time_paradox"] = msg

        # ================= Checking 4: Deep XMP Forensic Graph =================
            try:
                if "/Metadata" in reader.trailer["/Root"]:
                    xmp_raw = reader.trailer["/Root"]["/Metadata"].get_data()
                    root = ET.fromstring(xmp_raw)
                    xmp_details = {}
                    history_count = 0
                    
                    for elem in root.iter():
                        tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                        
                        if tag == 'CreateDate' and 'CreateDate' not in xmp_details: xmp_details['CreateDate'] = elem.text
                        elif tag == 'ModifyDate' and 'ModifyDate' not in xmp_details: xmp_details['ModifyDate'] = elem.text
                        elif tag == 'MetadataDate' and 'MetadataDate' not in xmp_details: xmp_details['MetadataDate'] = elem.text
                        elif tag == 'CreatorTool' and 'CreatorTool' not in xmp_details: xmp_details['CreatorTool'] = elem.text
                        elif tag in ['DerivedFrom', 'documentID'] and 'DerivedFrom' not in xmp_details: xmp_details['DerivedFrom'] = elem.text
                        elif tag == 'li' and 'History' in str(elem.tag): 
                            history_count += 1

                    if history_count > 0: xmp_details["HistoryEntries"] = history_count

                    if xmp_details:
                        details["xmp_data"] = xmp_details
                        xmp_score = 0
                        
                        if xmp_details.get("MetadataDate") and xmp_details.get("ModifyDate") and xmp_details["MetadataDate"] != xmp_details["ModifyDate"]:
                            xmp_score += 15
                            risk_factors.append("XMP_METADATA_MANIPULATION")
                        
                        x_derived = xmp_details.get("DerivedFrom", "")
                        if x_derived and any(ext in x_derived.lower() for ext in ['.jpg', '.png', 'screenshot', 'image', 'capture']):
                            xmp_score += 25
                            risk_factors.append("XMP_SUSPICIOUS_ORIGIN")
                        
                        x_creator = xmp_details.get("CreatorTool", "")
                        if x_creator and any(t in x_creator.lower() for t in SOFTWARE_RISK_MAP["high"]):
                            xmp_score += 10
                            risk_factors.append("XMP_HIGH_RISK_CREATOR")
                            
                        if history_count > 2:
                            xmp_score += 10
                            risk_factors.append("XMP_EXTENSIVE_EDIT_HISTORY")
                            
                        if xmp_score > 0:
                            score += xmp_score

            except Exception as e:
                pass

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
                            risk_factors.append(f"Image edited with: {found_high[0]}")

    except Exception as e:
        return LayerResult(layer_name="L1_Metadata", status=LayerStatus.ERROR, score=0, details={"error": str(e)})


    # =================== Final Output ===================
    status = LayerStatus.CLEAN
    if score > 70: status = LayerStatus.HIGH_RISK
    elif score > 30: status = LayerStatus.SUSPICIOUS
    
    if risk_factors:
        details["risk_factors"] = "; ".join(risk_factors)

    return LayerResult(
        layer_name = "L1_Metadata", 
        status = status, 
        score = min(score, 100), 
        risk_signals = risk_factors,
        details = details
    )