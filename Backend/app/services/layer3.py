import asyncio
import google.generativeai as genai
from typing import Dict, Any
from ..core.config import logger
from ..utils.utils import clean_and_repair_json

async def run_layer_3_extraction(file_path: str, mime_type: str) -> Dict[str, Any]:
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    extraction_prompt = """
    Analyze the document image/PDF and extract structured data.
    
    Goal: Identify Document Type and Extract Key Information.
    
    Return VALID JSON ONLY with this schema:
    {
        "doc_type": "invoice" | "receipt" | "payment_receipt" | "bank_statement" | "payslip" | "resume" | "certificate" | "contract" | "freelance_contract" | "unknown",
        "vendor_name": "string (for invoices/receipts)" or null,
        "vendor_address": "string" or null,
        "tax_id": "string" or null,
        "invoice_number": "string" or null,
        "date": "string (YYYY-MM-DD)" or null,
        "total_amount": number or null,
        "currency": "string" or null,
        "line_items": [{"desc": "string", "qty": number, "unit_price": number}],
        
        "risk_signals": {
            "hidden_text_found": boolean,  // True if white-on-white text or tiny keywords found (Resume ATS hacking)
            "is_screenshot": boolean,      // True if it shows phone status bars, home indicators, or browser chrome
            "visual_anomalies": boolean    // True if layout is broken or fonts are mixed
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
            parsed = clean_and_repair_json(res.text)
            if "risk_signals" in parsed:
                parsed["hidden_text_found"] = parsed["risk_signals"].get("hidden_text_found", False)
                parsed["is_screenshot"] = parsed["risk_signals"].get("is_screenshot", False)
            if parsed.get("doc_type"): return parsed
        except Exception as e:
            logger.warning(f"L3 Retry {attempt+1}: {e}")
            await asyncio.sleep(0.5)
            
    # Fallback
    return {
        "doc_type": "unknown", 
        "error": "Extraction failed",
        "hidden_text_found": False
    }