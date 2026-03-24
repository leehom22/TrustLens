import json
import time
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form
from ..core.config import logger

# ------ Import for AI and DB connection ---------
from ..core.firebase import db

analysis_router = APIRouter()

# =============== Function for Restructuring Data (Frontend Display Structure) ==============

@analysis_router.post("/ai-restructure-data")
async def generate_document_dashboard(
    documentId: str = Form(...),
    document_raw_data: str = Form(...),
    file: UploadFile = File(...),
    language: str = Form("en"),   # Language option in frontend, default as English
):
    
    start_restructure = time.perf_counter()

    # -----------------------------
    # 1. Parse Raw Analysis JSON
    # -----------------------------
    try:
        raw_json = json.loads(document_raw_data)
    except Exception:
        return {"success": False, "error": "Invalid JSON in document_raw_data"}

    raw_analysis_id = raw_json.get("request_id", "unknown")
    evidence_chain = raw_json.get("evidence_chain", [])
    
    def find_layer(layer_name):
        return next((l for l in evidence_chain if l.get("layer_name") == layer_name), {})
    
    l1 = find_layer("L1_Metadata")
    l2 = find_layer("L2_Visual")
    l3 = find_layer("L3_Content")
    l4 = find_layer("L4_Logic")

    # -----------------------------
    # 2. I18N Static Dictionary
    # -----------------------------
    I18N_MAP = {
        "en": {
            # --- UI & Verdicts ---
            "UI_PASS": "PASS", "UI_FAIL": "FAIL", "UI_WARNING": "WARNING", "UI_SKIPPED": "SKIPPED",
            "UI_VERIFIED_PREFIX": "Verified: ",
            "VERDICT_CRITICAL": "Critical Risk Detected",
            "VERDICT_HIGH_RISK": "High Risk Detected",
            "VERDICT_SUSPICIOUS": "Suspicious Elements Found",
            "VERDICT_CAUTION": "Caution Advised",
            "VERDICT_SAFE": "Document Verified",
            "VERDICT_CLEAN": "Document Verified",
            "VERDICT_UNKNOWN": "Analysis Complete",

            # --- Layer Titles ---
            "LAYER_L1_TITLE": "Metadata Forensics",
            "LAYER_L2_TITLE": "Visual Forensics",
            "LAYER_L3_TITLE": "Content Extraction",
            "LAYER_L4_TITLE": "Logic Audit",

            # --- Fallback Messages ---
            "NO_AI_SUMMARY": "No AI summary available.",
            "REVIEW_MANUALLY": "Review document findings manually.",
            
            # --- General Risk Signals ---
            "STRUCTURE_HIDDEN_DATA": "Hidden data payload detected after file EOF.",
            "STRUCTURE_CORRUPTED_EOF": "Corrupted or strictly truncated file structure.",
            "HIGH_METADATA_SOFTWARE_RISK": "Edited with high-risk image manipulation software.",
            "MEDIUM_METADATA_SOFTWARE_RISK": "Processed by consumer-level PDF/Image tool.",
            "TIME_PARADOX_METADATA": "Logical Time Paradox: File created after it was modified.",
            "STRUCTURE_LOW_DPI_IMAGE": "DPI Forensic: Image resolution is below 150 DPI (possible screenshot/web download).",
            "STRUCTURE_INCREMENTAL_UPDATES": "Document History: Multiple incremental update states detected.",
            "STRUCTURE_FONT_MULTIPLE_SUBSETS": "Trace: Multiple font subsets detected (Possible localized editing).",
            "XMP_METADATA_MANIPULATION": "XMP Anomaly: Metadata was modified independently of the document content.",
            "XMP_SUSPICIOUS_ORIGIN": "XMP Anomaly: PDF was derived directly from an image/screenshot format.",
            "XMP_HIGH_RISK_CREATOR": "XMP Anomaly: Deep metadata reveals usage of high-risk graphic editing software.",
            "XMP_EXTENSIVE_EDIT_HISTORY": "XMP Anomaly: Unusually long modification history chain embedded in document.",
            "VISUAL_TAMPERING_DETECTED": "Inconsistent pixel quality indicating localized manipulation.",
            "ATS_HACKING_DETECTED": "Document Integrity: Hidden formatting anomalies identified (ATS Hacking).",
            "SCAM_PATTERN_DETECTED": "Social engineering or fraud language patterns identified.",
            "SEMANTIC_PARADOX_DETECTED": "Internal logical contradictions found within the document text.",
            "FORMAT_VIOLATION_SCREENSHOT": "Format Violation: Screenshot detected instead of original document.",
            "MATH_ROW_MISMATCH": "Line item calculation does not match extracted total.",
            "MATH_TAX_LOGIC_FAIL": "Statutory tax calculation failed.",
            "MISSING_INVOICE_ID": "Missing unique document identifier (Invoice/Receipt No).",
            "MISSING_CORE_ACCOUNT_ID": "Bank Statement is missing core account identifier.",
            "MISSING_PAYMENT_ROUTE": "Invoice is missing bank account details for payment.",
            "MISSING_PAYMENT_PROOF": "Missing payment verification data (Account or Ref ID).",
            "BENEFICIARY_MISMATCH": "Account holder name does not match the vendor name.",
            "TIME_PARADOX_LOGIC": "Logical Error: Due Date is earlier than Document Issue Date.",
            "ID_DATE_TIME_PARADOX": "Impossible chronography: Transaction ID generated before document existed.",
            "ID_DATE_LAG_SUSPICIOUS": "Suspicious lag between transaction ID and receipt generation.",
            "ID_DATE_MISMATCH_STRICT": "Transaction ID belongs to a completely different day.",
            "LONG_ENTRY_DELAY": "Unusual processing delay extending beyond normal administrative window.",
            "DATE_FROM_FUTURE": "Transaction date is in the future relative to analysis time.",
            "CHRONOLOGY_INCONSISTENCY": "Sequential order of transactions is corrupted (Time Jump).",
            "BALANCE_RECONCILIATION_FAIL": "Opening Balance + Cash Flows does not equal Closing Balance.",
            "MATH_DEDUCTION_MISMATCH": "Payslip deductions breakdown does not sum up to the total deductions.",
            "MATH_NET_PAY_MISMATCH": "Payslip Net Pay calculation is incorrect.",
            "INVALID_ISSUING_AGENCY": "Document issuing agency is not recognized as a valid authority.",
            "SUMMON_TIME_PARADOX": "Impossible timeline: Offence occurred after the summon was issued or due.",
            "ENTITY_SYMMETRY_VIOLATION": "High Risk: Contract appears to be self-dealing (Party A matches Party B).",
            "CONTRACT_TIME_PARADOX": "Logical error: Contract expires before it takes effect.",
            "MYKAD_INVALID_STATE": "MyKad structural error: Invalid State/Country PB code.",
            "MYKAD_INVALID_DOB": "MyKad structural error: Date of birth is physically impossible.",
            "MYKAD_MINOR_SIGNATORY": "Legal compliance risk: Signatory is a minor (< 18 years old).",
            "MYKAD_AGE_ANOMALY": "Identity anomaly: Signatory age is unusually high (> 100 years old).",
            "CROSS_LAYER_TIME_PARADOX": "Critical Forgery: Physical file was finalized before the transaction occurred.",
            "CROSS_LAYER_TEMPLATE_ANOMALY": "Warning: Document date significantly exceeds the file's last physical modification date.",

            # --- Layer 1 Data ---
            "GENERATOR_PREFIX": "Document Generator: ",
            "XMP_TITLE": "--- XMP FORENSIC SIGNALS ---",
            "HIGH_RISK_SOFTWARE": "Edited with high-risk image software: {tool}",
            "MEDIUM_RISK_SOFTWARE": "Processed by consumer tool: {tool}",
            "TIME_PARADOX_DELTA": "Logical Time Paradox: Created {delta}s AFTER Modified.",
            "INCREMENTAL_UPDATES": "Document History: Multiple incremental update states detected.",
            "CORRUPTED_EOF": "CRITICAL: Corrupted or strictly truncated file structure.",
            "HIDDEN_DATA": "CRITICAL: Found {bytes} bytes of hidden data after EOF.",
            "LOW_DPI_IMAGE": "DPI Forensic: Found {count} low resolution image(s) (<150 DPI).",
            "FONT_SUBSET_ANOMALY": "Font Trace: Multiple subsets of '{font}' detected.",
            "L1_DATES": "Created at: {c_date} | Modified at: {m_date}",
            "NO_EXIF": "Metadata missing (Context: Web/Screenshot)",
            
            # --- Layer 2 Data ---
            "MODE_NATIVE": "Visual Analysis Mode: Native Digital",
            "MODE_NOISY": "Visual Analysis Mode: Scanned / Noisy",
            "Z_SCORE": "Peak ELA Anomaly (Z-Score): {z}",
            "ATS_WHITE_TEXT": "Evidence: Invisible white-on-white text layers found.",
            "ATS_MICRO_FONT": "Evidence: Suspicious micro-sized fonts (< 2pt) used.",
            
            # --- Layer 3 Data ---
            "MIXED_FONTS": "Multiple inconsistent font types detected across text layout.",
            "MISALIGNED": "Text bounding box misalignments detected in table or layout.",

            # --- L4 Audit Name Codes ---
            "AUDIT_FORMAT_CHECK": "Format Check",
            "AUDIT_ROW_AUDIT_MODE": "Row Audit Mode",
            "AUDIT_ROW_MATH_CHECK": "Row Math Check",
            "AUDIT_ROW_AUDIT_SUMMARY": "Row Audit Summary",
            "AUDIT_TAX_CONSISTENCY": "Tax Consistency",
            "AUDIT_TAX_MULTIPLIER": "Tax Multiplier",
            "AUDIT_COMPLIANCE_CHECK": "Compliance Check",
            "AUDIT_PAYMENT_TRACEABILITY": "Payment Traceability",
            "AUDIT_BENEFICIARY_CHECK": "Beneficiary Check",
            "AUDIT_DATE_LOGIC": "Date Logic",
            "AUDIT_REALTIME_ID": "Real-time ID Sync",
            "AUDIT_LOGIC_CHECK": "Logic Check",
            "AUDIT_BATCH_VALIDITY": "Batch Validity",
            "AUDIT_REAL_WORLD_SANITY": "Real-World Sanity",
            "AUDIT_TIMELINE_LOGIC": "Timeline Logic",
            "AUDIT_TIMELINE_AUDIT": "Timeline Audit",
            "AUDIT_BALANCE_RECONCILIATION": "Balance Reconciliation",
            "AUDIT_DEDUCTION_MATH": "Deduction Math",
            "AUDIT_NET_PAY_MATH": "Net Pay Math",
            "AUDIT_AGENCY_VERIFICATION": "Agency Verification",
            "AUDIT_SUMMON_TIMELINE": "Summon Timeline",
            "AUDIT_ENTITY_SYMMETRY": "Entity Symmetry",
            "AUDIT_VALIDITY_PERIOD": "Validity Period",
            "AUDIT_IDENTITY_VERIFICATION": "Identity Verification",
            "AUDIT_CROSS_LAYER_SYNC": "Cross-Layer Sync",

            # --- L4 Reason Codes ---
            "REASON_HIGH_RISK_MANIPULATION": "High risk of manipulation.",
            "REASON_ALLOWED_FOR_TYPE": "Allowed for this document type.",
            "REASON_NO_SCREENSHOT_ARTIFACTS": "No screenshot artifacts found.",
            "REASON_GROSS_MATCH_DESPITE_ROW_ERROR": "Row math error, but total sums perfectly match.",
            "REASON_UNEXPLAINED_DISCREPANCY": "Unexplained numerical discrepancy.",
            "REASON_MATH_INCONSISTENCIES_DETECTED": "Math inconsistencies detected.",
            "REASON_ALL_ITEMS_VERIFIED": "Verified.",
            "REASON_TAX_DIFFERENCE": "Tax mismatch detected.",
            "REASON_MATCH": "Math matches.",
            "REASON_STATUTORY_TAX_MISMATCH": "Statutory tax calculation does not match stated amount.",
            "REASON_STATUTORY_MATH_PERFECT": "Statutory math perfectly matches.",
            "REASON_MISSING_UNIQUE_ID": "Missing unique identifier.",
            "REASON_BANK_STMT_MISSING_ID": "Bank Statement missing core account identifier.",
            "REASON_CORE_ID_VERIFIED": "Core ID verified.",
            "REASON_INVOICE_MISSING_ACCOUNT": "Invoice missing bank account details for payment.",
            "REASON_STANDARD_INVOICE_FORMAT": "Standard invoice format.",
            "REASON_MISSING_PAYMENT_VERIFICATION": "Missing payment verification data.",
            "REASON_TRACEABLE_TRANSACTION": "Traceable transaction.",
            "REASON_POTENTIAL_INJECTION_FRAUD": "Potential Injection Fraud: Account holder does not match vendor.",
            "REASON_DESTINATION_MATCHES_VENDOR": "Payment destination matches vendor.",
            "REASON_DUE_BEFORE_INVOICE": "Logical Error: Due date is before the invoice date.",
            "REASON_ID_FROM_FUTURE": "Impossible: Transaction ID generated in the future.",
            "REASON_PERFECT_REALTIME_MATCH": "Perfect real-time match.",
            "REASON_ERECEIPT_DAY_MISMATCH": "E-receipt logic failure: Transaction ID lag.",
            "REASON_DOC_BEFORE_ID": "Critical: Document issued before ID generation.",
            "REASON_WITHIN_MANUAL_WINDOW": "Within acceptable manual entry window.",
            "REASON_UNUSUAL_DELAY": "Unusual processing delay.",
            "REASON_TRANSACTION_IN_FUTURE": "Transaction is in the future relative to analysis time.",
            "REASON_SYSTEMATIC_TIMELINE_BREACH": "Critical: Systematic timeline breach in financial record.",
            "REASON_LOGICAL_SEQUENCE_ERROR": "Caution: Logical sequence error in document items.",
            "REASON_TIMELINE_CONSISTENT": "Timeline is consistent.",
            "REASON_DEDUCTIONS_DONT_ADD_UP": "Deduction items don't add up.",
            "REASON_BREAKDOWN_VERIFIED": "Breakdown math verified.",
            "REASON_NET_PAY_CALC_FAILED": "Net pay calculation failed.",
            "REASON_NET_PAY_VERIFIED": "Net pay math verified.",
            "REASON_UNRECOGNIZED_AUTHORITY": "Issuing agency not recognized as a valid authority.",
            "REASON_VALID_AUTHORITY": "Valid issuing authority.",
            "REASON_OFFENCE_AFTER_ISSUE": "Impossible timeline: Offence occurred after notice was issued.",
            "REASON_OFFENCE_AFTER_DUE": "Impossible timeline: Due date is before the offence.",
            "REASON_SELF_DEALING_CIRCULAR": "High Risk: Contract appears to be self-dealing.",
            "REASON_PARTIES_DISTINCT": "Parties are appropriately distinct.",
            "REASON_EXPIRES_BEFORE_EFFECTIVE": "Logical error: Contract expires before it takes effect.",
            "REASON_MYKAD_INVALID_STATE": "State/Country code is technically invalid.",
            "REASON_MYKAD_INVALID_DOB": "Date of Birth is physically impossible.",
            "REASON_MYKAD_MINOR_SIGNATORY": "Signatory is under 18 years old.",
            "REASON_MYKAD_AGE_ANOMALY": "Signatory age is unlikely (>100).",
            "REASON_MYKAD_VERIFIED": "Date logic and JPN state code passed.",
            "REASON_RETROACTIVE_FORGERY": "Critical: Retroactive document was finalized before transaction.",
            "REASON_TIMELINE_ALIGNS": "Meta-to-Content timeline aligns with physical causality.",
            "REASON_TEMPLATE_ANOMALY": "Anomaly: Dated suspiciously after file was last touched. Verify template.",
            "REASON_NORMAL_TEMPLATE_WINDOW": "Within normal template drafting window."
        },
        "ms": {
            # --- UI & Verdicts ---
            "UI_PASS": "LULUS", "UI_FAIL": "GAGAL", "UI_WARNING": "AMARAN", "UI_SKIPPED": "DILANGKAU",
            "UI_VERIFIED_PREFIX": "Disahkan: ",
            "VERDICT_CRITICAL": "Risiko Kritikal Dikesan",
            "VERDICT_HIGH_RISK": "Risiko Tinggi Dikesan",
            "VERDICT_SUSPICIOUS": "Unsur Mencurigakan Ditemui",
            "VERDICT_CAUTION": "Berhati-hati Disarankan",
            "VERDICT_SAFE": "Dokumen Disahkan",
            "VERDICT_CLEAN": "Dokumen Disahkan",
            "VERDICT_UNKNOWN": "Analisis Selesai",

            # --- Layer Titles ---
            "LAYER_L1_TITLE": "Forensik Metadata",
            "LAYER_L2_TITLE": "Forensik Visual",
            "LAYER_L3_TITLE": "Pengekstrakan Kandungan",
            "LAYER_L4_TITLE": "Audit Logik",

            # --- Fallback Messages ---
            "NO_AI_SUMMARY": "Tiada ringkasan AI tersedia.",
            "REVIEW_MANUALLY": "Semak penemuan dokumen secara manual.",
            
            # --- General Risk Signals ---
            "STRUCTURE_HIDDEN_DATA": "Data tersembunyi dikesan selepas EOF fail.",
            "STRUCTURE_CORRUPTED_EOF": "Struktur fail rosak atau terpotong dengan ketat.",
            "HIGH_METADATA_SOFTWARE_RISK": "Disunting dengan perisian manipulasi imej berisiko tinggi.",
            "MEDIUM_METADATA_SOFTWARE_RISK": "Diproses oleh alat pengguna PDF/Imej biasa.",
            "TIME_PARADOX_METADATA": "Paradoks Masa Logik: Fail dicipta selepas ia diubah suai.",
            "STRUCTURE_LOW_DPI_IMAGE": "Forensik DPI: Resolusi imej di bawah 150 DPI (mungkin tangkapan skrin).",
            "STRUCTURE_INCREMENTAL_UPDATES": "Sejarah Dokumen: Pelbagai kemas kini berperingkat dikesan.",
            "STRUCTURE_FONT_MULTIPLE_SUBSETS": "Jejak: Berbilang subset fon dikesan (Kemungkinan suntingan setempat).",
            "XMP_METADATA_MANIPULATION": "Anomali XMP: Metadata diubah tanpa pengubahsuaian kandungan fail.",
            "XMP_SUSPICIOUS_ORIGIN": "Anomali XMP: PDF berasal daripada format gambar/tangkapan skrin.",
            "XMP_HIGH_RISK_CREATOR": "Anomali XMP: Metadata mendalam mendedahkan penggunaan perisian berisiko.",
            "XMP_EXTENSIVE_EDIT_HISTORY": "Anomali XMP: Sejarah pengubahsuaian yang terlalu panjang.",
            "VISUAL_TAMPERING_DETECTED": "Kualiti piksel tidak konsisten menunjukkan manipulasi setempat.",
            "ATS_HACKING_DETECTED": "Integriti Dokumen: Anomali pemformatan tersembunyi dikenal pasti (ATS Hacking).",
            "SCAM_PATTERN_DETECTED": "Corak kejuruteraan sosial atau penipuan dikenal pasti.",
            "SEMANTIC_PARADOX_DETECTED": "Percanggahan logik dalaman ditemui dalam teks dokumen.",
            "FORMAT_VIOLATION_SCREENSHOT": "Pelanggaran Format: Tangkapan skrin dikesan, bukan dokumen asal.",
            "MATH_ROW_MISMATCH": "Pengiraan item baris tidak sepadan dengan jumlah yang diekstrak.",
            "MATH_TAX_LOGIC_FAIL": "Pengiraan cukai berkanun gagal.",
            "MISSING_INVOICE_ID": "Kehilangan pengecam unik dokumen (No Invois/Resit).",
            "MISSING_CORE_ACCOUNT_ID": "Penyata Bank kehilangan pengecam akaun utama.",
            "MISSING_PAYMENT_ROUTE": "Invois kehilangan butiran akaun bank untuk pembayaran.",
            "MISSING_PAYMENT_PROOF": "Kehilangan data pengesahan pembayaran (Akaun atau ID Rujukan).",
            "BENEFICIARY_MISMATCH": "Nama pemegang akaun tidak sepadan dengan nama vendor.",
            "TIME_PARADOX_LOGIC": "Ralat Logik: Tarikh Akhir lebih awal daripada Tarikh Keluaran Dokumen.",
            "ID_DATE_TIME_PARADOX": "Kronografi mustahil: ID Transaksi dijana sebelum dokumen wujud.",
            "ID_DATE_LAG_SUSPICIOUS": "Kelewatan mencurigakan antara penjanaan resit dan ID transaksi.",
            "ID_DATE_MISMATCH_STRICT": "ID Transaksi tergolong dalam hari yang berbeza sama sekali.",
            "LONG_ENTRY_DELAY": "Kelewatan pemprosesan yang luar biasa.",
            "DATE_FROM_FUTURE": "Tarikh transaksi berada pada masa hadapan berbanding masa analisis.",
            "CHRONOLOGY_INCONSISTENCY": "Susunan berurutan transaksi rosak (Lompatan Masa).",
            "BALANCE_RECONCILIATION_FAIL": "Baki Awal + Aliran Tunai tidak sama dengan Baki Akhir.",
            "MATH_DEDUCTION_MISMATCH": "Pecahan potongan slip gaji tidak bersamaan dengan jumlah potongan.",
            "MATH_NET_PAY_MISMATCH": "Pengiraan Gaji Bersih slip gaji adalah tidak betul.",
            "INVALID_ISSUING_AGENCY": "Agensi pengeluar dokumen tidak diiktiraf sebagai pihak berkuasa yang sah.",
            "SUMMON_TIME_PARADOX": "Garis masa mustahil: Kesalahan berlaku selepas saman dikeluarkan atau tamat tempoh.",
            "ENTITY_SYMMETRY_VIOLATION": "Risiko Tinggi: Kontrak kelihatan seperti urusan sendiri (Pihak A = Pihak B).",
            "CONTRACT_TIME_PARADOX": "Ralat Logik: Kontrak tamat tempoh sebelum ia berkuat kuasa.",
            "MYKAD_INVALID_STATE": "Ralat struktur MyKad: Kod Negeri tidak sah.",
            "MYKAD_INVALID_DOB": "Ralat struktur MyKad: Tarikh lahir mustahil dari segi fizikal.",
            "MYKAD_MINOR_SIGNATORY": "Risiko pematuhan: Penandatangan adalah di bawah umur (< 18 tahun).",
            "MYKAD_AGE_ANOMALY": "Anomali identiti: Umur penandatangan terlalu tinggi (> 100 tahun).",
            "CROSS_LAYER_TIME_PARADOX": "Pemalsuan Kritikal: Fail fizikal dimuktamadkan sebelum transaksi berlaku.",
            "CROSS_LAYER_TEMPLATE_ANOMALY": "Amaran: Tarikh dokumen jauh melebihi tarikh pengubahsuaian fizikal terakhir fail.",
            
            # --- Layer 1 Data ---
            "GENERATOR_PREFIX": "Penjana Dokumen: ",
            "XMP_TITLE": "--- ISYARAT FORENSIK XMP ---",
            "HIGH_RISK_SOFTWARE": "Disunting dengan perisian berisiko tinggi: {tool}",
            "MEDIUM_RISK_SOFTWARE": "Diproses oleh alat pengguna: {tool}",
            "TIME_PARADOX_DELTA": "Paradoks Masa Logik: Dicipta {delta}s SELEPAS Diubah Suai.",
            "INCREMENTAL_UPDATES": "Sejarah Dokumen: Pelbagai kemas kini berperingkat dikesan.",
            "CORRUPTED_EOF": "KRITIKAL: Struktur fail rosak atau terpotong.",
            "HIDDEN_DATA": "KRITIKAL: Terjumpa {bytes} bait data tersembunyi selepas EOF.",
            "LOW_DPI_IMAGE": "Forensik DPI: Terjumpa {count} imej beresolusi rendah (<150 DPI).",
            "FONT_SUBSET_ANOMALY": "Jejak Fon: Pelbagai subset '{font}' dikesan.",
            "L1_DATES": "Dicipta: {c_date} | Diubah: {m_date}",
            "NO_EXIF": "Metadata hilang (Konteks: Web/Tangkapan Skrin)",

            # --- Layer 2 Data ---
            "MODE_NATIVE": "Mod Analisis Visual: Digital Asli",
            "MODE_NOISY": "Mod Analisis Visual: Imbasan / Berhingar",
            "Z_SCORE": "Anomali ELA Puncak (Skor-Z): {z}",
            "ATS_WHITE_TEXT": "Bukti: Lapisan teks putih-atas-putih tersembunyi ditemui.",
            "ATS_MICRO_FONT": "Bukti: Fon bersaiz mikro mencurigakan (< 2pt) digunakan.",

            # --- Layer 3 Data ---
            "MIXED_FONTS": "Pelbagai jenis fon yang tidak konsisten dikesan.",
            "MISALIGNED": "Ketidaksejajaran kotak sempadan teks dikesan dalam susun atur.",

            # --- L4 Audit Name Codes ---
            "AUDIT_FORMAT_CHECK": "Semakan Format",
            "AUDIT_ROW_AUDIT_MODE": "Mod Audit Baris",
            "AUDIT_ROW_MATH_CHECK": "Semakan Matematik Baris",
            "AUDIT_ROW_AUDIT_SUMMARY": "Ringkasan Audit Baris",
            "AUDIT_TAX_CONSISTENCY": "Konsistensi Cukai",
            "AUDIT_TAX_MULTIPLIER": "Pendarab Cukai",
            "AUDIT_COMPLIANCE_CHECK": "Semakan Pematuhan",
            "AUDIT_PAYMENT_TRACEABILITY": "Kesan Pembayaran",
            "AUDIT_BENEFICIARY_CHECK": "Semakan Penerima",
            "AUDIT_DATE_LOGIC": "Logik Tarikh",
            "AUDIT_REALTIME_ID": "Segerak ID Masa Nyata",
            "AUDIT_LOGIC_CHECK": "Semakan Logik",
            "AUDIT_BATCH_VALIDITY": "Kesahan Kelompok",
            "AUDIT_REAL_WORLD_SANITY": "Kewarasan Dunia Nyata",
            "AUDIT_TIMELINE_LOGIC": "Logik Garis Masa",
            "AUDIT_TIMELINE_AUDIT": "Audit Garis Masa",
            "AUDIT_BALANCE_RECONCILIATION": "Penyelarasan Baki",
            "AUDIT_DEDUCTION_MATH": "Matematik Potongan",
            "AUDIT_NET_PAY_MATH": "Matematik Gaji Bersih",
            "AUDIT_AGENCY_VERIFICATION": "Pengesahan Agensi",
            "AUDIT_SUMMON_TIMELINE": "Garis Masa Saman",
            "AUDIT_ENTITY_SYMMETRY": "Simetri Entiti",
            "AUDIT_VALIDITY_PERIOD": "Tempoh Sah Laku",
            "AUDIT_IDENTITY_VERIFICATION": "Pengesahan Identiti",
            "AUDIT_CROSS_LAYER_SYNC": "Segerak Rentas-Lapisan",

            # --- L4 Reason Codes ---
            "REASON_HIGH_RISK_MANIPULATION": "Risiko manipulasi tinggi.",
            "REASON_ALLOWED_FOR_TYPE": "Dibenarkan untuk jenis dokumen ini.",
            "REASON_NO_SCREENSHOT_ARTIFACTS": "Tiada artifak tangkapan skrin ditemui.",
            "REASON_GROSS_MATCH_DESPITE_ROW_ERROR": "Ralat baris, tetapi jumlah keseluruhan tepat.",
            "REASON_UNEXPLAINED_DISCREPANCY": "Percanggahan angka yang tidak dapat dijelaskan.",
            "REASON_MATH_INCONSISTENCIES_DETECTED": "Ketidakkonsistenan matematik dikesan.",
            "REASON_ALL_ITEMS_VERIFIED": "Disahkan.",
            "REASON_TAX_DIFFERENCE": "Perbezaan cukai dikesan.",
            "REASON_MATCH": "Matematik sepadan.",
            "REASON_STATUTORY_TAX_MISMATCH": "Pengiraan cukai berkanun tidak sepadan.",
            "REASON_STATUTORY_MATH_PERFECT": "Matematik berkanun sepadan dengan sempurna.",
            "REASON_MISSING_UNIQUE_ID": "Kehilangan pengecam unik.",
            "REASON_BANK_STMT_MISSING_ID": "Penyata Bank kehilangan pengecam akaun utama.",
            "REASON_CORE_ID_VERIFIED": "ID teras disahkan.",
            "REASON_INVOICE_MISSING_ACCOUNT": "Invois kehilangan butiran akaun bank untuk pembayaran.",
            "REASON_STANDARD_INVOICE_FORMAT": "Format invois standard.",
            "REASON_MISSING_PAYMENT_VERIFICATION": "Kehilangan data pengesahan pembayaran.",
            "REASON_TRACEABLE_TRANSACTION": "Transaksi boleh dikesan.",
            "REASON_POTENTIAL_INJECTION_FRAUD": "Potensi Penipuan: Pemegang akaun tidak sepadan vendor.",
            "REASON_DESTINATION_MATCHES_VENDOR": "Destinasi pembayaran sepadan dengan vendor.",
            "REASON_DUE_BEFORE_INVOICE": "Ralat Logik: Tarikh akhir sebelum tarikh invois.",
            "REASON_ID_FROM_FUTURE": "Mustahil: ID Transaksi dijana pada masa hadapan.",
            "REASON_PERFECT_REALTIME_MATCH": "Padanan masa nyata yang sempurna.",
            "REASON_ERECEIPT_DAY_MISMATCH": "Kegagalan e-resit: Kelewatan ID Transaksi.",
            "REASON_DOC_BEFORE_ID": "Kritikal: Dokumen dikeluarkan sebelum ID dijana.",
            "REASON_WITHIN_MANUAL_WINDOW": "Dalam tetingkap kemasukan manual yang dibenarkan.",
            "REASON_UNUSUAL_DELAY": "Kelewatan pemprosesan yang luar biasa.",
            "REASON_TRANSACTION_IN_FUTURE": "Transaksi berada pada masa hadapan.",
            "REASON_SYSTEMATIC_TIMELINE_BREACH": "Kritikal: Pelanggaran garis masa sistematik.",
            "REASON_LOGICAL_SEQUENCE_ERROR": "Awas: Ralat susunan logik dalam item dokumen.",
            "REASON_TIMELINE_CONSISTENT": "Garis masa konsisten.",
            "REASON_DEDUCTIONS_DONT_ADD_UP": "Item potongan tidak tally.",
            "REASON_BREAKDOWN_VERIFIED": "Matematik pecahan disahkan.",
            "REASON_NET_PAY_CALC_FAILED": "Pengiraan gaji bersih gagal.",
            "REASON_NET_PAY_VERIFIED": "Matematik gaji bersih disahkan.",
            "REASON_UNRECOGNIZED_AUTHORITY": "Agensi pengeluar bukan pihak berkuasa yang sah.",
            "REASON_VALID_AUTHORITY": "Pihak berkuasa pengeluar yang sah.",
            "REASON_OFFENCE_AFTER_ISSUE": "Garis masa mustahil: Kesalahan berlaku selepas notis.",
            "REASON_OFFENCE_AFTER_DUE": "Garis masa mustahil: Tarikh akhir sebelum kesalahan.",
            "REASON_SELF_DEALING_CIRCULAR": "Risiko Tinggi: Kontrak kelihatan seperti urusan sendiri.",
            "REASON_PARTIES_DISTINCT": "Pihak adalah berbeza secara bersesuaian.",
            "REASON_EXPIRES_BEFORE_EFFECTIVE": "Ralat logik: Kontrak tamat tempoh sebelum berkuat kuasa.",
            "REASON_MYKAD_INVALID_STATE": "Kod Negeri tidak sah secara teknikal.",
            "REASON_MYKAD_INVALID_DOB": "Tarikh Lahir mustahil secara fizikal.",
            "REASON_MYKAD_MINOR_SIGNATORY": "Penandatangan berumur bawah 18 tahun.",
            "REASON_MYKAD_AGE_ANOMALY": "Umur penandatangan terlalu tinggi (>100).",
            "REASON_MYKAD_VERIFIED": "Logik tarikh dan kod negeri JPN lulus.",
            "REASON_RETROACTIVE_FORGERY": "Kritikal: Dokumen retroaktif dimuktamadkan sebelum transaksi.",
            "REASON_TIMELINE_ALIGNS": "Garis masa Meta-Kandungan sejajar dengan kausaliti fizikal.",
            "REASON_TEMPLATE_ANOMALY": "Anomali: Tarikh dokumen jauh selepas fail diubah. Sahkan templat.",
            "REASON_NORMAL_TEMPLATE_WINDOW": "Dalam tetingkap penggubalan templat biasa."
        }
    }

    INTERNAL_SIGNAL_BLACKLIST = {"JSON_REPAIRED"}

    # -----------------------------
    # 3. Core Engine: Generate View for Specific Language
    # -----------------------------
    def build_view(target_lang: str):
        t_map = I18N_MAP.get(target_lang, I18N_MAP["en"])
        
        # Helper: Dictionary Translator
        def t(code: str, **kwargs) -> str:
            if not code: return ""
            tmpl = t_map.get(code, code)
            try: return tmpl.format(**kwargs)
            except: return tmpl

        def map_status_to_ui(status_str):
            if not status_str: return t("UI_SKIPPED"), "gray"
            status_map = {
                "clean": (t("UI_PASS"), "green"),
                "suspicious": (t("UI_WARNING"), "yellow"),
                "high_risk": (t("UI_FAIL"), "red"),
                "error": (t("UI_FAIL"), "red"),
                "skipped": (t("UI_SKIPPED"), "gray")
            }
            return status_map.get(status_str.lower(), (t("UI_SKIPPED"), "gray"))
        
        def get_ai_summary(layer_key):
            layer_summaries = raw_json.get("layer_summaries", {})
            if not layer_summaries: return t("NO_AI_SUMMARY")
            summary = layer_summaries.get(layer_key)
            if not summary: return t("NO_AI_SUMMARY")
            if isinstance(summary, dict):
                return summary.get(target_lang, summary.get("en", t("NO_AI_SUMMARY")))
            return str(summary)

        l1_status, l1_color = map_status_to_ui(l1.get("status"))
        l2_status, l2_color = map_status_to_ui(l2.get("status"))
        l3_status, l3_color = map_status_to_ui(l3.get("status"))
        l4_status, l4_color = map_status_to_ui(l4.get("status"))

        # ================= L1 Processing =================
        l1_proofs = [t(sig) for sig in l1.get("risk_signals", []) if sig not in INTERNAL_SIGNAL_BLACKLIST]
        l1_details = l1.get("details", {})
        
        if l1_details.get("producer_raw"):
            l1_proofs.append(f"{t('GENERATOR_PREFIX')}{l1_details['producer_raw']}")

        if soft_risk := l1_details.get("software_risk"):
            l1_proofs.append(t(soft_risk.get("code"), **soft_risk.get("params", {})))  

        if time_para := l1_details.get("time_paradox"):
            l1_proofs.append(t(time_para.get("code"), **time_para.get("params", {})))

        for note in l1_details.get("structure", {}).get("structure_notes", []):
            l1_proofs.append(t(note.get("code"), **note.get("params", {})))

        if l1_details.get("pdf_creation_date"):
            l1_proofs.append(t("L1_DATES", c_date=l1_details['pdf_creation_date'], m_date=l1_details.get('pdf_mod_date', '')))

        xmp_data = l1_details.get("xmp_data", {})
        if xmp_data:
            l1_proofs.append(t("XMP_TITLE"))
            for k, v in xmp_data.items(): l1_proofs.append(f"XMP {k}: {v}")


        # ================= L2 Processing =================
        l2_proofs = [t(sig) for sig in l2.get("risk_signals", []) if sig not in INTERNAL_SIGNAL_BLACKLIST]
        l2_details = l2.get("details", {})
        
        if l2_details.get("mode"): l2_proofs.append(t(f"MODE_{l2_details['mode']}"))
        
        worst_metrics = l2_details.get("worst_page_details", {}).get("metrics", {})
        if worst_metrics.get("max_z_score", 0) > 0:
            l2_proofs.append(t("Z_SCORE", z=f"{worst_metrics['max_z_score']:.2f}"))
            
        ats_hacking = l2.get("ATS_Hacking")
        ats_details = l2_details.get("ats_hacking_details", {})
        if ats_details and ats_details.get("hidden_white_chars", 0) > 0: l2_proofs.append(t("ATS_WHITE_TEXT"))
        if ats_details and ats_details.get("micro_font_chars", 0) > 0: l2_proofs.append(t("ATS_MICRO_FONT"))

        evidence_urls = []
        if l2.get("visual_evidence_url"): evidence_urls.append(l2["visual_evidence_url"])
        for page in l2_details.get("all_pages", []):
            if url := page.get("url"):
                if url not in evidence_urls: evidence_urls.append(url)


        # ================= L3 Processing =================
        l3_proofs = [t(sig) for sig in l3.get("risk_signals", []) if sig not in INTERNAL_SIGNAL_BLACKLIST]
        l3_details = l3.get("details", {})
        vis_elements = l3_details.get("visual_elements", {})

        if vis_elements.get("mixed_fonts"): l3_proofs.append(t("MIXED_FONTS"))
        if vis_elements.get("misaligned_layout"): l3_proofs.append(t("MISALIGNED"))
        
        reasoning = l3_details.get("forensic_reasoning_trace", {})
        # Handle AI multi-lingual paradoxes & scams safely
        for p in reasoning.get("internal_semantic_paradoxes", []):
            val = p.get(target_lang, p.get("en", str(p))) if isinstance(p, dict) else str(p)
            l3_proofs.append(f"Paradox: {val}")
        for s in reasoning.get("scam_pattern_analysis", []):
            val = s.get(target_lang, s.get("en", str(s))) if isinstance(s, dict) else str(s)
            l3_proofs.append(f"Scam Trace: {val}")
        
        # Extract AI Agent Summary
        agent_dict = raw_json.get("agent_summary", {})
        if isinstance(agent_dict, dict):
            agent_summary = agent_dict.get(target_lang, agent_dict.get("en", "No summary available."))
        else:
            agent_summary = str(agent_dict)


        # ================= L4 Processing =================
        l4_proofs = []
        audit_trails = l4.get("details", {}).get("audit_trails", [])
        fails = [a for a in audit_trails if a.get("status") == "FAIL"]

        # Process Audit Trails formatting
        for f in fails[:4]:
            c_name = t("AUDIT_" + f.get("check_name_code", ""))
            c_reason = t("REASON_" + f.get("reason_code", ""))
            visual = f.get("visual_feedback", "")
            # Assemble: [Check Name] 5.0 + 0 != 6.0 - Reason
            if visual and visual != "NULL":
                l4_proofs.append(f"[{c_name}] {visual} - {c_reason}")
            else:
                l4_proofs.append(f"[{c_name}] {c_reason}")

        if not fails:
            passes = [a for a in audit_trails if a.get("status") == "PASS"]
            for p in passes[:2]:
                c_name = t("AUDIT_" + p.get("check_name_code", ""))
                c_reason = t("REASON_" + p.get("reason_code", ""))
                visual = p.get("visual_feedback", "")
                
                # Concatenation Example: "Verified: [Tax Consistency] 6% - Statutory math perfectly matches."
                if visual and visual != "NULL":
                    l4_proofs.append(f"{t('UI_VERIFIED_PREFIX')}[{c_name}] {visual} - {c_reason}")
                else:
                    l4_proofs.append(f"{t('UI_VERIFIED_PREFIX')}[{c_name}] {c_reason}")

        # Crop proofs
        def cleanup(proofs): return list(dict.fromkeys(proofs))[:6]

        ats_hacking = l2.get("ATS_Hacking")
        
        layer_results = [
            {
                "layer_id": "L1", "layer_title": t("LAYER_L1_TITLE"),
                "status": l1_status, "status_color": l1_color, "icon": "file-text",
                "score": l1.get("score", 0), "technical_proofs": cleanup(l1_proofs),
                "ai_analysis": get_ai_summary("L1_Metadata"),
                "has_visual_evidence": False, "evidence_image_url": []
            },
            {
                "layer_id": "L2", "layer_title": t("LAYER_L2_TITLE"),
                "status": l2_status, "status_color": l2_color, "icon": "eye",
                "score": l2.get("score", 0), "technical_proofs": cleanup(l2_proofs),
                "ai_analysis": get_ai_summary("L2_Visual"),
                "has_visual_evidence": len(evidence_urls) > 0, "evidence_image_url": evidence_urls,
                "ATS_hacking": ats_hacking if ats_hacking else "None"
            },
            {
                "layer_id": "L3", "layer_title": t("LAYER_L3_TITLE"),
                "status": l3_status, "status_color": l3_color, "icon": "file-digit",
                "score": l3.get("score", 0), "technical_proofs": cleanup(l3_proofs),
                "ai_analysis": get_ai_summary("L3_Content"),
                "has_visual_evidence": False, "evidence_image_url": []
            },
            {
                "layer_id": "L4", "layer_title": t("LAYER_L4_TITLE"),
                "status": l4_status, "status_color": l4_color, "icon": "calculator",
                "score": l4.get("score", 0), "technical_proofs": cleanup(l4_proofs),
                "ai_analysis": get_ai_summary("L4_Logic"),
                "has_visual_evidence": False, "evidence_image_url": []
            }
        ]

        if l2_details.get("ats_hacking_details"):
            layer_results[1]["ats_hacking_details"] = l2_details["ats_hacking_details"]

        risk_level = raw_json.get("risk_level", "SAFE")
        risk_upper = str(risk_level).upper()
        verdict_title = t(f"VERDICT_{risk_upper}")
        if verdict_title == f"VERDICT_{risk_upper}":
            verdict_title = t("VERDICT_UNKNOWN")

        color_map = {"SAFE": "green", "CAUTION": "yellow", "SUSPICIOUS": "orange", "CRITICAL": "red", "HIGH_RISK": "red"}
        
        agent_dict = raw_json.get("agent_summary")
        if not agent_dict: agent_summary = t("NO_AI_SUMMARY")
        elif isinstance(agent_dict, dict): agent_summary = agent_dict.get(target_lang, agent_dict.get("en", t("NO_AI_SUMMARY")))
        else: agent_summary = str(agent_dict)

        notes_dict = raw_json.get("grounding_result", {}).get("notes", {})
        if isinstance(notes_dict, dict):
            grounding_ref = notes_dict.get(target_lang, notes_dict.get("en", ""))
        else:
            grounding_ref = str(notes_dict)
            
        next_step = raw_json.get("final_recommendation")
        if not next_step: next_step = t("REVIEW_MANUALLY")
        elif isinstance(next_step, dict): next_step = next_step.get(target_lang, next_step.get("en", t("REVIEW_MANUALLY")))
        else: next_step = t("REVIEW_MANUALLY") if str(next_step) == "Review document findings manually." else str(next_step)
        
        return {
            "ui_render_mode": "dashboard_v2",
            "document_id": raw_analysis_id,
            "processed_at": datetime.utcnow().isoformat(),
            "dashboard_header": {
                "overall_score": raw_json.get("overall_risk_score", 0),
                "risk_level": risk_level,
                "risk_level_color": color_map.get(str(risk_level).upper(), "gray"),
                "verdict_title": verdict_title,
                "ai_executive_summary": agent_summary,
                "grounding_search_reference": grounding_ref,
                "doc_type": raw_json.get("doc_type", "unknown"),
                "next_step_recommendation": next_step,
                "sources": raw_json.get("grounding_result", {}).get("sources", [])
            },
            "layer_results": layer_results
        }

    # -----------------------------
    # 4. Generate & Persist Dual-Language Data
    # -----------------------------
    # Generate both languages concurrently in memory
    i18n_payload = {
        "en": build_view("en"),
        "ms": build_view("ms")
    }

    db_payload = {
        "documentId": documentId,
        "raw_analysis_id": raw_analysis_id,
        "doc_type": raw_json.get("doc_type", "unknown"),
        "i18n_content": i18n_payload,   # Save BOTH to DB
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        db.collection("structure_analysis_result").add(db_payload)
        
        # Update upload_files overview based on EN base
        en_header = i18n_payload["en"]["dashboard_header"]
        upload_ref = db.collection('upload_files').document(documentId)
        if upload_ref.get().exists:
            upload_ref.update({
                "risk_level": en_header["risk_level"],
                "risk_level_color": en_header["risk_level_color"],
                "overall_score": en_header["overall_score"]
            })
    except Exception as e:
        logger.error(f"Firestore save error in restructure: {e}")

    restructure_duration_ms = int((time.perf_counter() - start_restructure) * 1000)
    logger.info(f"[AI_Restructure] generated i18n view in {restructure_duration_ms}ms")
    
    # -----------------------------
    # 5. Return the Requested Language Only
    # -----------------------------
    # Front-end requests "ms", we return i18n_payload["ms"]
    selected_view = i18n_payload.get(language, i18n_payload["en"])
    return {"success": True, "data": selected_view}