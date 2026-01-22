import re
from typing import Dict
from ..schemas import LayerResult, LayerStatus

def run_layer_4_logic(entities: Dict) -> LayerResult:
    details = {}
    score = 0
    status = LayerStatus.CLEAN
    
    def to_float(val):
        if not val: return 0.0
        try: return float(re.sub(r"[^\d.]", "", str(val)))
        except: return 0.0

    total = to_float(entities.get("total_amount"))
    items = entities.get("line_items", [])
    
    # Math Check
    if items and total > 0:
        calc_sum = sum([to_float(i.get("qty", 1)) * to_float(i.get("unit_price", 0)) for i in items])
        if abs(total - calc_sum) > 1.0:
            status = LayerStatus.HIGH_RISK
            score = 85
            details["math_mismatch"] = f"Declared {total} != Calculated {calc_sum:.2f}"
        else:
            details["math_check"] = "PASS"
    else:
        details["math_check"] = "SKIPPED (Data missing)"
    
    # 可以在这里增加简单的必填项检查
    if not entities.get("invoice_number") and entities.get("doc_type") == "invoice":
        score += 10
        details["integrity_warning"] = "Missing Invoice Number"

    return LayerResult(layer_name="L4_Logic", status=status, score=score, details=details)