import re
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from ..utils.schemas import LayerResult, LayerStatus


# ================== Helpers ==================

# Decimal Converter
def to_decimal(val) -> Decimal:
    if not val: 
        return Decimal("0.00")
    
    if isinstance(val, dict):
        val = val.get("value", 0)
        
    try:
        # Cleaning punctuation and currency symbol in financing values
        clean_str = re.sub(r"[^\d.-]", "", str(val))
        if not clean_str: return Decimal("0.00")
        return Decimal(clean_str)
    except InvalidOperation:
        return Decimal("0.00")

# Parsing Date Time
def parse_dt(date_str: str) -> Optional[datetime]:
    try: 
        return datetime.strptime(date_str, "%Y-%m-%d")
    except: 
        return None

# Extract date from reference number (if any)
# Support formats includes YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY, DD Mon YY etc.
def extract_first_date(text: str) -> Optional[datetime]:

    if not text: return None
    
    # 1. Matching YYYYMMDD (limited for year 2020-2029)
    id_pattern = r"(20[2-3][0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])"
    match = re.search(id_pattern, text)
    if match:
        try:
            y, m, d = match.groups()
            return datetime(int(y), int(m), int(d))
        except: pass

    # 2. Matching with punctuation (- or / or \ or .)
    try:
        # Seeking for substring with format 25 Nov 23 or 2023-11-25 with common possible formats
        dates = re.findall(r"(\d{1,4}[-/\.]\w{1,3}[-/\.]\d{2,4})", text)
        for d_str in dates:
            try:
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y", "%d %b %y", "%d %b %Y"]:
                    return datetime.strptime(d_str, fmt)
            except: continue
    except: pass
    
    return None

def create_audit_record(name: str, status: str, formula: str, visual: str, reason: str = ""):
    return {
        "check_name": name,
        "status": status,
        "formula": formula,
        "visual_feedback": visual,
        "reason": reason
    }


# ===================== Layer 4 Logic =====================

def run_layer_4_logic(data: Dict[str, Any]) -> LayerResult:
    """
    Forensic Logic Audit Layer.
    Executes deterministic checks on extracted data:
    1. Math Integrity (Row-level & Tax) - Fully Decimal Based
    2. Payment Route Integrity
    3. Temporal Logic (Time Paradox)
    4. Format Hard Fails (Screenshot on strict docs)
    """
    details = {}
    score = 0
    status = LayerStatus.CLEAN
    audit_trails: List[Dict] = []
    l4_signals: List[str] = []


    # =============== Rule 0: Meta Check ================
    meta = data.get("_meta", {})
    if meta.get("json_repaired"):
        l4_signals.append("JSON_REPAIRED")
        details["meta_warning"] = "Structure repaired by heuristic. Audit confidence reduced."

    # Unpack data from OCR result
    fin = data.get("financials", {})
    dates = data.get("dates", {})
    payment = data.get("payment_info", {})
    vendor = data.get("vendor_info", {})
    items = data.get("line_items", [])
    vis = data.get("visual_elements", {})
    inf = data.get("risk_inference", {})
    doc_type = data.get("doc_type", "unknown")

    total = to_decimal(fin.get("total_amount", data.get("total_amount")))
    subtotal = to_decimal(fin.get("subtotal_amount"))
    tax = to_decimal(fin.get("tax_amount"))

    # Format date
    invoice_date = parse_dt(dates.get("invoice_date"))
    due_date = parse_dt(dates.get("due_date"))

    # Collect all dates from line items in sequence
    line_item_dates = []
    for item in items:
        d = parse_dt(item.get("date"))
        if not d:
            d = extract_first_date(item.get("desc", ""))
        if d:
            line_item_dates.append(d)


    # ============== Rule 1: Visual Hard Fail (Screenshot Check) ... if later Layer 0 perform well can consider to be removed ==============
    # Layer 0 will use this signal to trigger Hard Fail if profile doesn't allow screenshots.
    # We double-flag it here for forensic completeness.

    is_screenshot = vis.get("has_status_bar") or vis.get("has_browser_chrome") or inf.get("is_screenshot")
    
    if doc_type in ["invoice", "bank_statement", "payslip"] and is_screenshot:
        l4_signals.append("FORMAT_VIOLATION_SCREENSHOT")
        status = LayerStatus.HIGH_RISK
        score = max(score, 95)
        audit_trails.append(create_audit_record(
            "Format Check", "FAIL", "Original Document Only", 
            "Mobile UI/Screenshot Detected", "High risk of manipulation"
        ))
    else:
        if is_screenshot:
            # Forgivable screenshot
            audit_trails.append(create_audit_record(
                "Format Check", "PASS", "Document Integrity", 
                "Screenshot Detected", "Allowed for this document type"
            ))
        else:
            # No screenshot
            audit_trails.append(create_audit_record(
                "Format Check", "PASS", "Document Integrity", 
                "Clean Layout", "No screenshot artifacts"
            ))


