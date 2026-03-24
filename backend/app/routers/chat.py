import json
import logging
import os
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from google.cloud import firestore
from dotenv import load_dotenv
from ..core.auth import get_current_user
from ..core.firebase import db

# --- Load Config ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

PORT = int(os.getenv("PORT", 8080))

logger = logging.getLogger("TrustLens-Chat")
chat_router = APIRouter()


# ====================== Models & Schemas =======================
class ChatRequest(BaseModel):
    req_id: str = Field(..., description="Request ID")
    user_query: str = Field(..., description="The user's question")
    mode: str = Field(default="forensic_analyst", description="Active Persona Mode")
    user_type: str = Field(default="user", description="Type of user: 'user' or 'expert'"),
    language: str = Field(default="en", description="Current UI language: 'en' or 'ms'")

class ChatResponse(BaseModel):
    response: str
    suggested_actions: List[str] = []


# ========================= History & Persistence ======================
def get_chat_history(req_id: str, limit: int = 10, userType: str = "user"):
    # Retrieve recent chat history for context
    try:
        msgs_ref = db.collection("analysis_results").document(req_id).collection("messages").where("userType","==",userType)
        docs = msgs_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
        
        history = []
        for doc in docs:
            data = doc.to_dict()
            # Prevent empty history
            if data.get("content"):
                history.append({
                    "role": "user" if data["role"] == "user" else "model",
                    "parts": [data["content"]]
                })
        return history[::-1] # Reverse to chronological order
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        return []

def save_chat_message(req_id: str, user_id: str, role: str, content: str, user_type: str):
    # Save chat message to Firestore
    try:
        msgs_ref = db.collection("analysis_results").document(req_id).collection("messages")
        msgs_ref.add({
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "userType": user_type
        })
    except Exception as e:
        logger.error(f"Message save error: {e}")


# ========================= Defined Tools (With Strict Typing & Docstrings) =======================
def get_forensic_summary(req_id: str) -> Dict[str, Any]:
    """Retrieves the structured forensic analysis summary.

    Args:
        req_id: The unique identifier of the document.
        
    Returns:
        A dictionary containing Risk Scores, Fraud Signals, and Logic Audits.
    """
    try:
        doc_ref = db.collection("analysis_results").document(req_id)
        snapshot = doc_ref.get()
        
        if not snapshot.exists:
            return {"error": "Document not found."}
        
        record = snapshot.to_dict()
        evidence = record.get("evidence_chain", [])

        # Extract important info from JSON using layer name
        def get_layer(name_part):
            return next((e for e in evidence if name_part in e.get("layer_name", "")), {})

        return {
            "general": {
                "risk_score": record.get("overall_risk_score", 0),
                "risk_level": record.get("risk_level", "UNKNOWN"),
                "risk_signals": record.get("risk_signals", []),
                "agent_summary": record.get("agent_summary", "")
            },
            "visual_analysis": {
                "l1_score": get_layer("L1_Metadata").get("score", 0),
                "l1_signals": get_layer("L1_Metadata").get("risk_signals", []),
                "l1_details": get_layer("L1_Metadata").get("details", {}),
                "l2_score": get_layer("L2_Visual").get("score", 0),
                "l2_signals": get_layer("L2_Visual").get("risk_signals", []),
                "l2_details": get_layer("L2_Visual").get("details", {}),
                "visual_evidence_url": get_layer("L2_Visual").get("visual_evidence_url")
            },
            "logic_analysis": {
                "l3_score": get_layer("L3_Content").get("score", 0),
                "l3_signals": get_layer("L3_Content").get("risk_signals", []),
                "l4_audit_log": get_layer("L4_Logic").get("details", {}),
                "l4_signals": get_layer("L4_Logic").get("risk_signals", [])
            },
            "verification": {
                "grounding_info": record.get("grounding_info", {}),
                "status": record.get("verification_status", "UNKNOWN"),
                "grounding_result": record.get("grounding_result", {})
            }
        }
    except Exception as e:
        logger.error(f"Tool Error (get_forensic_summary): {e}")
        return {"error": str(e)}

