import asyncio
import google.generativeai as genai
from typing import Dict, Any
from ..config import logger
from ..utils import clean_and_repair_json

async def run_layer_3_extraction(file_path: str, mime_type: str) -> Dict[str, Any]:
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    extraction_prompt = """
    You are a Forensic Document Analyst. Analyze the document image/PDF and extract structured data with forensic precision.
    
    Goal: Identify Document Type and Extract Key Information.

    CRITICAL INSTRUCTION:
    1. Distinguish between OBSERVATION (what is printed) and INFERENCE.
    2. For "line_total", extract the visual text AND the numeric value separately.
    
    Return VALID JSON ONLY with this schema:
    {
        "doc_type": "invoice" | "receipt" | "payment_receipt" | "bank_statement" | "payslip" | "resume" | "certificate" | "contract" | "freelance_contract" | "unknown",
        "recipient": { "name": "string", "address": "string" },
        "vendor_info": { "name": "string", "address": "string", "contact": { "email": "string", "phone": "string", "website": "string" } },
        "payment_info": { "bank_name": "string", "account_number": "string", "account_holder_name": "string", "sort_code_or_swift": "string" },
        "invoice_number": "string" or null,
        "dates": { "invoice_date": "string (YYYY-MM-DD)", "due_date": "string (YYYY-MM-DD)" },
        "financials": { "currency": "string", "subtotal_amount": number, "tax_amount": number, "total_amount": number },

        "line_items": [
            {
                "desc": "string",
                "qty": number, 
                "unit_price": number,
                "line_total": { "value": number, "raw_text": "string" }
            }
        ],
        
        "visual_elements": {
            "has_status_bar": boolean,
            "has_browser_chrome": boolean,
            "has_cursor_mouse": boolean,
            "mixed_fonts": boolean,
            "misaligned_layout": boolean
        },

        "risk_inference": {
            "is_screenshot": boolean,
            "urgency_language": boolean,
            "hidden_text_found": boolean  // True if white-on-white text or tiny keywords found (Resume ATS hacking)
        }
    }
    """
    
    for attempt in range(2): 
        try:
            sample_file = genai.upload_file(file_path, mime_type=mime_type)
            res = await asyncio.wait_for(
                model.generate_content_async([sample_file, extraction_prompt]), 
                timeout=15.0
            )

            raw_text = res.text
            parsed = clean_and_repair_json(raw_text)
            
            # Metadata injection
            parsed["_meta"] = {
                "model": "gemini-2.5-flash",
                "attempt": attempt + 1,
                "json_repaired": True if raw_text.strip() != str(parsed) else False
            }
            
            if "doc_type" not in parsed: parsed["doc_type"] = "unknown"
            
            # [COMPATIBILITY FIX]: Flatten keys for main.py
            vis = parsed.get("visual_elements", {})
            inf = parsed.get("risk_inference", {})
            
            # 1. Screenshot Logic
            parsed["is_screenshot"] = vis.get("has_status_bar") or vis.get("has_browser_chrome") or inf.get("is_screenshot", False)
            
            # 2. Hidden Text Logic (for main.py Resume check)
            parsed["hidden_text_found"] = inf.get("hidden_text_found", False)
            
            return parsed
        
        except Exception as e:
            logger.warning(f"L3 Retry {attempt+1}: {e}")
            await asyncio.sleep(0.5)
            
    # Fallback
    return {
        "doc_type": "unknown", 
        "error": "Extraction failed",
        "hidden_text_found": False,
        "is_screenshot": False
    }