# ================= Rule 2: Math Integrity (Row & Tax) =================
    # 2.1 Row Audit
    row_errors = []
    calc_subtotal_net = Decimal("0.00")
    calc_total_gross = Decimal("0.00")
    calc_subtotal = Decimal("0.00")
    
    for idx, item in enumerate(items):
        q = to_decimal(item.get("qty"))
        u = to_decimal(item.get("unit_price"))
        l_total = to_decimal(item.get("line_total"))
        
        expected_net = Decimal("0.00")
        if q != Decimal("0.00") and u != Decimal("0.00"):
            expected_net = q * u
            calc_subtotal_net += expected_net
        else:
            calc_subtotal_net += l_total   # Fallback

        calc_total_gross += l_total if l_total != Decimal("0.00") else expected_net

        if expected_net > Decimal("0.00") and l_total != Decimal("0.00"):
            diff = abs(expected_net - l_total)
            if diff > Decimal("0.02"):   # Allow 2 cents tolerance for OCR errors
                row_errors.append({
                    "idx": idx + 1, 
                    "visual": f"{q} * {u} = {expected_net:.2f} (Extracted: {l_total:.2f})"
                })

    doc_subtotal = to_decimal(fin.get("subtotal_amount"))
    doc_total = to_decimal(fin.get("total_amount", data.get("total_amount")))
    
    is_subtotal_match = doc_subtotal > Decimal("0.00") and abs(calc_subtotal_net - doc_subtotal) <= Decimal("1.00")
    is_total_match = doc_total > Decimal("0.00") and abs(calc_total_gross - doc_total) <= Decimal("1.00")

    if row_errors:
        if is_subtotal_match or is_total_match:
            # Net vs Gross Reconciliation Mode: Row-level math doesn't match, but totals are consistent. 
            # This often indicates a systematic OCR error (e.g., decimal point missed in all unit prices) rather than random data tampering.
            audit_trails.append(create_audit_record(
                "Row Audit Mode", "PASS", "Net vs Gross Reconciliation", 
                "Gross amounts detected in Line Total", "Qty*Unit != Line Total, but aggregates perfectly match Document Totals."
            ))
            row_errors = []  
            calc_subtotal = calc_subtotal_net
        else:
            # Critical math failure: Row-level math doesn't match AND totals are inconsistent.
            l4_signals.append("MATH_ROW_MISMATCH")
            score = max(score, 80)
            status = LayerStatus.HIGH_RISK
            for err in row_errors[:3]: 
                audit_trails.append(create_audit_record(
                    f"Row {err['idx']} Math", "FAIL", "Qty * Unit == Extracted Total", err['visual'], "Unexplained discrepancy"
                ))
            audit_trails.append(create_audit_record(
                "Row Audit Summary", "FAIL", "All Rows Consistent", 
                f"Failed {len(row_errors)}/{len(items)} rows", "Math inconsistencies detected"
            ))
            calc_subtotal = calc_subtotal_net 
    elif items:
        audit_trails.append(create_audit_record(
            "Row Audit Summary", "PASS", "Qty * Unit = Total", 
            "All items verified", f"Checked {len(items)} rows"
        ))
        calc_subtotal = calc_subtotal_net


    # 2.2 Tax Logic
    base_val = subtotal if subtotal > Decimal("0.00") else calc_subtotal

    if base_val > Decimal("0.00") and tax > Decimal("0.00"):
        expected = base_val + tax
        diff = abs(total - expected)
        is_pass = diff <= Decimal("1.00")   # 1.00 Tolenrance for special tax rules or OCR faults
        
        if not is_pass:
            l4_signals.append("MATH_TAX_LOGIC_FAIL")
            score = max(score, 85)
            status = LayerStatus.HIGH_RISK
            
        audit_trails.append(create_audit_record(
            "Tax Consistency", "PASS" if is_pass else "FAIL", "Subtotal + Tax = Total",
            f"{base_val:.2f} + {tax:.2f} {'==' if is_pass else '!='} {total:.2f}",
            f"Difference: {diff:.2f}" if not is_pass else "Match"
        ))

    # 2.3 Tax Rate Multiplier Audit
    tax_rate_pct = to_decimal(fin.get("tax_rate_percentage_raw"))
    
    if tax_rate_pct > Decimal("0.00") and base_val > Decimal("0.00"):
        # Tax rate can be in percentage form (e.g., 6 for 6%) or decimal form (e.g., 0.06 for 6%). We will check both.
        actual_multiplier = tax_rate_pct if tax_rate_pct < Decimal("1.00") else (tax_rate_pct / Decimal("100"))
        
        expected_statutory_tax = base_val * actual_multiplier
        tax_diff = abs(tax - expected_statutory_tax)
        
        if tax_diff > Decimal("1.00"):
            l4_signals.append("MATH_TAX_LOGIC_FAIL")
            score = max(score, 80)
            status = LayerStatus.HIGH_RISK
            audit_trails.append(create_audit_record(
                "Tax Multiplier", "FAIL", f"Subtotal * {tax_rate_pct}% == Tax",
                f"{base_val} * {tax_rate_pct}% = {expected_statutory_tax:.2f} (Shown as {tax:.2f})",
                "Statutory tax calculation does not match stated tax amount."
            ))
        else:
            audit_trails.append(create_audit_record(
                "Tax Multiplier", "PASS", f"Subtotal * {tax_rate_pct}% == Tax",
                f"Verified {tax_rate_pct}% rate", "Statutory math perfectly matches."
            ))


    # ================= Rule 3: Payment Integrity (Invoices) ================
    if doc_type in ["invoice" , "receipt", "payment_receipt", "bank_statement"]:
        # 3A: Missing Invoice Number
        inv_num = data.get("invoice_number") or data.get("reference_number")
        if not inv_num:
            l4_signals.append("MISSING_INVOICE_ID")
            score = max(score, 65) 
            if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
            audit_trails.append(create_audit_record(
                "Compliance Check", "FAIL", "Invoice ID Exists", "ID is Null", "Missing unique identifier"
            ))

        # 3B: Missing Payment Route
        payment = payment or {} 
        has_account = bool(payment.get("account_number"))
        has_ref_no = bool(data.get("reference_number") or data.get("invoice_number"))
        
        # Type 1: bank statement (Strict - Critical)
        if doc_type == "bank_statement":
            if not has_account:
                l4_signals.append("MISSING_CORE_ACCOUNT_ID")
                score = max(score, 90) 
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "FAIL", "Account Number Required", "None Found", 
                    "Bank Statement missing core account identifier."
                ))
            else:
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "PASS", "Account Identifier", 
                    f"Found: {payment.get('account_number')}", "Core ID verified"
                ))

        # Type 2: B2B Invoice (Strict - Suspicious)
        elif doc_type == "invoice":
            if not has_account:
                l4_signals.append("MISSING_PAYMENT_ROUTE")
                score = max(score, 25)   # most of the invoice have account no. provided
                if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "FAIL", "Account Number Expected", "None Found", 
                    "Invoice missing bank account details for payment."
                ))
            else:
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "PASS", "Payment Route", 
                    "Account Found", "Standard invoice format"
                ))

        # Type 3: Receipt / Payment Receipt (Relaxed)
        else: # receipt, payment_receipt
            if not (has_account or has_ref_no):
                l4_signals.append("MISSING_PAYMENT_PROOF")
                score = max(score, 60)
                if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "FAIL", "Account OR Ref ID", "None Found", 
                    "Missing payment verification data"
                ))
            else:
                proof = "Account No" if has_account else "Reference ID"
                audit_trails.append(create_audit_record(
                    "Payment Traceability", "PASS", "Payment Verification", 
                    f"Found {proof}", "Traceable transaction"
                ))
        
        # 3C: Beneficiary Mismatch
    if doc_type in ["invoice", "receipt", "payment_receipt"]:
        p_raw = payment.get("account_holder_name")
        v_raw = vendor.get("name")
        
        p_name = (p_raw if p_raw else "").lower()
        v_name = (v_raw if v_raw else "").lower()
        
        if p_name and v_name:
            common = set(p_name.split()) & set(v_name.split())
            if not common and len(p_name) > 3:
                l4_signals.append("BENEFICIARY_MISMATCH")
                score = max(score, 85)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "Beneficiary Check", "FAIL", "Holder == Vendor", 
                    f"'{p_name}' != '{v_name}'", "Potential Injection Fraud"
                ))
            else:
                audit_trails.append(create_audit_record(
                    "Beneficiary Check", "PASS", "Holder == Vendor", 
                    "Identity Verified", "Payment destination matches vendor"
                ))