def get_document_raw_text(req_id: str) -> Dict[str, Any]:
    # Retrieves the full raw text content of the document.
    # Use this ONLY when you need to read specific clauses, terms, or check compliance against laws.
    try:
        doc_ref = db.collection("analysis_results").document(req_id)
        snapshot = doc_ref.get(["raw_document_content", "grounding_info"])
        
        if not snapshot.exists:
            return {"error": "Document not found."}
        
        data = snapshot.to_dict()
        raw_text = data.get("raw_document_content", "")
        # Fallback for non-OCR docs
        if not raw_text:
            raw_text = str(data.get("grounding_info", {}))
            
        return {"raw_text_content": raw_text[:8000]} # Limit to 8000 chars
    except Exception as e:
        logger.error(f"Tool Error (get_document_raw_text): {e}")
        return {"error": str(e)}

# ! Change from async to sync (To avoid error)
def grounding_search_agent(query: str) -> Dict[str, Any]:
    print("====================== Performing grounding search ======================")
    """
    Delegates a search query to a specialized Search Sub-Agent.
    Use this when you need to verify external entities, laws, or company backgrounds on the internet.
    """
    search_client = genai.Client(api_key=GEMINI_API_KEY)
    
    sub_agent_prompt = f"""
    You are a Search Sub-Agent. 
    Use the Google Search tool to find factual information for the following query. 
    Extract the core facts, URLs, and relevant snippets. Do not add conversational filler.
    
    Query: {query}
    """
    
    try:
        # ! Remove await to avoid error
        response = search_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=sub_agent_prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.1   # Keep it factual and reduce hallucination
            )
        )
        return {
            "status": "success",
            "search_synthesis": response.text if response.text else "No relevant information found."
        }
    except Exception as e:
        logger.error(f"Search Sub-Agent Failed: {e}")
        return {"error": f"Search failed: {str(e)}"}

TOOL_IMPLEMENTATIONS = {
    "get_forensic_summary": get_forensic_summary,
    "get_document_raw_text": get_document_raw_text,
    "grounding_search": grounding_search_agent
}


# ========================= Tool Schemas (Declarations) =========================
"""
forensic_tool = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_forensic_summary",
            description="Retrieves the forensic analysis summary (Risk Scores, Signals, Logic Audits). Use this FIRST.",
            parameters={
                "type": "object",
                "properties": {
                    "req_id": {
                        "type": "string",
                        "description": "The unique identifier of the analysis request."
                    }
                },
                "required": ["req_id"]
            }
        )
    ]
)

raw_text_tool = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_document_raw_text",
            description="Retrieves the FULL raw text. Use ONLY when checking specific clauses.",
            parameters={
                "type": "object",
                "properties": {
                    "req_id": {
                        "type": "string",
                        "description": "The unique identifier of the analysis request."
                    }
                },
                "required": ["req_id"]
            }
        )
    ]
)

grounding_search_tool = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="grounding_search_agent",
            description="Delegates a search query to a specialized Search Sub-Agent for verifying external facts, laws, or company info.",
            parameters={
                "type": "object",
                "properties": {
                    "req_id": {
                        "type": "string",
                        "description": "The unique identifier of the analysis request."
                    }
                },
                "required": ["req_id"]
            }
        )
    ]
)

"""

# Google Search Tool Definition
# google_search_tool = types.Tool(google_search=types.GoogleSearch())


# ========================= Guardrails (Chat Content Boundaries) =========================

