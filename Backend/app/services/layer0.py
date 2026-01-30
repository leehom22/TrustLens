import asyncio
import json
import google.generativeai as genai
from typing import List, Dict
from ..utils.config import logger
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import clean_and_repair_json



async def run_layer_0_judge(doc_type: str, evidence: List[LayerResult], profile: Dict) -> Dict:

    # ================== AI Set-up ===================
    generation_config = {
        "temperature": 0.1,  # stable, not creative
        "top_p": 0.95,
        "top_k": 40,
        "response_mime_type": "application/json"
    }
    
    model = genai.GenerativeModel(
        model_name='gemini-1.5-pro',
        generation_config=generation_config
    )
    
    # ================== Overall Evaluation ================
    weighted_score = 0.0
    total_weight = 0.0
    hard_fail_triggered = False
    hard_fail_reason = ""

    # Load rules from profile
    weights = profile.get("weights", {})
    hard_fail_list = profile.get("hard_fail_checks", [])
    
    # Helper to map generic layer names to config keys
    layer_map_keys = {"L1_Metadata": "L1", "L2_Visual": "L2", "L3_Content": "L3", "L4_Logic": "L4"}
    
    evidence_summary = []

    # 1. Allow_Screenshot => Hard Fail
    # Retrieve L3 result to check for screenshot flag
    l3_evidence = next((e for e in evidence if e.layer_name == "L3_Content"), None)
    
    if l3_evidence and l3_evidence.details.get("is_screenshot"):
        # Check if profile explicitly forbids screenshots (Default to True/Allowed if not set)
        if not profile.get("allow_screenshot", True):
            hard_fail_triggered = True
            hard_fail_reason = f"Format Violation: Screenshot detected. {doc_type} requires original document."


    for e in evidence:
        # Hard Fail Check
        if not hard_fail_triggered:
            for check in hard_fail_list:
                if check in e.details:
                    hard_fail_triggered = True
                    hard_fail_reason = f"Hard Fail Triggered: {check} in {e.layer_name}"
                    break
        
        # Weighted Calculation
        w_key = layer_map_keys.get(e.layer_name, "L1")
        w = weights.get(w_key, 0.25)
        
        if e.status == LayerStatus.SKIPPED:
            w = 0.0
        
        # Allow_creative_software => Forgive
        # Keep the evidence, but reduce its weight to zero for the score calculation
        current_score = e.score
        if profile.get("allow_creative_software") and e.layer_name == "L1_Metadata" and "software_risk" in e.details:
             current_score = 0 # Forgive only in calculation
        
        weighted_score += (current_score * w)
        total_weight += w
        
        # Clean up heatmap in the evidence chain for AI Prompt
        ev_dict = e.dict()
        if "visual_evidence_url" in ev_dict: del ev_dict["visual_evidence_url"]
        evidence_summary.append(ev_dict)


    # Final Calculation
    if hard_fail_triggered:
        final_score = 95
        risk_level = "CRITICAL"
    else:
        final_score = int(weighted_score / total_weight) if total_weight > 0 else 0
        
        # Risk Level
        if final_score > 80: risk_level = "CRITICAL"
        elif final_score > 50: risk_level = "SUSPICIOUS"
        elif final_score > 20: risk_level = "CAUTION"
        else: risk_level = "SAFE"


    # ==================== AI Prompt ========================
    evidence_text = json.dumps(evidence_summary, indent=2)
    
    prompt = f"""
    Role: TrustLens Context-Aware Risk Auditor.
    
    [CONTEXT]
    Document Type: {doc_type.upper()}
    Profile Rules: {profile.get('description')}
    Allow Creative Software: {profile.get('allow_creative_software')}
    Allow Screenshot: {profile.get('allow_screenshot', True)}
    Hard Fail Checks: {hard_fail_list}
    
    [SYSTEM JUDGMENT]
    Calculated Score: {final_score}/100
    Hard Fail Triggered: {hard_fail_triggered} ({hard_fail_reason})
    
    [EVIDENCE CHAIN]
    {evidence_text}
    
    [TASK]
    Generate a JSON report explaining this judgment.
    1. 'overall_risk_score': {final_score} (Do not change this unless System Judgment is clearly wrong).
    2. 'risk_level': {risk_level}.
    3. 'summary': Explain the score. 
       - If Hard Fail was triggered, state clearly WHY (e.g., "Bank Statement cannot be a screenshot").
       - If L1 flagged 'Canva' but document is a Resume, explain "Software risk deemed acceptable for Resume".
    4. 'recommendation': Actionable advice (e.g., "Reject immediately", "Manual review required", "Accept").
    """

    # ======================= Execution ========================
    try:
        res = await asyncio.wait_for(model.generate_content_async(prompt), timeout=15.0)
        return clean_and_repair_json(res.text)
    except Exception as e:
        logger.error(f"Judge Timeout/Error: {e}")
        return {
            "overall_risk_score": final_score, 
            "risk_level": "Unknown", 
            "summary": "AI Narrative Timeout. Logic Score Used.",
            "recommendation": "Manual Review"
        }