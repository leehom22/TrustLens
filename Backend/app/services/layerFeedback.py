from google import genai
import json
from ..core.config import logger, DOC_RISK_PROFILES, GEMINI_API_KEY

VALID_DOC_TYPES = list(DOC_RISK_PROFILES.keys())

def analyze_feedback_content(text: str, current_doc_type: str, analysis_type: str):
    client = genai.Client(api_key=GEMINI_API_KEY)

    layer_desc = {
        "layer1": "Metadata & File History Analysis",
        "layer2": "Visual Forensics (ELA, Noise, Editing Traces)",
        "layer3": "Content Extraction (OCR, Text Consistency)",
        "layer4": "Logical Validation (Math, Dates, Rules)",
        "General": "Overall Document Validity and Fraud Risk"
    }
    
    context = layer_desc.get(analysis_type, "General Analysis")

    # Insert analysis to the prompt, so that AI can analyze and summary user feedback by refering document analysis result
    prompt = f"""
    You are a Forensic AI Training Supervisor.
    A user provided feedback on the **{analysis_type}** ({context}) for a document classified as **{current_doc_type}**.

    Feedback: "{text}"

    SYSTEM CONTEXT (Valid Document Types): {json.dumps(VALID_DOC_TYPES)}

    YOUR TASKS:

    1. **Scope of Applicability** (CRITICAL):
       - Does this rule apply ONLY to '{current_doc_type}'? (e.g., a specific tax rule)
       - Or does it apply to a broader class? (e.g., "thermal paper noise" applies to ["receipt", "invoice", "payment_receipt"]).
       - BE CONSERVATIVE. If unsure, strictly select ONLY ["{current_doc_type}"].

    2. **Entity Extraction**:
       - If the feedback content is specific applied to a vendor (e.g., "Grab", "TNB", "CIMB"), extract it. Otherwise return [].

    3. **Refined Lesson**:
       - Rewrite the feedback into a clear, professional instruction for an AI agent.
       - Focus strictly on the logic of {analysis_type}.

    RETURN JSON ONLY:
    {{
        "ai_lessons": "String. The concise instruction.",
        "weight": Float (0.0 to 1.0, where 1.0 is critical error correction),
        "label": "correct" | "incorrect" | "warning" | "feature_request",
        "applicable_doc_types": ["{current_doc_type}"], 
        "related_entities": []
    }}
    """
    

    # Extract the JSON part from the response text
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        # Simple cleanup in case Gemini adds markdown code blocks
        json_text = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(json_text)

    except Exception as e:
        logger.error(f"Feedback Analysis Failed: {e}")
        # Fallback if AI output is messy
        return {
            "ai_lessons": text,
            "weight": 0.5, 
            "label": "neutral",
            "applicable_doc_types": [current_doc_type],
            "related_entities": []
        }
        
        
   