CORE_GUARDRAILS = """
--- GUIDELINES & GUARDRAILS ---
1. **SCOPE RESTRICTION**: 
   - You are TrustLens, a specialized Document Forensic AI. 
   - You MUST ONLY discuss the provided document, its risk analysis, legal compliance, or financial logic.
   - DO NOT engage in general chitchat, creative writing (poems/jokes), or answer questions unrelated to the document context.
2. **HANDLING OUT-OF-SCOPE**:
   - If the user asks about an unrelated topic (e.g., "What is the weather?", "Tell me a joke"), politely refuse.
   - Standard Refusal: "I specialize in forensic document analysis and cannot assist with general queries. Let's focus on the risks or details of this file."
3. **STEERING BACK (The "Pivot")**:
   - If the user's question is *tangential* (e.g., "What is the USD rate today?"), try to link it back to the document.
   - Example Pivot: "I don't track live market rates, but I can verify if the currency exchange calculation *in this invoice* is mathematically consistent."
   - Example Pivot: "I cannot discuss general law, but I can check if *this contract's clauses* comply with standard Malaysian regulations."
4. **TONE**: Professional, Objective, Vigilant.
5. **MULTILINGUAL & DECODING RULE (CRITICAL)**:
   - The internal tool data you receive contains raw system codes (e.g., `check_name_code: 'TAX_CONSISTENCY'`) and bilingual JSON summaries (e.g., `{"en": "...", "ms": "..."}`).
   - You MUST instantly decode these technical codes into natural, human-readable language. NEVER show raw uppercase system codes to the user.
   - You MUST reply in the EXACT SAME LANGUAGE the user is speaking. If the user asks in Bahasa Melayu, read the "ms" fields from the data and explain your findings fully in Bahasa Melayu.

"""

# ========================= Mode Configuration =========================

