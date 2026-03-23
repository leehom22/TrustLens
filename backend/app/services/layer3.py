import asyncio
from google import genai
from google.genai import types
from typing import Dict, Any
from ..core.config import logger, GEMINI_API_KEY
from ..utils.utils import clean_and_repair_json
import random

async def run_layer_3_extraction(file_path: str, mime_type: str, req_id: str = "unknown") -> Dict[str, Any]:
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    extraction_prompt = """
    You are a Forensic Document Analyst. Analyze the document image/PDF and extract structured data with forensic precision.
    
    Goal 1: Identify Document Type, Language, and Extract Key Information into structured data (JSON) as per schema.
    Goal 2: Perform zero-shot forensic reasoning to detect Internal Semantic Paradoxes and Scam Patterns BEFORE extracting data.
    Goal 3: Extract the **FULL RAW TEXT** content for later legal analysis when applicable.

    CRITICAL INSTRUCTION FOR 'RAW TEXT':
    - **IF** the document is a Contract, Agreement, Terms of Service, Summon, Legal Document, or Official Letter:
      -> Extract the **FULL RAW TEXT** into 'raw_document_content'. Include all clauses, fine print.
    - **IF** the document is an Invoice, Receipt, Bank Statement, or Payslip:
      -> Leave 'raw_document_content' **EMPTY** (null or ""). Focus on structured fields.

    MULTI-LANGUAGE STANDARDIZATION (CRITICAL):
    - Regardless of whether the document is in English, Bahasa Melayu (BM), or Chinese, ALL JSON Keys MUST remain in English as defined below.
    - FOR `internal_semantic_paradoxes` and `scam_pattern_analysis`, YOU MUST PROVIDE A BILINGUAL DICTIONARY {"en": "...", "ms": "..."} inside the array!

    GENERAL CRITICAL INSTRUCTION:
    1. Distinguish between OBSERVATION (what is printed) and INFERENCE.
    2. For "line_total", extract the visual text AND the numeric value separately.
    3. Treat text lines that share a single amount as a SINGLE transaction. Do not split multi-line descriptions (e.g., "British Gas / MASTERCARD") into two separate line items. Look at the amount column to determine row boundaries.

    COLUMN MAPPING & TAX RULES:
    1. IF the numeric value appears in a column labeled 'Paid out', 'Debit', or 'Withdrawals' -> You MUST output a NEGATIVE number (e.g., -60.00).
    2. IF the numeric value appears in a column labeled 'Paid in', 'Credit', or 'Deposit' -> Output a POSITIVE number.
    3. Visual Layout Priority: The extracted 'value' MUST reflect the column position.
    4. TAX_EXTRACTION: If a tax percentage is explicitly stated visually (e.g., 'TAX RATE 6%', 'SST 8%'), extract ONLY the numeric value into 'tax_rate_percentage' (e.g., output 6 or 8). Strip the '%' symbol. If no rate is visible, output null.
    
    Return VALID JSON ONLY with this schema:
    {
        "doc_type": "invoice" | "receipt" | "payment_receipt" | "bank_statement" | "payslip" | "resume" | "certificate" | "contract" | "summon" | "legal_document" | "unknown",
        
        "forensic_reasoning_trace": {
            "internal_semantic_paradoxes": [
                {
                    "en": "String in English. Explain logical contradictions (e.g. graduate 2024 but works 2020-2023).",
                    "ms": "String in Malay translation."
                }
            ],
            "scam_pattern_analysis": [
                {
                    "en": "String in English. Identify fraud patterns (e.g. urgent threats).",
                    "ms": "String in Malay translation."
                }
            ]
        },
        
        "raw_document_content": "string",
        "recipient": { "name": "string", "address": "string" },
        "extracted_ic_numbers": ["string"]
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
        
        "summon_details": {
            "issuing_agency": "string (e.g., PDRM, JPJ, DBKL, MBSA)",
            "offence_date": "string (YYYY-MM-DD HH:MM)",
            "offence_code_or_desc": "string",
            "vehicle_registration_number": "string",
            "fine_amount": number
        },

        "legal_details": {
            "party_a": { "name": "string", "role": "string" },
            "party_b": { "name": "string", "role": "string" },
            "effective_date": "string (YYYY-MM-DD)",
            "expiry_date": "string (YYYY-MM-DD)",
            "governing_law_jurisdiction": "string"
        },

        "payslip_details": {
            "gross_pay": number,
            "total_deductions": number,
            "deduction_breakdown": { "epf": number, "socso": number, "eis": number, "pcb_tax": number },
            "net_pay": number
        },

        "visual_elements": {
            "has_status_bar": boolean,
            "has_browser_chrome": boolean,
            "has_cursor_mouse": boolean,
            "mixed_fonts": boolean,
            "misaligned_layout": boolean
        },

        "risk_inference": {
            "is_screenshot": boolean,
            "has_scam_pattern": boolean,  // Set to true if scam_pattern_analysis contains urgency threats
            "has_semantic_paradox": boolean,
            "hidden_text_found": boolean  // True if white-on-white text or tiny keywords found (Resume ATS hacking)
        }
    }

    """
    
    max_attempts = 2

    for attempt in range(max_attempts): 
        try:
            file_ref = await client.aio.files.upload(file=file_path, config={'mime_type': mime_type})
            
            res = await client.aio.models.generate_content(
                model='gemini-3-flash-preview',
                contents=[file_ref, extraction_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    http_options={'timeout': 45000}
                )
            )

            raw_text = res.text
            parsed = clean_and_repair_json(raw_text)

            if isinstance(parsed, list):
                parsed = {"items": parsed, "doc_type": "unknown"}
            
            # Metadata injection
            parsed["_meta"] = {
                "model": "gemini-3-flash-preview",
                "attempt": attempt + 1,
                "json_repaired": True if raw_text.strip() != str(parsed) else False
            }
            
            if "doc_type" not in parsed: parsed["doc_type"] = "unknown"
            
            # [COMPATIBILITY FIX]: Flatten keys for main.py
            vis = parsed.get("visual_elements", {})
            inf = parsed.get("risk_inference", {})
            
            # 1. Screenshot Logic
            parsed["is_screenshot"] = vis.get("has_status_bar") or vis.get("has_browser_chrome") or inf.get("is_screenshot", False)
            
            # 2. Forensic Reasoning Logic
            parsed["has_scam_pattern"] = inf.get("has_scam_pattern", False)
            parsed["has_semantic_paradox"] = inf.get("has_semantic_paradox", False)
            
            return parsed
        
        except Exception as e:
            error_type = type(e).__name__
            logger.warning(f"[req: {req_id}] L3 Attempt {attempt+1} failed ({error_type}): {e}")
            
            if attempt < max_attempts - 1:
                # Avoid concurrency conflict
                sleep_time = 0.5 + attempt + random.uniform(0, 0.3)
                await asyncio.sleep(sleep_time)

        finally:
            # Remove remote document in Gemini for privacy
            if file_ref:
                try:
                    await client.aio.files.delete(name=file_ref.name)
                    logger.debug(f"[req: {req_id}] Successfully purged remote file: {file_ref.name}")
                except Exception as cleanup_err:
                    logger.warning(f"[req: {req_id}] Failed to delete remote file {file_ref.name}: {cleanup_err}")
            
    # Fallback
    return {
        "doc_type": "unknown", 
        "error": f"Extraction failed after {max_attempts} attempts with 45s per attempt.",
        "has_scam_pattern": False,
        "has_semantic_paradox": False,
        "is_screenshot": False
    }