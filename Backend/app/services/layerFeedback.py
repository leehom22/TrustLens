import google.generativeai as genai
import json
from ..core.config import logger, DOC_RISK_PROFILES

VALID_DOC_TYPES = list(DOC_RISK_PROFILES.keys())

def analyze_feedback_content(text: str, current_doc_type: str):
    model = genai.GenerativeModel('gemini-flash-latest')
    
    # Insert analysis to the prompt, so that AI can analyze and summary user feedback by refering document analysis result
    # Extract from database 
    prompt = f"""
    Analyze the following user feedback for a document {current_doc_type} analysis.
    Feedback: "{text}"

    SYSTEM CONTEXT (Valid Document Types): {json.dumps(VALID_DOC_TYPES)}

    YOUR TASKS:
    1. **Target Layer**: Which forensic layer failed?
       - "L1": Metadata, PDF structure, file history.
       - "L2": Visual artifacts, ELA, noise, photoshop traces.
       - "L3": OCR text, typos, vendor address mismatch.
       - "L4": Logic, math, tax rates, dates, time paradox.
       - "General": Applies to the whole document validity.

    2. **Scope of Applicability** (CRITICAL):
       - Does this rule apply ONLY to '{current_doc_type}'? (e.g., a specific tax rule)
       - Or does it apply to a broader class? (e.g., "thermal paper noise" applies to ["receipt", "invoice", "payment_receipt"]).
       - BE CONSERVATIVE. If unsure, strictly select ONLY ["{current_doc_type}"].

    3. **Entity Extraction**:
       - If the feedback is specific to a vendor (e.g., "Grab", "TNB", "CIMB"), extract it. Otherwise return [].

    4. **Refined Lesson**:
       - Rewrite the feedback into a clear, professional instruction for an AI agent.

    Strictly return a JSON object with:
    1. "target_layer": "L1" | "L2" | "L3" | "L4" | "General"
    2. "weight": (float 0.0 to 1.0) How important or critical this feedback is.
    3. "label": (string) One of: "correct", "incorrect", "neutral", "warning", or "feature_request".
    4. "applicable_doc_types": [], 
    5. "related_entities": [],
    6. "ai_lessons": (string) A short instruction for the AI to improve its future logic.
    """
    
    response = model.generate_content(prompt)
    # Extract the JSON part from the response text
    try:
        # Simple cleanup in case Gemini adds markdown code blocks
        json_text = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(json_text)
    except Exception as e:
        logger.error(f"Feedback Analysis Failed: {e}")
        # Fallback if AI output is messy
        return {
            "target_layer": "General",
            "weight": 0.5, 
            "label": "neutral",
            "applicable_doc_types": [current_doc_type],
            "related_entities": [],
            "weight": 0.5, 
            "ai_lessons": text
        }