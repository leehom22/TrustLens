import asyncio
from google import genai
from google.genai import types
from typing import Dict, Any
from ..core.config import logger, GEMINI_API_KEY
from ..utils.utils import clean_and_repair_json

async def run_layer_3_extraction(file_path: str, mime_type: str) -> Dict[str, Any]:
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    extraction_prompt = """
    You are a Forensic Document Analyst. Analyze the document image/PDF and extract structured data with forensic precision.
    
    Goal 1: Identify Document Type and Extract Key Information into structured data (JSON) as per schema.
    GOAL 2: Extract the **FULL RAW TEXT** content for later legal analysis.

    CRITICAL INSTRUCTION FOR 'RAW TEXT':
    - **IF** the document is a Contract, Agreement, Terms of Service, or Official Letter:
      -> Extract the **FULL RAW TEXT** into 'raw_document_content'. Include all clauses, fine print.
    - **IF** the document is an Invoice, Receipt, Bank Statement, or Payslip:
      -> Leave 'raw_document_content' **EMPTY** (null or ""). Focus on 'line_items'.

    CRITICAL INSTRUCTION:
    1. Distinguish between OBSERVATION (what is printed) and INFERENCE.
    2. For "line_total", extract the visual text AND the numeric value separately.
    3. Treat text lines that share a single amount as a SINGLE transaction. Do not split multi-line descriptions (e.g., "British Gas / MASTERCARD") into two separate line items. Look at the amount column to determine row boundaries.
    
    Return VALID JSON ONLY with this schema:
    {
        "doc_type": "invoice" | "receipt" | "payment_receipt" | "bank_statement" | "payslip" | "resume" | "certificate" | "contract" | "freelance_contract" | "unknown",
        "raw_document_content": "string",
        "recipient": { "name": "string", "address": "string" },
        "vendor_info": { "name": "string", "address": "string", "contact": { "email": "string", "phone": "string", "website": "string" } },
        "payment_info": { "bank_name": "string", "account_number": "string", "account_holder_name": "string", "sort_code_or_swift": "string" },
        "invoice_number": "string" or null,
        "reference_number": "string (Extract Transaction ID, Receipt No, or Reference No)",
        "dates": { "invoice_date": "string (YYYY-MM-DD)", "due_date": "string (YYYY-MM-DD)" },
        "financials": { "opening_balance": number, "closing_balance": number, "currency": "string", "subtotal_amount": number, "tax_rate_percentage_raw": number, "tax_amount": number, "total_amount": number },

        "line_items": [
            {
                "date": "string (YYYY-MM-DD)",
                "desc": "string (Combine multi-line descriptions into one string)",
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

        "COLUMN_MAPPING_RULES": [
            "IF the numeric value appears in a column labeled 'Paid out', 'Debit', or 'Withdrawals' -> You MUST output a NEGATIVE number (e.g., -60.00).",
            "IF the numeric value appears in a column labeled 'Paid in', 'Credit', or 'Deposit' -> Output a POSITIVE number.",
            "Visual Layout Priority: The extracted 'value' MUST reflect the column position.",
            "TAX_EXTRACTION: If a tax percentage is explicitly stated visually (e.g., 'TAX RATE 6%', 'SST 8%'), extract ONLY the numeric value into 'tax_rate_percentage' (e.g., output 6 or 8). Strip the '%' symbol. If no rate is visible, output null."
        ]
    """
    
    for attempt in range(2): 
        try:
            file_ref = await client.aio.files.upload(file=file_path, config={'mime_type': mime_type})
            
            res = await client.aio.models.generate_content(
                model='gemini-3-flash-preview',
                contents=[file_ref, extraction_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            raw_text = res.text
            parsed = clean_and_repair_json(raw_text)
            
            # Metadata injection
            parsed["_meta"] = {
                "model": "gemini-2.0-flash",
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