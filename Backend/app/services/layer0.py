import asyncio
import json
import google.generativeai as genai
from typing import List, Dict, Any
from ..core.config import logger
from ..utils.schemas import LayerResult, LayerStatus
from ..utils.utils import clean_and_repair_json


async def run_layer_0_judge(doc_type: str, evidence: List[LayerResult], profile: Dict) -> Dict[str, Any]:
    
    # ================== Overall Evaluation ================
    weighted_score = 0.0
    total_weight = 0.0
    hard_fail_triggered = False
    aggregated_risk_signals = []   # collect all layers' risk signals and hard fail signals
    hard_fail_reasons = []

    # Load rules from profile
    weights = profile.get("weights", {})
    hard_fail_list = profile.get("hard_fail_checks", [])
    layer_map_keys = {"L1_Metadata": "L1", "L2_Visual": "L2", "L3_Content": "L3", "L4_Logic": "L4"}
    
    for e in evidence:
        layer_signals = set(e.risk_signals) if e.risk_signals else set()
        aggregated_risk_signals.extend(list(layer_signals))

        triggered_fails = hard_fail_list.intersection(layer_signals)
        if triggered_fails:
            hard_fail_triggered = True
            for trigger in triggered_fails:
                hard_fail_reasons.append(f"[{trigger}] from {e.layer_name}")

        # Weighted Calculation
        w_key = layer_map_keys.get(e.layer_name, "L1")
        w = weights.get(w_key, 0.25)
        if e.status == LayerStatus.SKIPPED:
            w = 0.0

        # 1. Allow_Screenshot => Hard Fail
        # Retrieve L3 result to check for screenshot flag
        if "FORMAT_VIOLATION_SCREENSHOT" in layer_signals and not profile.get("allow_screenshot", True):
            hard_fail_triggered = True
            hard_fail_reasons.append("[FORMAT_VIOLATION_SCREENSHOT] (Profile enforced)")
            
            weighted_score += (current_score * w)
            total_weight += w

        # 2. Allow_creative_software => Forgive
        # Keep the evidence, but reduce its weight to zero for the score calculation
        current_score = e.score
        if profile.get("allow_creative_software") and e.layer_name == "L1_Metadata" and "software_risk" in e.details:
            current_score = 0 # Forgive only in calculation
        
        weighted_score += (current_score * w)
        total_weight += w
        

    # =============== Final Calculation ===============
    summary_code = "CALCULATED"
    risk_level = "SAFE"

    if hard_fail_triggered:
        final_score = 95
        summary_code = "HARD_FAIL"
        risk_level = "CRITICAL"
        aggregated_risk_signals.extend([f"Hard Fail Triggered: {r}" for r in set(hard_fail_reasons)])
    else:
        final_score = int(weighted_score / total_weight) if total_weight > 0 else 0
        
        # Risk Level
        if final_score > 80: risk_level = "CRITICAL"
        elif final_score > 50: risk_level = "SUSPICIOUS"
        elif final_score > 20: risk_level = "CAUTION"
        else: risk_level = "SAFE"

    # ==================== Pass Output to main.py =====================
    return {
        "overall_risk_score": final_score, 
        "risk_level": risk_level,
        "risk_signals": list(set(aggregated_risk_signals)),
        "summary_code": summary_code
    }