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
        dates = re.findall(r"(\d{1,4}[-/\.\s]\w{1,3}[-/\.\s]\d{2,4})", text)
        for d_str in dates:
            try:
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y", "%d %b %y", "%d %b %Y"]:
                    return datetime.strptime(d_str, fmt)
            except: continue
    except: pass
    
    return None


def normalize_entity_name(name: str) -> str:
    if not name: return ""
    # Convert to lowercase and remove symbol
    clean = re.sub(r'[^a-z0-9]', '', str(name).lower())
    # Remove common prefix of company names in Malaysia
    for suffix in ['sdnbhd', 'bhd', 'ltd', 'inc', 'llc', 'corporation', 'enterprise']:
        if clean.endswith(suffix):
            clean = clean[:-len(suffix)]
    return clean


# --- Validates Malaysian IC (MyKad) formats with strict JPN State Codes and dynamic age logic ---
def validate_mykad(ic_str: str, doc_type: str, doc_date: datetime = None) -> List[Dict]:

    if not ic_str: return []
    
    clean_ic = re.sub(r"[^\d]", "", str(ic_str))
    if len(clean_ic) != 12: 
        return [] 
        
    errors = []
    yy, mm, dd = int(clean_ic[0:2]), int(clean_ic[2:4]), int(clean_ic[4:6])
    pb = int(clean_ic[6:8])

    # 1. Strict State Code Check (PB) based on official JPN documentation
    valid_pb = set(list(range(1, 60)))
    
    if pb not in valid_pb:
        errors.append({"type": "MYKAD_INVALID_STATE", "visual": f"{pb}","reason_code": "MYKAD_INVALID_STATE"})

    # 2. Dynamic Date Format Check
    current_year = datetime.now().year
    current_century = (current_year // 100) * 100
    current_yy = current_year % 100
    
    if yy <= current_yy:
        year = current_century + yy
    else:
        year = current_century - 100 + yy
        
    dob = None
    try:
        dob = datetime(year, mm, dd)
    except ValueError:
        errors.append({"type": "MYKAD_INVALID_DOB", "visual": f"{clean_ic[0:6]}", "reason_code": "MYKAD_INVALID_DOB"})

    # 3. Age Check (ONLY triggered for legal/contractual documents)
    if dob and doc_type in ["contract", "legal_document"]:
        compare_date = doc_date if doc_date else datetime.now()
        age = (compare_date - dob).days / 365.25
        
        if age < 18:
            errors.append({"type": "MYKAD_MINOR_SIGNATORY", "visual": f"{clean_ic[0:6]} -> {int(age)}", "reason_code": "MYKAD_MINOR_SIGNATORY"})
        elif age > 100:
            errors.append({"type": "MYKAD_AGE_ANOMALY", "visual": f"{clean_ic[0:6]} -> {int(age)}","reason_code": "MYKAD_AGE_ANOMALY"})

    return errors

def create_audit_record(check_name_code: str, status: str, visual_feedback: str, reason_code: str):
    return {
        "check_name_code": check_name_code,
        "status": status,
        "visual_feedback": visual_feedback,
        "reason_code": reason_code
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
        audit_trails.append(create_audit_record("FORMAT_CHECK", "FAIL", "UI/SCREENSHOT", "HIGH_RISK_MANIPULATION"))
    else:
        if is_screenshot:
            # Forgivable screenshot
            audit_trails.append(create_audit_record("FORMAT_CHECK", "PASS", "UI/SCREENSHOT", "ALLOWED_FOR_TYPE"))
        else:
            # No screenshot
            audit_trails.append(create_audit_record("FORMAT_CHECK", "PASS", "NATIVE", "NO_SCREENSHOT_ARTIFACTS"))


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
            audit_trails.append(create_audit_record("ROW_AUDIT_MODE", "PASS", "GROSS", "GROSS_MATCH_DESPITE_ROW_ERROR"))
            row_errors = []  
            calc_subtotal = calc_subtotal_net
        else:
            # Critical math failure: Row-level math doesn't match AND totals are inconsistent.
            l4_signals.append("MATH_ROW_MISMATCH")
            score = max(score, 80)
            status = LayerStatus.HIGH_RISK
            for err in row_errors[:3]: 
                visual_str = f"R{err['idx']}: {err['visual']}"
                audit_trails.append(create_audit_record("ROW_MATH_CHECK", "FAIL", visual_str, "UNEXPLAINED_DISCREPANCY"))
            audit_trails.append(create_audit_record(
                "ROW_AUDIT_SUMMARY", "FAIL", 
                f"{len(row_errors)}/{len(items)}", "MATH_INCONSISTENCIES_DETECTED"
            ))
            calc_subtotal = calc_subtotal_net 
    elif items:
        audit_trails.append(create_audit_record(
            "ROW_AUDIT_SUMMARY", "PASS", f"{len(items)}/{len(items)}", "ALL_ITEMS_VERIFIED"
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
            "TAX_CONSISTENCY", "PASS" if is_pass else "FAIL", 
            f"{base_val:.2f} + {tax:.2f} {'==' if is_pass else '!='} {total:.2f}",
            "MATCH" if is_pass else "TAX_DIFFERENCE"
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
                "TAX_MULTIPLIER", "FAIL", 
                f"{base_val} * {tax_rate_pct}% = {expected_statutory_tax:.2f} != {tax:.2f}", 
                "STATUTORY_TAX_MISMATCH"
            ))
        else:
            audit_trails.append(create_audit_record(
                "TAX_MULTIPLIER", "PASS", 
                f"{tax_rate_pct}%", 
                "STATUTORY_MATH_PERFECT"
            ))


    # ================= Rule 3: Payment Integrity (Invoices) ================
    if doc_type in ["invoice" , "receipt", "payment_receipt", "bank_statement"]:
        # 3A: Missing Invoice Number
        inv_num = data.get("invoice_number") or data.get("reference_number")
        if not inv_num:
            l4_signals.append("MISSING_INVOICE_ID")
            score = max(score, 65) 
            if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
            audit_trails.append(create_audit_record("COMPLIANCE_CHECK", "FAIL", "NULL", "MISSING_UNIQUE_ID"))

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
                audit_trails.append(create_audit_record("PAYMENT_TRACEABILITY", "FAIL", "NULL", "BANK_STMT_MISSING_ID"))
            else:
                audit_trails.append(create_audit_record(
                    "PAYMENT_TRACEABILITY", "PASS", 
                    str(payment.get('account_number')), "CORE_ID_VERIFIED"
                ))

        # Type 2: B2B Invoice (Strict - Suspicious)
        elif doc_type == "invoice":
            if not has_account:
                l4_signals.append("MISSING_PAYMENT_ROUTE")
                score = max(score, 25)   # most of the invoice have account no. provided
                if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                audit_trails.append(create_audit_record("PAYMENT_TRACEABILITY", "FAIL", "NULL", "INVOICE_MISSING_ACCOUNT"))
            else:
                audit_trails.append(create_audit_record(
                    "PAYMENT_TRACEABILITY", "PASS", 
                    str(payment.get('account_number')), "STANDARD_INVOICE_FORMAT"
                ))

        # Type 3: Receipt / Payment Receipt (Relaxed)
        else: # receipt, payment_receipt
            if not (has_account or has_ref_no):
                l4_signals.append("MISSING_PAYMENT_PROOF")
                score = max(score, 60)
                if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                audit_trails.append(create_audit_record("PAYMENT_TRACEABILITY", "FAIL", "NULL", "MISSING_PAYMENT_VERIFICATION"))
            else:
                proof = "Account No" if has_account else "Reference ID"
                audit_trails.append(create_audit_record("PAYMENT_TRACEABILITY", "PASS", str(proof), "TRACEABLE_TRANSACTION"))
        
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
                    "BENEFICIARY_CHECK", "FAIL", 
                    f"[{p_name}] != [{v_name}]", "POTENTIAL_INJECTION_FRAUD"
                ))
            else:
                audit_trails.append(create_audit_record(
                    "BENEFICIARY_CHECK", "PASS", 
                    f"[{p_name}] == [{v_name}]", "DESTINATION_MATCHES_VENDOR"
                ))


    # ================= Rule 4: Date & Consistency Logic =================
    
    # 4A: Basic Due Date Logic (Restored)
    if invoice_date and due_date and due_date < invoice_date:
        l4_signals.append("TIME_PARADOX_LOGIC")
        score = max(score, 75)
        audit_trails.append(create_audit_record(
            "DATE_LOGIC", "FAIL", 
            f"{due_date.date()} < {invoice_date.date()}", "DUE_BEFORE_INVOICE"
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
        raw_text_dump = (data.get("raw_document_content", "") + " ".join([i.get("desc", "") for i in items])).upper()
        raw_text_clean = re.sub(r"[^\w\s]", "", raw_text_dump)

        # --- ( Synchronous & Asynchronous Document Classification ) ---
        # 1. According to doc_type
        is_strict_mode = False
        is_strict_mode = doc_type in ["payment_receipt"]
        
        # 2. Keyword Override (E-Wallet strict, Official Receipt / Tax Invoice not strict )
        ewallet_keywords = ["TOUCH 'N GO", "PAYPAL", "EWALLET", "GRABPAY", "DUITNOW", "ALIPAY"]
        if any(kw in raw_text_dump for kw in ewallet_keywords):
            is_strict_mode = True
        if "OFFICIAL RECEIPT" in raw_text_clean or "TAX INVOICE" in raw_text_clean:
            is_strict_mode = False

        # --- Audit Execution ---
        if is_strict_mode:
            # Strict Mode (Real time receipt)
            if delta < 0:
                l4_signals.append("ID_DATE_TIME_PARADOX")
                score = max(score, 95)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "REALTIME_ID", "FAIL", 
                    f"{invoice_date.date()} < {hidden_date.date()} ({target_ref_no}) | -{delta} day(s)", "ID_FROM_FUTURE"
                ))
            elif delta == 0:
                audit_trails.append(create_audit_record(
                    "REALTIME_ID", "PASS", 
                    str(target_ref_no), "PERFECT_REALTIME_MATCH"
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
                    "REALTIME_ID", "FAIL" if delta > 1 else "CAUTION", 
                    f"{invoice_date.date()} < {hidden_date.date()} ({target_ref_no}) | +{delta} day(s)", "ERECEIPT_DAY_MISMATCH"
                ))
        
        else:
            # Relax Mode (B2B Receipt)
            if delta < 0:
                l4_signals.append("ID_DATE_TIME_PARADOX")
                score = max(score, 95)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "LOGIC_CHECK", "FAIL", 
                    f"{invoice_date.date()} < {hidden_date.date()} ({target_ref_no}) | -{delta} day(s)", "DOC_BEFORE_ID"
                ))
            elif 0 <= delta <= 4:   # 1-4 days Tolerance Period
                audit_trails.append(create_audit_record(
                    "BATCH_VALIDITY", "PASS", 
                    f"{invoice_date.date()} < {hidden_date.date()} ({target_ref_no}) | +{delta} day(s)", "WITHIN_MANUAL_WINDOW"
                ))
            else:
                l4_signals.append("LONG_ENTRY_DELAY")
                score = max(score, 40)
                audit_trails.append(create_audit_record(
                    "BATCH_VALIDITY", "CAUTION", 
                    f"{invoice_date.date()} < {hidden_date.date()} ({target_ref_no}) | +{delta} day(s)", "UNUSUAL_DELAY"
                ))


    # 4C: Chronology Audit
    if len(line_item_dates) > 1:
        
        # --- Real World Sanity Date Check ---
        real_now_date = datetime.now().date()
        future_violation = None
        for d in line_item_dates:
            # 1 day tolerance for difference in timezones
            if d.date() > real_now_date + timedelta(days=1):
                future_violation = d
                break
        
        if future_violation:
            l4_signals.append("DATE_FROM_FUTURE")
            score = max(score, 95)
            status = LayerStatus.HIGH_RISK
            audit_trails.append(create_audit_record(
                "REAL_WORLD_SANITY", "FAIL", 
                f"{future_violation.date()} > {real_now_date}", "TRANSACTION_IN_FUTURE"
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
                    chronology_errors.append(f"R{i+1}->R{i+2}: {curr.date()}->{next_d.date()} (^)")
            else:
                if next_d < curr:
                    chronology_errors.append(f"R{i+1}->R{i+2}: {curr.date()}->{next_d.date()} (v)")

        if chronology_errors:
            l4_signals.append("CHRONOLOGY_INCONSISTENCY")

            if doc_type in ["bank_statement", "payslip"]:
                score = max(score, 85)
                status = LayerStatus.HIGH_RISK
                reason_code = "SYSTEMATIC_TIMELINE_BREACH"
            
            # Other document types with date sequence (e.g., delivery note) can be more forgiving as the date sequence might not be critical
            else:
                score = max(score, 60)
                if status == LayerStatus.CLEAN:
                    status = LayerStatus.SUSPICIOUS
                reason_code = "LOGICAL_SEQUENCE_ERROR"
            
            # Only show first 2 errors
            for err in chronology_errors[:2]:
                audit_trails.append(create_audit_record("TIMELINE_LOGIC", "FAIL", err, reason_code))
                
        elif not future_violation:
            audit_trails.append(create_audit_record(
                "TIMELINE_AUDIT", "PASS", 
                f"{len(line_item_dates)}/{len(line_item_dates)} Rows", "TIMELINE_CONSISTENT"
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
                "BALANCE_RECONCILIATION", "PASS" if is_pass else "FAIL", 
                f"{op_bal:.2f} + {calc_flow:.2f} {'==' if is_pass else '!='} {cl_bal:.2f}",
                "MATCH" if is_pass else "UNEXPLAINED_DISCREPANCY"
            ))


    # ================= Rule 6: Payslip Integrity =================
    if doc_type == "payslip":
        pd = data.get("payslip_details") or {}
        if pd:
            gross = to_decimal(pd.get("gross_pay"))
            total_deduct = to_decimal(pd.get("total_deductions"))
            net_pay = to_decimal(pd.get("net_pay"))
            breakdown = pd.get("deduction_breakdown") or {}
            
            # 6.1 Deductions Breakdown Math
            if breakdown and total_deduct > Decimal("0.00"):
                calc_deduct = sum([to_decimal(v) for v in breakdown.values()])
                if calc_deduct > Decimal("0.00"):
                    diff_deduct = abs(calc_deduct - total_deduct)
                    if diff_deduct > Decimal("1.00"):
                        l4_signals.append("MATH_DEDUCTION_MISMATCH")
                        score = max(score, 80)
                        status = LayerStatus.HIGH_RISK
                        audit_trails.append(create_audit_record(
                            "DEDUCTION_MATH", "FAIL", 
                            f"{calc_deduct:.2f} != {total_deduct:.2f}", "MATH_INCONSISTENCIES_DETECTED"))
                    else:
                        audit_trails.append(create_audit_record(
                            "DEDUCTION_MATH", "PASS", 
                            f"{calc_deduct:.2f} == {total_deduct:.2f}", "MATCH"
                        ))

            # 6.2 Net Pay Math
            if gross > Decimal("0.00") and net_pay > Decimal("0.00"):
                calc_net = gross - total_deduct
                diff_net = abs(calc_net - net_pay)
                if diff_net > Decimal("1.00"):
                    l4_signals.append("MATH_NET_PAY_MISMATCH")
                    score = max(score, 85)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "NET_PAY_MATH", "FAIL", 
                        f"{gross:.2f} - {total_deduct:.2f} != {net_pay:.2f}", "MATH_INCONSISTENCIES_DETECTED"
                    ))
                else:
                    audit_trails.append(create_audit_record("NET_PAY_MATH", "PASS", f"{net_pay:.2f}", "MATCH"))


    # ================= Rule 7: Summon Integrity =================
    if doc_type == "summon":
        sd = data.get("summon_details") or {}
        if sd:
            # 7.1 Issuing Agency Whitelist Check
            agency = str(sd.get("issuing_agency", "")).upper()
            if agency:
                valid_agencies = ["PDRM", "JPJ", "DBKL", "MBPJ", "MBSA", "MPSJ", "POLIS", "MAHKAMAH", "JIM", "JABATAN IMIGRESEN", "LHDN", "HASIL", "KASTAM", "SSM"]
                if not any(v in agency for v in valid_agencies):
                    l4_signals.append("INVALID_ISSUING_AGENCY")
                    score = max(score, 90)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "AGENCY_VERIFICATION", "FAIL", str(agency), "UNRECOGNIZED_AUTHORITY"
                    ))
                else:
                    audit_trails.append(create_audit_record(
                        "AGENCY_VERIFICATION", "PASS", str(agency), "VALID_AUTHORITY"
                    ))

            # 7.2 Summon Timeline Check
            offence_dt_str = sd.get("offence_date")
            if offence_dt_str:
                offence_date = extract_first_date(offence_dt_str)
                
                # Check 1: Offence Date vs Invoice (Issue) Date
                if offence_date and invoice_date and offence_date.date() > invoice_date.date():
                    l4_signals.append("SUMMON_TIME_PARADOX")
                    score = max(score, 95)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "SUMMON_TIMELINE", "FAIL", 
                        f"{offence_date.date()} > {invoice_date.date()}", "OFFENCE_AFTER_ISSUE"
                    ))
                
                # Check 2: Offence Date vs Due Date
                if offence_date and due_date and offence_date.date() > due_date.date():
                    l4_signals.append("SUMMON_TIME_PARADOX")
                    score = max(score, 95)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "SUMMON_TIMELINE", "FAIL", 
                        f"{offence_date.date()} > {due_date.date()}", "OFFENCE_AFTER_DUE"
                    ))


    # ================= Rule 8: Legal Document Integrity =================
    if doc_type in ["contract", "legal_document"]:
        ld = data.get("legal_details") or {}
        if ld:
            party_a = normalize_entity_name(ld.get("party_a", {}).get("name", ""))
            party_b = normalize_entity_name(ld.get("party_b", {}).get("name", ""))
            
            # 8.1 Entity Symmetry Check
            if party_a and party_b and len(party_a) > 3 and party_a == party_b:
                l4_signals.append("ENTITY_SYMMETRY_VIOLATION")
                score = max(score, 85)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "ENTITY_SYMMETRY", "FAIL", 
                    f"{party_a} == {party_b}", "SELF_DEALING_CIRCULAR"
                ))
            elif party_a and party_b:
                audit_trails.append(create_audit_record(
                    "ENTITY_SYMMETRY", "PASS", 
                    f"{party_a} != {party_b}", "PARTIES_DISTINCT"
                ))

            # 8.2 Validity Period Check
            eff_dt_str = ld.get("effective_date")
            exp_dt_str = ld.get("expiry_date")
            if eff_dt_str and exp_dt_str:
                eff_date = extract_first_date(eff_dt_str)
                exp_date = extract_first_date(exp_dt_str)
                
                if eff_date and exp_date and eff_date > exp_date:
                    l4_signals.append("CONTRACT_TIME_PARADOX")
                    score = max(score, 80)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "VALIDITY_PERIOD", "FAIL", 
                        f"{eff_date.date()} > {exp_date.date()}", "EXPIRES_BEFORE_EFFECTIVE"
                    ))


    # ================= Rule 9: Universal IC Format Verification =================
    extracted_ics = list(set(data.get("extracted_ic_numbers", [])))
    if extracted_ics:
        for ic in extracted_ics:
            mykad_errors = validate_mykad(ic, doc_type, invoice_date)
            for err in mykad_errors:
                l4_signals.append(err["type"])
                score = max(score, 85)
                status = LayerStatus.HIGH_RISK
                audit_trails.append(create_audit_record(
                    "IDENTITY_VERIFICATION", "FAIL", err["visual"], err["reason_code"]
                ))
            if not mykad_errors and len(re.sub(r"[^\d]", "", str(ic))) == 12:
                audit_trails.append(create_audit_record(
                    "IDENTITY_VERIFICATION", "PASS", str(ic), "MYKAD_VERIFIED"
                ))

    
