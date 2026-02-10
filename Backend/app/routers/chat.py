import logging
import os
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import google.generativeai as genai
from google.generativeai.types import content_types
from app.core.firebase import db
from dotenv import load_dotenv


load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

logger = logging.getLogger("TrustLens-Chat")

chat_router = APIRouter()

if not GEMINI_API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY is missing")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# ======================== 1. Chat Schema) ======================

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    doc_id: str = Field(..., description="The Request ID of the analyzed document")
    user_query: str = Field(..., description="User's input text")
    # Selected tools from front-end
    selected_tool: Optional[str] = Field(
        default="GENERAL_CHAT", 
        description="Options: GENERAL_CHAT, CONTRACT_GUARDIAN, POLICY_ADVISOR, LETTER_GENERATOR"
    )
    chat_history: Optional[List[ChatMessage]] = []



# ============== 2. System Prompts (Tools Prompts) ==========================

# ---------------- CONTRACT_GUARDIAN - with Risk-Weighted Explanation -------------------

PROMPT_GUARDIAN = """
You are the **TrustLens Consumer Guardian**.
You have access to the **RAW TEXT** of the document.

CONTEXT:
- Risk Score: {score}
- Visual Risk: {l2_score}

DOCUMENT CONTENT:
\"\"\"
{raw_text}
\"\"\"

TASKS:
1. **Analyze Clauses**: Read the text above. Find ambiguity, unfair terms, or hidden traps. Explain in simple terms why this is dangerous.
2. **Market Price Audit**: 
   - Extract item prices.
   - Search & Compare with Malaysia 2026 market rates.
   - **MANDATORY OUTPUT**: You MUST output a comparison table: Item | Doc Price | Market Price | Variance (%).
3. **Risk Warning**: If Visual Risk is high ({l2_score} > 50), warn that this contract might be tampered with.

OUTPUT:
- **Clause Analysis**: [Highlight risky terms]
- **Price Check**: [Markdown Table]
- **Verdict**: [Protective Actionable Advice]
"""


# -------------- POLICY_ADVISOR with Structured Regulatory Diff ------------

PROMPT_POLICY = """
You are a **Compliance & Legal Auditor**.
Your goal is to perform a **Structured Regulatory Diff Analysis**.

CONTEXT:
- Document Type: {doc_type}
- Content Snippet:
\"\"\"
{raw_text}
\"\"\"

TASKS:
1. **Retrieve Regulation**: Search for the EXACT act/law in Malaysia (2026).
2. **Perform Diff Analysis**: Compare the document's terms against the legal requirement.

MANDATORY OUTPUT FORMAT (STRICT JSON-LIKE BLOCK):
You MUST provide the final answer in this specific Markdown Table format:

| Compliance Check | Document Value | Official Regulation | Status |
| :--- | :--- | :--- | :--- |
| Tax Rate (SST/Service Tax) | [e.g., 6%] | [e.g., 8%] | ❌ NON-COMPLIANT |
| e-Invoice Mandate | [e.g., No QR Code] | [Mandatory since Aug 2024] | ❌ NON-COMPLIANT |
| [Other Field] | ... | ... | ... |

VERDICT:
- Final Compliance Status: [COMPLIANT / NON-COMPLIANT / REQUIRES REVIEW]
- Citation: [Name of the Act/Law]
"""


# --------- LETTER_GENERATOR - With Autonomous Response Calibration ---------

PROMPT_LETTER = """
You are a **Professional Communication Assistant**.
Your drafting strategy is governed by the **Forensic Severity Scale**.

INPUT SEVERITY:
- Risk Score: {score}
- Verification Status: {verification_status}

CALIBRATION LOGIC:
1. **LEVEL 1: Clarification Request (Score < 50 but Suspicious)**
   - Tone: Inquisitive but polite.
   - Content: "We noticed some minor discrepancies. Could you please clarify X?"
   
2. **LEVEL 2: Conditional Acceptance (Score < 30 & Verified)**
   - Tone: Professional & Affirming.
   - Content: "Processed successfully. Payment scheduled."

3. **LEVEL 3: Rejection Notice (Score > 70 or Unverified)**
   - Tone: Firm, Defensive, Risk-Averse.
   - Content: "Rejected due to security audit failure."
   - **Requirement**: You MUST cite the specific "Risk Signals" from the report as evidence.

OUTPUT:
- **Detected Severity**: [Level 1/2/3]
- **Subject**: ...
- **Body**: ...
"""


