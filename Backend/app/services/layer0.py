import asyncio
import json
import google.generativeai as genai
from typing import List, Dict, Any
from ..utils.config import logger
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import clean_and_repair_json


async def run_layer_0_judge(doc_type: str, evidence: List[LayerResult], profile: Dict) -> Dict[str, Any]:
    
    # ================== Overall Evaluation ================
    weighted_score = 0.0
    total_weight = 0.0
    hard_fail_triggered = False
    aggregated_risk_signals = []   # collect all layers' risk signals and hard fail signals

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
            aggregated_risk_signals.append(f"Hard Fail Triggered: Screenshot detected. {doc_type} requires original document.")


    for e in evidence:
        # Risk Signal collect from each layer
        if e.risk_signals:
            aggregated_risk_signals.extend(e.risk_signals)

        # Hard Fail Check (all details in layer)
        for check in hard_fail_list:
            if check in e.details:
                hard_fail_triggered = True
                aggregated_risk_signals.append(f"Hard Fail Triggered: {check} in {e.layer_name}")
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
        # ev_dict = e.dict()
        # if "visual_evidence_url" in ev_dict: del ev_dict["visual_evidence_url"]
        # evidence_summary.append(ev_dict)


    # =============== Final Calculation ===============
    summary_code = "CALCULATED"

    if hard_fail_triggered:
        final_score = 95
        summary_code = "HARD_FAIL"
    else:
        final_score = int(weighted_score / total_weight) if total_weight > 0 else 0
        
        # Risk Level
        if final_score > 80: risk_level = "CRITICAL"
        elif final_score > 50: risk_level = "SUSPICIOUS"
        elif final_score > 20: risk_level = "CAUTION"
        else: risk_level = "SAFE"

    # ==================== Pass Output to main.py =====================
    distinct_risk_signals = list(set(aggregated_risk_signals))

    return {
        "overall_risk_score": final_score, 
        "risk_level": risk_level,
        "risk_signals": distinct_risk_signals,
        "summary_code": summary_code
    }