# ================= Rule 10: Cross-Layer Chronology (Meta vs Content) =================
    l1_meta = data.get("_l1_metadata", {})
    pdf_c_str = l1_meta.get("pdf_creation_date")
    pdf_m_str = l1_meta.get("pdf_mod_date")
    
    if (pdf_c_str or pdf_m_str) and invoice_date:
        try:
            doc_day = invoice_date.date()
            dates_to_compare = []
            if pdf_c_str: dates_to_compare.append(datetime.fromisoformat(pdf_c_str).date())
            if pdf_m_str: dates_to_compare.append(datetime.fromisoformat(pdf_m_str).date())
            
            # Time Boundary for last document operation
            latest_physical_day = max(dates_to_compare)
            
            # Delta > 0 ：Transaction date claimed on document later than operational date on metadata
            delta = (doc_day - latest_physical_day).days
            
            # Type 1：Retrospective factual evidence related document (Strict)
            if doc_type in ["bank_statement", "payslip", "receipt", "payment_receipt"]:
                if delta > 1:   # Time zone tolerance
                    l4_signals.append("CROSS_LAYER_TIME_PARADOX")
                    score = max(score, 95)
                    status = LayerStatus.HIGH_RISK
                    audit_trails.append(create_audit_record(
                        "CROSS_LAYER_SYNC", "FAIL", 
                        f"{latest_physical_day} > {doc_day}", "RETROACTIVE_FORGERY"
                    ))
                else:
                    audit_trails.append(create_audit_record(
                        "CROSS_LAYER_SYNC", "PASS", 
                        f"{latest_physical_day} < {doc_day}", "TIMELINE_ALIGNS"
                    ))
                    
            # Type 2：Forward-looking / Template type document (Relax, warning only)
            else:
                if delta > 30:
                    l4_signals.append("CROSS_LAYER_TEMPLATE_ANOMALY")
                    score = max(score, 70)
                    if status == LayerStatus.CLEAN: status = LayerStatus.SUSPICIOUS
                    audit_trails.append(create_audit_record(
                        "CROSS_LAYER_SYNC", "CAUTION", 
                        f"{latest_physical_day} >= {doc_day} | +{delta} day(s)", "TEMPLATE_ANOMALY"
                    ))
                else:
                    audit_trails.append(create_audit_record(
                        "CROSS_LAYER_SYNC", "PASS", 
                        f"{latest_physical_day} >= {doc_day} | +{delta} day(s)", "NORMAL_TEMPLATE_WINDOW"
                    ))
        except ValueError:
            pass

# ================= Final Output Packaging =================
    details["audit_trails"] = audit_trails

    # The lists of faults to be hard-failed in Layer 0 (label as Time Paradox)
    critical_time_triggers = [
        "TIME_PARADOX_LOGIC",
        "ID_DATE_TIME_PARADOX",
        "DATE_FROM_FUTURE",
        "CHRONOLOGY_INCONSISTENCY",
        "SUMMON_TIME_PARADOX",
        "CONTRACT_TIME_PARADOX",
        "CROSS_LAYER_TIME_PARADOX"
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