# ------------------ GENERAL_CHAT - With RAG ---------------------

PROMPT_GENERAL = """
You are the **TrustLens Assistant**, an expert forensic auditor AI.
Answer the user's questions based **strictly** on the provided 'ANALYSIS_RECORD'.

TASKS:
- Explain technical findings (L1-L4) in simple terms.
- Explain why a vendor was verified or unverified.
- If the user asks something not in the report, say "I cannot find that in the forensic analysis."
"""



# ====================== 3. API ======================

@chat_router.post("/message", status_code=status.HTTP_200_OK)
async def chat_with_document(request: ChatRequest):
    try:
        # Retrieve Memory
        doc_ref = db.collection("analysis_results").document(request.doc_id)
        doc_snapshot = doc_ref.get()

        if not doc_snapshot.exists:
            raise HTTPException(status_code=404, detail="Analysis report not found.")

        analysis_context = doc_snapshot.to_dict()
        context_str = f"=== FORENSIC ANALYSIS RECORD ===\n{str(analysis_context)}"

        raw_text = analysis_context.get("raw_document_content", "")
        # If don't have raw content extracted (not legal doc), fallback to JSON analysis output
        if not raw_text:
            raw_text = f"Structured Data: {str(analysis_context.get('grounding_info', {}))}"

        # Prepare Data for Prompts
        prompt_data = {
            "score": analysis_context.get("overall_risk_score", 0),
            "l2_score": next((e['score'] for e in analysis_context.get("evidence_chain", []) if e['layer_name']=="L2_Visual"), 0),
            "l4_score": next((e['score'] for e in analysis_context.get("evidence_chain", []) if e['layer_name']=="L4_Logic"), 0),
            "grounding_score": analysis_context.get("grounding_score", 0),
            "verification_status": analysis_context.get("verification_status", "UNKNOWN"),
            "doc_type": analysis_context.get("doc_type", "document"),
            "raw_text": raw_text[:5000]   # To prevent exceeds token used
        }

        # Explicit Routing (Retrieve tools instruction from front-end)
        tool_mode = request.selected_tool.upper()
        logger.info(f"Chat Request: {request.doc_id} | Tool: {tool_mode}")

        # Default mode
        system_instruction = PROMPT_GENERAL
        tools = []

        google_search_tool = content_types.Tool(
            google_search_retrieval=content_types.GoogleSearchRetrieval(
                dynamic_threshold_config=content_types.DynamicThresholdConfig(
                    mode=content_types.DynamicThresholdConfig.Mode.AUTO
                )
            )
        )

        # Specilizing mode
        if tool_mode == "CONTRACT_GUARDIAN":
            system_instruction = PROMPT_GUARDIAN.format(
                score=prompt_data["score"],
                l2_score=prompt_data["l2_score"],
                raw_text=prompt_data["raw_text"]
            )
            tools = [google_search_tool]   # Grounding search for market price
            
        elif tool_mode == "POLICY_ADVISOR":
            system_instruction = PROMPT_POLICY.format(
                doc_type=prompt_data["doc_type"],
                raw_text=prompt_data["raw_text"]
            )
            tools = [google_search_tool]    # Grounding search for policies
            
        elif tool_mode == "LETTER_GENERATOR":
            system_instruction = PROMPT_LETTER.format(
                score=prompt_data["score"],
                verification_status=prompt_data["verification_status"]
            )
            tools = []
        
        else:
            # GENERAL_CHAT
            system_instruction = PROMPT_GENERAL
            tools = []

        # Execution of Gemini
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            tools=tools,
            system_instruction=system_instruction
        )

        # ----- Finalise Prompt -----
        final_prompt = f"""
        {context_str}
        USER INPUT: {request.user_query}
        INSTRUCTION: Execute the task defined in your system instruction.
        """

        response = await model.generate_content_async(final_prompt)

        return {
            "reply": response.text,
            "used_tool": tool_mode,
            "related_risk_level": analysis_context.get("risk_level", "UNKNOWN")
        }

    except Exception as e:
        logger.error(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))