import re
from typing import Dict, List, Any
from datetime import datetime
from ..schemas import LayerResult, LayerStatus


def run_layer_4_logic(data: Dict[str, Any]) -> LayerResult:
    """
    Forensic Logic Audit Layer.
    Executes deterministic checks on extracted data:
    1. Math Integrity (Row-level & Tax)
    2. Payment Route Integrity
    3. Temporal Logic (Time Paradox)
    4. Format Hard Fails (Screenshot on strict docs)
    """
    details = {}
    score = 0
    status = LayerStatus.CLEAN
    l4_signals: List[str] = []

    # Helpers
    def to_float(val):
        if not val: return 0.0
        # DIRECT SUPPORT for L3 Nested Structure {value, raw_text}
        if isinstance(val, dict): 
            val = val.get("value", 0)
        try: return float(re.sub(r"[^\d.]", "", str(val)))
        except: return 0.0

    def parse_dt(date_str):
        try: return datetime.strptime(date_str, "%Y-%m-%d")
        except: return None

    # =============== Rule 0: Meta Check ================
    meta = data.get("_meta", {})
    if meta.get("json_repaired"):
        l4_signals.append("JSON_REPAIRED")
        details["meta_warning"] = "Structure repaired by heuristic. Audit confidence reduced."

    # Unpack Data
    fin = data.get("financials", {})
    dates = data.get("dates", {})
    payment = data.get("payment_info", {})
    vendor = data.get("vendor_info", {})
    items = data.get("line_items", [])
    vis = data.get("visual_elements", {})
    inf = data.get("risk_inference", {})
    doc_type = data.get("doc_type", "unknown")

    # Helpers
    total = to_float(fin.get("total_amount", data.get("total_amount")))
    subtotal = to_float(fin.get("subtotal_amount"))
    tax = to_float(fin.get("tax_amount"))


    # ============== Rule 1: Visual Hard Fail (Screenshot Check) ==============
    # Layer 0 will use this signal to trigger Hard Fail if profile doesn't allow screenshots.
    # We double-flag it here for forensic completeness.
    is_screenshot = vis.get("has_status_bar") or vis.get("has_browser_chrome") or inf.get("is_screenshot")
    
    if doc_type in ["invoice", "bank_statement", "payslip"] and is_screenshot:
        l4_signals.append("FORMAT_VIOLATION_SCREENSHOT")
        status = LayerStatus.HIGH_RISK
        score = 95
        details["visual_check"] = "FAIL: Mobile/Browser UI elements detected on strict document."


    # ============ Rule 2: Row Audit (Line Item Consistency) ==============
    line_item_errors = 0
    calculated_subtotal = 0.0
    
    for idx, item in enumerate(items):
        q = to_float(item.get("qty", 0))
        u = to_float(item.get("unit_price", 0))
        # Direct dictionary access based on new L3 schema
        l_total = to_float(item.get("line_total", 0)) 
        
        # Only strict audit if all fields exist
        if q and u and l_total:
            # Allow 0.1 tolerance for float rounding
            if abs((q * u) - l_total) > 0.1:
                line_item_errors += 1
                details[f"row_{idx+1}_error"] = f"{q}*{u} != {l_total}"
        
        # Fallback for subtotal calc (Trust line_total if exists, else calculate)
        row_val = l_total if l_total else (q * u)
        calculated_subtotal += row_val

    if line_item_errors > 0:
        l4_signals.append("MATH_ROW_MISMATCH")
        score = max(score, 80)
        status = LayerStatus.HIGH_RISK
        details["line_item_audit"] = f"Failed: {line_item_errors} rows inconsistencies."


    # ================= Rule 3: Aggregation & Tax ====================
    base_amount = subtotal if subtotal > 0 else calculated_subtotal
    
    if base_amount > 0:
        # Check 3A: Subtotal vs Sum of Lines
        if subtotal > 0 and abs(subtotal - calculated_subtotal) > 1.0:
             l4_signals.append("MATH_AGGREGATION_MISMATCH")
             details["sum_check"] = f"Declared Subtotal {subtotal} != Calculated Sum {calculated_subtotal}"
             score = max(score, 70)
        
        # Check 3B: Tax Logic (Subtotal + Tax = Total)
        if tax > 0:
            expected_total = base_amount + tax
            if abs(total - expected_total) > 1.0:
                l4_signals.append("MATH_TAX_LOGIC_FAIL")
                details["tax_check"] = f"{base_amount} + {tax} != {total}"
                score = max(score, 85)


    # ================= Rule 4: Payment Integrity (Invoices) ================
    if doc_type == "invoice":
        # Check 4A: Missing Invoice Number
        inv_num = data.get("invoice_number")
        if not inv_num:
            l4_signals.append("MISSING_INVOICE_ID")
            score = max(score, 65) 
            if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
            details["compliance_check"] = "FAIL: Invoice missing unique identifier (Invoice No)."

        # Check 4B: Missing Payment Route
        if not payment.get("account_number"):
            l4_signals.append("MISSING_PAYMENT_ROUTE")
            # Compliance risk, strictly speaking not fraud, but high risk in business
            score = max(score, 60)
            if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
            details["integrity_warning"] = "No account number found in invoice."
        
        # Check 4C: Beneficiary Mismatch (Account Holder vs Vendor Name)
        p_name = payment.get("account_holder_name", "").lower()
        v_name = vendor.get("name", "").lower()
        
        if p_name and v_name:
            # Simple intersection check
            common = set(p_name.split()) & set(v_name.split())
            if not common and len(p_name) > 3:
                l4_signals.append("BENEFICIARY_MISMATCH")
                score = max(score, 85)
                status = LayerStatus.HIGH_RISK
                details["payment_risk"] = f"Mismatch: Account '{p_name}' != Vendor '{v_name}'"


    # =============== Rule 5: Date Logic (Time Paradox) =================
    inv_date = parse_dt(dates.get("invoice_date"))
    due_date = parse_dt(dates.get("due_date"))
    
    if inv_date and due_date and due_date < inv_date:
        l4_signals.append("TIME_PARADOX_LOGIC")
        details["time_logic_error"] = f"Due Date {due_date} is BEFORE Invoice Date {inv_date}"
        score = max(score, 75)


    # ================= COMPATIBILITY MAPPING =================
    # Mapping advanced forensic l4_signals to legacy keys for config.py Hard Fail triggers.
    # config.py checks for: "math_mismatch", "time_paradox", "hidden_text_found"
    
    if any(f in l4_signals for f in ["MATH_ROW_MISMATCH", "MATH_AGGREGATION_MISMATCH", "MATH_TAX_LOGIC_FAIL"]):
        details["math_mismatch"] = "True (Audit Failed)"
        
    if "TIME_PARADOX_LOGIC" in l4_signals:
        details["time_paradox"] = "True (Date Logic Error)"
        
    # Hidden Text is handled in Main.py for Resumes, but if L4 detects it via other means, we map it too
    if "HIDDEN_CONTENT_DETECTED" in l4_signals:
        details["hidden_text_found"] = True


    # ================== Output Final Result ====================
    return LayerResult(
        layer_name = "L4_Logic", 
        status = status, 
        score = min(score, 100), 
        risk_signals = l4_signals,
        details = details
    )