def get_mode_config(mode: str, req_id: str, ui_lang: str):
    print(f"==============The mode is {mode} with request Id {req_id}==============")
    # --- General Behavior ---
    UNIVERSAL_BEHAVIOR = f"""
    {CORE_GUARDRAILS}
    --- CONTEXT ---
    CURRENT TASK: Analyzing document with req_id: '{req_id}'.

    >>> QUERY-DRIVEN EXECUTION (CRITICAL) <<<
    Your ultimate goal is to answer the User's Query. 
    However, you must filter your answer through your assigned ROLE and verify the facts using your TOOLS before speaking.
    - If the user asks a specific question (e.g., about a clause, a calculation, or a risk), use your tools to target that specific information.
    - DO NOT blindly dump the whole document analysis unless the user explicitly asks for a general summary.
    - If the user query involves info not found in the tool outputs, truthfully state that the document does not contain it. Do not hallucinate.

    >>> MANDATORY SECURITY INTERCEPTOR (CRITICAL) <<<
    Before answering ANY query about the document's content, you must ensure you know its forensic integrity. 
    If you haven't reviewed the forensic summary in this conversation context yet, ALWAYS call `get_forensic_summary` first, even if the user only asks about the text. Do not blindly trust the text of a forged document.

    >>> UI CONTEXT (CRITICAL) <<<
    The user is currently viewing the dashboard in: {ui_lang.upper()}.
    - If the UI is 'MS', they see titles like 'Risiko Kritikal Dikesan'.
    - If the UI is 'EN', they see 'Critical Risk Detected'.
    Always ensure your mentioned verdicts align with this UI language to avoid confusion.
    """

    # --- TRUSTLENS KNOWLEDGE BASE (INTERNAL MECHANISMS) ---
    
    # 1. Forensic & Technical Knowledge
    ORIGINAL_FORENSIC_KNOWLEDGE = """
    ### 1. DOCUMENT PROFILES (TRUST LIMITS)
    - **Strict Financial** (Bank/Payslip): System-PDF ONLY. Adobe/Canva = FRAUD. No Screenshots. Perfect Math/Dates required.
    - **Transactional** (Invoice/Receipt): Screenshots/Mobile OK. Invoices MUST have account numbers.
    - **Creative/Personal** (Resume/Cert): Canva/Word ALLOWED. Focus: ATS Cheating (Hidden Text) & Visual Splicing.
    - **Legal** (Contract): Strict Chronology. NO editing traces/software signatures.

    ### 2. FORENSIC SIGNAL LEXICON (MECHANISM & RATIONALE)
    When explaining `risk_signals` to users, use these exact forensic mechanisms. DO NOT mention code or Python.

    **[Layer 1: Structural & Metadata]**
    - `STRUCTURE_LOW_DPI_IMAGE`: Image resolution is <150 DPI. Proves it's a web-compressed screenshot, not an original system-generated PDF.
    - `STRUCTURE_INCREMENTAL_UPDATES`: Multiple `%%EOF` markers detected. Proves the file was re-saved/edited after its initial generation.
    - `STRUCTURE_FONT_MULTIPLE_SUBSETS`: Redundant font dictionaries detected. Indicates manual text box injection via PDF editors.
    - `XMP_*` / `HIGH_METADATA_SOFTWARE_RISK`: Deep XML/EXIF metadata reveals graphic software usage (e.g., Photoshop) or image derivation (.png), contradicting text-based document norms.

    **[Layer 2: Visual & Pixel]**
    - Hybrid Architecture: Dynamically classifies documents as "Native Digital" or "Noisy/Scan" (via PDF image coverage or Laplacian variance).
    - ELA (Error Level Analysis): Detects compression artifacts and local anomalies. A high Max Z-Score strongly indicates manipulation. Yellow colour (z-score > 3.0) and orange colour (z-score > 1.5) numbers shown in the heatmap considered as high values.
    - ATS Hacking: Native PDFs only. Detects hidden prompt injections and keyword stuffing (e.g., invisible white-on-white characters or micro-fonts <2pt).
    - Black Level: Detects 'Digital Insertion'. Finds artificially pure black text or elements pasted onto lighter, natural document backgrounds.
    - Texture / Statistical Islands: Detects 'Smoothing' or 'Erasing'. Identifies abnormally smooth patches that lack the expected background noise or variance (indicating smudging, patching, or cloning).
    - `VISUAL_TAMPERING_DETECTED`: Fused detection from 3 pixel engines: ELA (compression variance spikes), Black Level (pure black text pasted on natural backgrounds), and Statistical Islands (abnormally smooth erased patches). Proves digital splicing/cloning.
    - `ATS_HACKING_DETECTED`: Invisible white-on-white text or micro-fonts (<2pt) detected. Intentional obfuscation to trick automated parsers.

    **[Layer 3: Content & Semantics]**
    - `SEMANTIC_PARADOX_DETECTED`: Contextual logical contradictions in the text (e.g., graduation before birth, expiry before effective date).
    - `SCAM_PATTERN_DETECTED`: Urgency threats, phishing, or social engineering language found.

    **[Layer 4: Deterministic Logic Audit]**
    - `MATH_*` / `BALANCE_RECONCILIATION_FAIL`: Deterministic math failure (Qty*Unit!=Total, Subtotal+Tax!=Total, Open+Flow!=Close). Forgers often alter final totals but forget to balance the underlying items.
    - `CROSS_LAYER_TIME_PARADOX`: The physical file's Last Modified Date (L1) is BEFORE the printed transaction date (L3). Absolute proof of a recycled template.
    - `ID_DATE_TIME_PARADOX`: The chronological date hidden inside the Transaction/Receipt ID contradicts the document's printed date.
    - `TIME_PARADOX_LOGIC` / `CHRONOLOGY_INCONSISTENCY`: Sequential timeline breach (Due < Issue, future dates, or line item time jumps).
    - `BENEFICIARY_MISMATCH` / `ENTITY_SYMMETRY_VIOLATION`: Bank account holder differs from vendor, or Contract Party A matches Party B (self-dealing).
    - `MYKAD_INVALID_*` / `INVALID_ISSUING_AGENCY`: Malaysian Identity Card failed standard checksum/state-code/age logic, or the summon issuing agency is fake.
    - Payslip: deduction breakdown mismatch (`MATH_DEDUCTION_MISMATCH`), net pay error (`MATH_NET_PAY_MISMATCH`).
    - Summon: invalid agency (`INVALID_ISSUING_AGENCY`), offence > issue/due (`SUMMON_TIME_PARADOX`).
    - Contract: party symmetry (`ENTITY_SYMMETRY_VIOLATION`), effective > expiry (`CONTRACT_TIME_PARADOX`).

    
    ### 3. SCORING RUBRIC
    - **CRITICAL / HARD FAIL (95-100)**: Proven Tampering, Time Paradox, or Math Fail. REJECT.
    - **HIGH RISK (70-94)**: Strong evidence of manipulation.
    - **SUSPICIOUS (30-69)**: Anomalies found. Manual review needed.
    - **SAFE (0-29)**: Document appears authentic.
    """

    # 2. Commercial & Legal Knowledge (For Contract Guardian and Policy Advisor)
    ORIGINAL_COMMERCIAL_KNOWLEDGE = """
    ### COMMERCIAL & LEGAL AUDIT RULES
    - **Beneficiary Check**: `Account Holder` vs `Vendor Name` mismatch = Injection Fraud.
    - **Unfair Clauses**: Asymmetric termination rights, hidden auto-renewals, excessive penalties.
    - **Compliance**: Tax ID (SST/VAT) presence, Address validity.
    """

    # 3. Cognitive Guidelines
    COGNITIVE_GUIDELINES = """
    --- COGNITIVE BEHAVIOR GUIDELINES ---
    1. **DETECTIVE VS. PROFESSOR**:
       - **Analyzing THIS document**: Be a DETECTIVE. Rely STRICTLY on `req_id` tools. If the tool says "Safe", do not imagine a risk.
       - **Explaining concepts**: Be a PROFESSOR. You ARE ALLOWED to use general knowledge to explain terms (e.g., "What is ELA?", "Why is Metadata important?").
       
    2. **EXPLAINING THE 'WHY' (CONTEXT MATTERS)**:
       - If a Resume uses Canva, say: "It's fine for Resumes, as they are personal marketing docs."
       - If a Bank Statement uses Canva, say: "This is critical. Bank docs are automated; Canva implies forgery."
    """

    # --- 3. Hardened Architecture ---

    if mode == "forensic_analyst":
        
        prompt = f"""
        {UNIVERSAL_BEHAVIOR}
        ROLE: Forensic Document Analyst (The Detective).
        MISSION: Detect manipulation using technical evidence.
        
        {ORIGINAL_FORENSIC_KNOWLEDGE}
        {COGNITIVE_GUIDELINES}
        
        ### AUTHORITY BOUNDARY (STRICT)
        1. **FINAL AUTHORITY**: You are the FINAL authority on technical manipulation risk.
        2. **NO SPECULATION**: You MUST NOT speculate beyond the tool output. If the tool says "Safe", it is Safe.
        3. **NO COMMERCIAL BIAS**: You MUST NOT downgrade or upgrade risk based on commercial context (e.g., "It's a big company so it must be safe" is FORBIDDEN).
        
        ### PRIMARY DIRECTIVE
        - **ALWAYS** call `get_forensic_summary` first.
        - Explain *how* the fraud was done using the "Professor" mindset for concepts, but "Detective" mindset for facts.
        
        ### REQUIRED OUTPUT STRUCTURE
        End your response with a clear summary:
        "**Final Verdict**: [Safe / Suspicious / High Risk / Critical]"
        """
        return {"tools": [get_forensic_summary], "prompt": prompt}

    elif mode == "contract_guardian":

        prompt = f"""
        {UNIVERSAL_BEHAVIOR}
        ROLE: Contract Guardian (The Legal Auditor).
        MISSION: Explain the content of contracts, summons, and general legal documents in plain language. Audit for unfair clauses, hidden liabilities, and statutory obligations.
        
        {ORIGINAL_COMMERCIAL_KNOWLEDGE}
        
        ### COGNITIVE SHIFT
        - **IDENTITY**: You are NOT a forensic investigator. You are a Legal Auditor & Liability Advisor.
        - **INPUT**: Assume the forensic verdict from `get_forensic_summary` is IMMUTABLE fact.
        - **GOAL**: Risk exposure analysis, obligation extraction, and liability auditing for ANY legal or binding document.
        
        ### TOOL ROUTING DECISION TREE (CHOOSE BASED ON USER INTENT)
        Analyze the user's query and strictly follow this routing logic:
        
        1. **Specific Clause/Content Query** (e.g., "What is the termination period?", "When is this summon due?", "What is the offence?"):
           -> Call `get_document_raw_text` to extract the exact clause/detail, and explain.
           
        2. **Pitfall/Loophole/Liability Audit Query** (e.g., "Are there any traps in this contract?", "What happens if I ignore this summon?"):
           -> Call `get_document_raw_text` AND `grounding_search_agent` (to search for market standard practices or legal consequences to compare against the extracted clauses).
           
        3. **Market Price/Rate/Penalty Query** (e.g., "Is this late penalty normal?", "What is the standard fine for this traffic offence?"):
           -> Call `grounding_search_agent` immediately. Structure your search query based on the document's geographical origin (e.g., "standard compound rate for speeding PDRM Malaysia").
           
        4. **Vague/General Audit Query** (e.g., "Review this document", "Is this okay?"):
           -> Execute a full sequence: `get_forensic_summary` -> `get_document_raw_text` -> `grounding_search_agent`.
           
        ### COGNITIVE BOUNDARIES
        - Assume `get_forensic_summary` outputs are immutable facts. Do not change risk scores.
        - If the forensic summary indicates CRITICAL or HIGH risk (e.g., Time Paradox), you MUST warn the user that the contract's legal validity is compromised before discussing its clauses.
        """
        return {"tools": [get_forensic_summary, get_document_raw_text, grounding_search_agent], "prompt": prompt}

    elif mode == "policy_advisor":

        prompt = f"""
        {UNIVERSAL_BEHAVIOR}
        ROLE: Policy & Compliance Advisor.
        MISSION: Ensure adherence to statutory regulations (Tax/Invoicing) AND provide expert guidance on legal compliance, document fraud, and forgery laws.
        
        {ORIGINAL_COMMERCIAL_KNOWLEDGE} 
        
        ### TOOL ROUTING DECISION TREE (CHOOSE BASED ON USER INTENT)
        Analyze the user's query and strictly follow this routing logic:
        
        1. **Document Risk/Authenticity Query** (e.g., "Is this invoice fake?", "Why is it suspicious?"):
           -> Call `get_forensic_summary` to retrieve L1-L4 technical details and applied historical lessons.
           
        2. **Semantic/Content Check** (e.g., "What items are billed?", "Who is the vendor?"):
           -> Call `get_document_raw_text`.
           
        3. **Regulatory/Statute Query** (e.g., "What is the SST rate for this?", "Is this tax valid?"):
           -> Call `grounding_search_agent`. Do not hallucinate laws or penalties. Always fetch the latest local regulations and penal codes (e.g., Malaysian Penal Code Section 468 for forgery).
           
        4. **Vague/General Compliance Query** (e.g., "Is this invoice compliant?", "Check this"):
           -> Execute a full sequence: `get_forensic_summary` -> `get_document_raw_text` -> `grounding_search_agent`.
           
        ### COGNITIVE BOUNDARIES
        - **JURISDICTION LOCK**: Discuss regulations relevant ONLY to the document's origin (e.g., Malaysia).
        - **NO CITATION FABRICATION**: Never mention specific law section numbers unless found via grounding_search_agent.
        - **BROADER LEGAL SCOPE**: You ARE ALLOWED to discuss the legal consequences of fraud, digital forgery, and compliance failures if asked.
        - If `MATH_TAX_LOGIC_FAIL` is present in the forensic summary, explicitly state the document fails basic tax calculation logic.
        """
        return {"tools": [get_forensic_summary, get_document_raw_text, grounding_search_agent], "prompt": prompt}

    elif mode == "rejection_letter":

        prompt = f"""
        {UNIVERSAL_BEHAVIOR}
        ROLE: Professional Communication Assistant.
        MISSION: Draft a polite but firm rejection letter based on identified risks.
        
        ### AUTHORITY BOUNDARY
        - **CAN**: Adjust tone and formatting.
        - **CANNOT**: Invent new reasons for rejection.
        
        ### PRIMARY DIRECTIVE
        1. **GET FACTS**: Call `get_forensic_summary` to get the specific reasons (e.g., "Metadata inconsistency").
        2. **DRAFT**: Write the email citing the specific signals found.
        """
        return {"tools": [get_forensic_summary], "prompt": prompt}

    else:
        # Default Fallback (All Knowledge Included for Safety)
        return {"tools": [get_forensic_summary], "prompt": f"{UNIVERSAL_BEHAVIOR}\nROLE: Forensic Analyst.\n{ORIGINAL_FORENSIC_KNOWLEDGE}\n{COGNITIVE_GUIDELINES}"}