# ================= Rule 4: Date & Consistency Logic =================
    
    # 4A: Basic Due Date Logic (Restored)
    if invoice_date and due_date and due_date < invoice_date:
        l4_signals.append("TIME_PARADOX_LOGIC")
        score = max(score, 75)
        audit_trails.append(create_audit_record(
            "Date Logic", "FAIL", "Due Date >= Invoice Date", 
            f"Due {due_date.date()} < Inv {invoice_date.date()}", "Logical Error"
        ))

    # 4B: ID vs Date Consistency (New Feature)
    ref_keys = ["invoice_number", "reference_number", "receipt_number"]
    hidden_date = None
    target_ref_no = None
    
    for k in ref_keys:
        val = data.get(k)
        if val:
            extracted = extract_first_date(val)
            if extracted:
                hidden_date = extracted
                target_ref_no = val
                break

    if hidden_date and invoice_date:
        # Delta = Doc Date - ID Date
        # Delta < 0: From future -> High Risk
        # Delta > 0: Delay -> Depends on synchronous and asynchronous document types
        delta = (invoice_date - hidden_date).days
        raw_text_dump = str(data).upper()

        # --- ( Synchronous & Asynchronous Document Classification ) ---
        # 1. According to doc_type
        is_strict_mode = doc_type in ["payment_receipt"]
        
        # 2. Keyword Override (E-Wallet strict, Official Receipt / Tax Invoice not strict )
        ewallet_keywords = ["TOUCH 'N GO", "EWALLET", "GRABPAY", "DUITNOW", "ALIPAY"]
        if any(kw in raw_text_dump for kw in ewallet_keywords):
            is_strict_mode = True
        if "OFFICIAL RECEIPT" in raw_text_dump or "TAX INVOICE" in raw_text_dump:
            is_strict_mode = False

        # --- Audit Execution ---
        if is_strict_mode:
            # Strict Mode (Real time receipt)
            if delta < 0:
                l4_signals.append("ID_DATE_TIME_PARADOX")
                score = max(score, 95)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "Real-time ID", "FAIL", "Doc >= ID", 
                    f"Doc {invoice_date.date()} < ID {hidden_date.date()}", 
                    "Impossible: Transaction ID from future."
                ))
            elif delta == 0:
                audit_trails.append(create_audit_record(
                    "Real-time ID", "PASS", "Strict Match", 
                    f"Verified ID: {target_ref_no}",
                    "Perfect real-time match."
                ))
            else:
                # 1 day late (Suspicious)
                # late > 1 day (High Risk)
                risk_label = "ID_DATE_LAG_SUSPICIOUS" if delta == 1 else "ID_DATE_MISMATCH_STRICT"
                risk_score = 50 if delta == 1 else 95
                
                l4_signals.append(risk_label)
                score = max(score, risk_score)
                if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                audit_trails.append(create_audit_record(
                    "Real-time ID", "FAIL" if delta > 1 else "CAUTION", "Zero Lag Expected", 
                    f"Ref: {target_ref_no} | Lag: {delta} day(s)", 
                    "E-receipt logic failure: Transaction ID belongs to a different day."
                ))
        
        else:
            # Relax Mode (B2B Receipt)
            if delta < 0:
                l4_signals.append("ID_DATE_TIME_PARADOX")
                score = max(score, 95)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "Logic Check", "FAIL", "Doc >= ID", f"Gap: {delta} days", 
                    "Critical: Document issued before ID generation."
                ))
            elif 0 <= delta <= 4:   # 1-4 days Tolerance Period
                audit_trails.append(create_audit_record(
                    "Batch Validity", "PASS", "Admin Tolerance", 
                    f"Lag: {delta} days", "Within acceptable manual entry/processing window."
                ))
            else:
                l4_signals.append("LONG_ENTRY_DELAY")
                score = max(score, 40)
                audit_trails.append(create_audit_record(
                    "Batch Validity", "CAUTION", "Extended Lag", 
                    f"Lag: {delta} days", "Unusual processing delay."
                ))


    # 4C: Chronology Audit (New Feature for Bank Statements)
    if doc_type in ["bank_statement", "payslip"] and len(line_item_dates) > 1:
        
        # --- Real World Sanity Date Check ---
        real_now = datetime.now(timezone.utc)
        future_violation = None
        for d in line_item_dates:
            # Naive datetime converted into UTC for comparison
            if d.tzinfo is None:
                d_aware = d.replace(tzinfo=timezone.utc)
            else:
                d_aware = d
            
            # 24 hours tolerance for time zone errors
            if d_aware > (real_now + timedelta(hours=24)):
                future_violation = d
                break
        
        if future_violation:
            l4_signals.append("DATE_FROM_FUTURE")
            score = max(score, 95)
            status = LayerStatus.HIGH_RISK
            audit_trails.append(create_audit_record(
                "Real-World Sanity", "FAIL", "Date <= Now", 
                f"Found: {future_violation.date()}", "Transaction is in the future relative to analysis time."
            ))

        # --- Chronology Consistency ---
        # Indicate the line items date follow ascending or descending orders
        is_descending = line_item_dates[0] > line_item_dates[-1] 
        chronology_errors = []

        for i in range(len(line_item_dates) - 1):
            curr = line_item_dates[i]
            next_d = line_item_dates[i+1]
            
            # Same day is okay
            if curr.date() == next_d.date():
                continue
            if is_descending:
                if next_d > curr:
                    chronology_errors.append(f"Row {i+1}->{i+2}: {curr.date()} -> {next_d.date()} (Time Jump)")
            else:
                if next_d < curr:
                    chronology_errors.append(f"Row {i+1}->{i+2}: {curr.date()} -> {next_d.date()} (Backwards Jump)")

        if chronology_errors:
            l4_signals.append("CHRONOLOGY_INCONSISTENCY")
            score = max(score, 85)
            if status != LayerStatus.HIGH_RISK: status = LayerStatus.SUSPICIOUS
            
            # Record the first two mistakes
            for err in chronology_errors[:2]:
                audit_trails.append(create_audit_record(
                    "Timeline Logic", "FAIL", "Sequential Order", err, "Inconsistent timeline detected"
                ))
                
        elif not future_violation:
             audit_trails.append(create_audit_record(
                "Timeline Audit", "PASS", "Chronology Check", 
                f"Verified {len(line_item_dates)} dates", "Timeline is consistent"
            ))


    # ================= Rule 5: Balance Reconciliation =================
    if doc_type == "bank_statement":
        op_bal = to_decimal(fin.get("opening_balance"))
        cl_bal = to_decimal(fin.get("closing_balance"))
        if cl_bal == Decimal("0.00") and fin.get("total_amount"): 
            cl_bal = to_decimal(fin.get("total_amount"))

        if op_bal is not None:
            # some bank statement will put Opening/Closing Balance as first or last line, need to filter in calculating the sum
            valid_items = []
            skipped_keywords = ["BALANCE BROUGHT", "BALANCE CARRIED", "OPENING BALANCE", "CLOSING BALANCE", "TOTAL"]
            
            for i in items:
                desc_upper = i.get("desc", "").upper()
                if any(k in desc_upper for k in skipped_keywords):
                    continue
                valid_items.append(i)
            
            calc_flow = sum([to_decimal(i.get("line_total")) for i in valid_items])

            calc_close = op_bal + calc_flow
            diff = abs(calc_close - cl_bal)
            is_pass = diff <= Decimal("0.50")    # for tolerance
            
            if not is_pass:
                l4_signals.append("BALANCE_RECONCILIATION_FAIL")
                score = max(score, 95)
                status = LayerStatus.HIGH_RISK
            
            audit_trails.append(create_audit_record(
                "Balance Reconciliation", "PASS" if is_pass else "FAIL", "Open + Flow = Close",
                f"{op_bal:.2f} + {calc_flow:.2f} {'==' if is_pass else '!='} {cl_bal:.2f}",
                f"Gap: {diff:.2f}" if not is_pass else "Verified"
            ))


# ================= Final Output Packaging =================
    details["audit_trails"] = audit_trails

    # The lists of faults to be hard-failed in Layer 0 (label as Time Paradox)
    critical_time_triggers = [
        "TIME_PARADOX_LOGIC",
        "ID_DATE_TIME_PARADOX",
        "DATE_FROM_FUTURE",
        "CHRONOLOGY_INCONSISTENCY"
    ]
    is_critical_paradox = any(sig in l4_signals for sig in critical_time_triggers)

    if is_critical_paradox:
        details["time_paradox"] = True
    else:
        details["time_paradox"] = False

    # Compatibility Mapping (Restored for config.py triggers)
    if "MATH_" in str(l4_signals): details["math_mismatch"] = True
    if "HIDDEN_" in str(l4_signals): details["hidden_text_found"] = True

    return LayerResult(
        layer_name="L4_Logic",
        status=status,
        score=min(score, 100),
        risk_signals=list(set(l4_signals)),
        details=details
    )