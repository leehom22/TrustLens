import google.generativeai as genai
import json

def analyze_feedback_content(text: str, analysis_type: str):
    model = genai.GenerativeModel('gemini-flash-latest')
    
    # Insert analysis to the prompt, so that AI can analyze and summary user feedback by refering document analysis result
    # Extract from database 
    prompt = f"""
    Analyze the following user feedback for a document {analysis_type} analysis.
    Feedback: "{text}"
    
    Return a JSON object with:
    1. "weight": (float 0.0 to 1.0) How important or critical this feedback is.
    2. "label": (string) One of: "correct", "incorrect", "warning", or "feature_request".
    3. "ai_lessons": (string) A short instruction for the AI to improve its future logic.
    """
    
    response = model.generate_content(prompt)
    # Extract the JSON part from the response text
    try:
        # Simple cleanup in case Gemini adds markdown code blocks
        json_text = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(json_text)
    except:
        # Fallback if AI output is messy
        return {"weight": 0.5, "label": "neutral", "ai_lessons": "Check manual review."}