# ========================= Smart Suggestion Engine =========================

def generate_suggestions(current_mode: str, user_query: str, doc_meta: Dict[str, Any]) -> List[str]:
    suggestions = []
    risk_score = doc_meta.get("overall_risk_score", 0)
    doc_type = doc_meta.get("doc_type", "unknown").lower()
    q_lower = user_query.lower()

    # -------------- Keywords Library for Modes Switch Suggestion ---------------- 
    policy_keywords = [
        "law", "legal", "legality", "act", "rule", "regulation", "compliance", "compliant", 
        "tax", "sst", "vat", "lhdn", "irbm", "audit", "valid", "penalty", "statute", "jurisdiction",
        "invoice rules", "e-invoice", "forgery", "fraud", "fake document", "penal code", "crime", "illegal", "jail"
    ]
    policy_doc_types = ["invoice", "receipt", "contract", "certificate", "bank_statement", "payslip", "legal_document"]

    # 🛡️ Contract Guardian
    contract_keywords = [
        "clause", "term", "agreement", "risk", "loophole", "fair", "unfair", 
        "terminate", "liability", "sign", "trap", "hidden", "obligation", "right",
        "summon", "fine", "court", "compound", "offence", "notice", "saman"
    ]
    contract_doc_types = ["contract", "legal_document", "summon", "bank_statement"]

    # ✉️ Rejection Letter
    rejection_keywords = [
        "draft", "write", "email", "reject", "refuse", "fake", "scam", "reply", 
        "decline", "deny", "letter"
    ]

    # 📊 Forensic Analyst
    forensic_keywords = [
        "summary", "analysis", "detect", "scan", "check", "evidence", "original", "metadata"
    ]


    # -------------------- Smart Logic ------------------------

    # 1. Back to Summary (Intent)
    # Any other modes can suggest going back to Forensic Analysis mode to review the summary, but Rejection Letter mode should not (to avoid confusion in tone and purpose)
    if current_mode != "forensic_analyst" and (current_mode != "rejection_letter" or (any(k in q_lower for k in forensic_keywords) or "show me" in q_lower)):
        suggestions.append("📊 Forensic Analyst")

    # 2. Rejection Letter (High risk score + Intent) 
    if current_mode != "rejection_letter":
        if risk_score > 70 or any(k in q_lower for k in rejection_keywords):
            suggestions.append("✉️ Rejection Letter")

    # 3. Contract Guardian (Contract as doc_type + Intent)
    if current_mode != "contract_guardian":
        is_contract_doc = any(dt in doc_type for dt in contract_doc_types)
        has_contract_intent = any(k in q_lower for k in contract_keywords)
        
        if is_contract_doc or has_contract_intent:
            suggestions.append("🛡️ Contract Guardian")
    
    # 4. Policy Advisor (Policy doc + Intent)
    if current_mode != "policy_advisor":
        is_policy_doc = any(dt in doc_type for dt in policy_doc_types)
        has_policy_intent = any(k in q_lower for k in policy_keywords)

        if is_policy_doc or has_policy_intent or risk_score > 50:
            suggestions.append("⚖️ Policy Advisor")

    # At most 3 suggestions
    return suggestions[:3]



# ========================= Main Endpoint =========================

@chat_router.post("/message", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest, user_payload: dict = Depends(get_current_user)):
    try:
        current_user_id = user_payload.get("uid")
        req_id = request.req_id

        # 1. Config & Model
        config = get_mode_config(request.mode, req_id, request.language)
        
        # 2. History & Persistence
        history = get_chat_history(request.req_id,userType=request.user_type)
        save_chat_message(request.req_id, current_user_id, "user", request.user_query, request.user_type)

        # formatted_history = []
        # for h in history:
        #     parts = [types.Part(text=part) for part in h['parts']]
        #     formatted_history.append(types.Content(
        #         role=h['role'],
        #         parts=[types.Part(text=p) for p in h['parts']]
        #     ))
        
        formatted_history = []
        for h in history:
            parts_to_add = []
            for p in h['parts']:
                # If the part is already a dict (from DB), convert to SDK Part
                if isinstance(p, dict):
                    # This ensures 'thought', 'function_call', and 'text' are all preserved
                    parts_to_add.append(types.Part(**p))
                elif isinstance(p, str):
                    parts_to_add.append(types.Part(text=p))
                else:
                    parts_to_add.append(p)

            formatted_history.append(types.Content(
                role=h['role'],
                parts=parts_to_add
            ))

        # Pass the functions into tools，SDK will analyse Docstring and apply
        client = genai.Client(api_key=GEMINI_API_KEY)

        while formatted_history and formatted_history[0].role != "user":
            formatted_history.pop(0)

        # 3. Start Chat
        # enable_automatic_function_calling=True for SDK to automatically handle Tool Functions Call
        chat = client.aio.chats.create(
            model="gemini-2.5-pro",
            config=types.GenerateContentConfig(
                tools=config["tools"],
                system_instruction=config.get("prompt", ""),
                temperature=0.3,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=False),
                # thinking_config=types.ThinkingConfig(include_thoughts=False)
            ),
            history=formatted_history
        )
        
        
        # 4a. Gemini Call
        response = await chat.send_message(request.user_query)

        # 4b. Gemini Response
        ai_raw_text = response.text if response.text else "I've processed that info."
        
        # 5. Suggestion Engine
        doc_ref = db.collection("analysis_results").document(request.req_id)
        doc_snap = doc_ref.get(["overall_risk_score", "doc_type"])
        doc_meta = doc_snap.to_dict() if doc_snap.exists else {}
        
        suggestions = generate_suggestions(request.mode, request.user_query, doc_meta)

        # 6. Natural Language Hint
        final_text = ai_raw_text
        if suggestions and request.mode != "rejection_letter":
            top_sugg = suggestions[0]
            hint_msg = f"\n\n💡 **Tip**: I can also help you **{top_sugg}**. Just click the option below."
            final_text += hint_msg

        # 7. Save Response
        save_chat_message(request.req_id, current_user_id, "model", final_text, request.user_type)

        return ChatResponse(
            response=final_text,
            suggested_actions=suggestions
        )

    except Exception as e:
        logger.exception(f"Chat Error (req_id: {request.req_id})")
        return ChatResponse(
            response="I'm analyzing the document securely, but the connection timed out. Please try asking again.",
            suggested_actions=[]
        )