import json
import logging
import os
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPICallError
from google.cloud import firestore
from dotenv import load_dotenv
from ..core.auth import get_current_user
from ..core.firebase import db

# --- Load Config ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

logger = logging.getLogger("TrustLens-Chat")
chat_router = APIRouter()

# --- Init Firebase & Gemini ---
genai.configure(api_key=GEMINI_API_KEY)


# ====================== Models & Schemas =======================
class ChatRequest(BaseModel):
    doc_id: str = Field(..., description="Document ID")
    user_query: str = Field(..., description="The user's question")
    mode: str = Field(default="forensic_analyst", description="Active Persona Mode")

class ChatResponse(BaseModel):
    response: str
    suggested_actions: List[Dict[str, str]] = []


# ========================= History & Persistence ======================
def get_chat_history(doc_id: str, limit: int = 10):
    # Retrieve recent chat history for context
    try:
        msgs_ref = db.collection("analysis_results").document(doc_id).collection("messages")
        docs = msgs_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
        
        history = []
        for doc in docs:
            data = doc.to_dict()
            history.append({
                "role": "user" if data["role"] == "user" else "model",
                "parts": [data["content"]]
            })
        return history[::-1] # Reverse to chronological order
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        return []

def save_chat_message(doc_id: str, user_id: str, role: str, content: str):
    # Save chat message to Firestore
    try:
        msgs_ref = db.collection("analysis_results").document(doc_id).collection("messages")
        msgs_ref.add({
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        logger.error(f"Message save error: {e}")


# ========================= Defined Tools (With Strict Typing & Docstrings) =======================
def get_forensic_summary(doc_id: str) -> Dict[str, Any]:
    """
    Retrieves the structured forensic analysis summary.
    Use this to get Risk Scores, Fraud Signals, Visual ELA results, and Logic Audits.
    Does NOT contain the full raw text of the document.
    Argument: doc_id: The unique identifier of the document.
    """
    try:
        doc_ref = db.collection("analysis_results").document(doc_id)
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

def get_document_raw_text(doc_id: str) -> Dict[str, Any]:
    # Retrieves the full raw text content of the document.
    # Use this ONLY when you need to read specific clauses, terms, or check compliance against laws.
    try:
        doc_ref = db.collection("analysis_results").document(doc_id)
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

"""

# ========================= Mode Configuration =========================

def get_mode_config(mode: str):
    # Google Search Tool Definition
    google_search_tool = {{'google_search': {}}}
    
    # Formatting Prompt Structure: Guardrails + Role + Mission + Data Referred
    base_structure = lambda role, mission, data: f"""
    {CORE_GUARDRAILS}
    
    ROLE: {role}
    MISSION: {mission}
    DATA SOURCE: {data}
    """

    if mode == "forensic_analyst":
        return {
            "tools": [get_forensic_summary],
            "prompt": base_structure(
                role="TrustLens Forensic Analyst",
                mission="Explain tampering risks (Visual/Logic/Metadata).",
                data="Use 'get_forensic_summary'. Focus on 'risk_signals' and 'l2_visual_analysis'."
            )
        }
    elif mode == "rejection_letter":
        return {
            "tools": [get_forensic_summary],
            "prompt": base_structure(
                role="TrustLens Letter Generator",
                mission="Draft a formal business rejection email based on risk findings.",
                data="Use 'get_forensic_summary'. If Risk > 70, be firm. If Risk < 50, ask for clarification. DO NOT CHAT, JUST DRAFT."
            )
        }
    elif mode == "policy_advisor":
        return {
            "tools": [get_forensic_summary, get_document_raw_text, google_search_tool],
            "prompt": base_structure(
                role="TrustLens Policy Advisor",
                mission="Check compliance against Malaysia Regulations (e.g., SST, e-Invoice).",
                data="Use 'get_document_raw_text' for clauses and Google Search for laws."
            )
        }
    elif mode == "contract_guardian":
        return {
            "tools": [get_document_raw_text, google_search_tool],
            "prompt": base_structure(
                role="TrustLens Contract Guardian",
                mission="Identify unfair clauses, hidden traps, and verify market rates.",
                data="Use 'get_document_raw_text' for text analysis and Google Search for price verification."
            )
        }
    else:
        # Default
        return {
            "tools": [get_forensic_summary], 
            "prompt": f"{CORE_GUARDRAILS}\nYou are TrustLens AI. Help user understand the document risks."
        }


# ========================= Smart Suggestion Engine =========================

def generate_suggestions(current_mode: str, user_query: str, doc_meta: Dict[str, Any]) -> List[Dict[str, str]]:
    suggestions = []
    risk_score = doc_meta.get("overall_risk_score", 0)
    doc_type = doc_meta.get("doc_type", "unknown").lower()
    q_lower = user_query.lower()

    # Back to Summary
    if current_mode != "forensic_analyst":
        suggestions.append({
            "label": "📊 Back to Analysis", "mode": "forensic_analyst", 
            "query": "Show me the forensic summary again."
        })

    # High Risk -> Rejection
    if risk_score > 70 and current_mode != "rejection_letter":
        suggestions.append({
            "label": "✉️ Draft Rejection", "mode": "rejection_letter", 
            "query": "Draft a strong rejection letter based on these risks."
        })

    # Doc Type Specific
    if ("contract" in doc_type or "agreement" in doc_type) and current_mode != "contract_guardian":
        suggestions.append({
            "label": "🛡️ Audit Clauses", "mode": "contract_guardian", 
            "query": "Check for unfair clauses."
        })
    
    if any(x in doc_type for x in ["invoice", "receipt", "tax"]) and current_mode != "policy_advisor":
        suggestions.append({
            "label": "⚖️ Check Compliance", "mode": "policy_advisor", 
            "query": "Is this compliant with e-Invoice rules?"
        })

    # Intent Trigger
    if any(k in q_lower for k in ["law", "act", "compliance"]) and current_mode != "policy_advisor":
        suggestions.append({"label": "⚖️ Switch to Policy Advisor", "mode": "policy_advisor", "query": user_query})

    return suggestions[:2]


# ========================= Main Endpoint =========================

@chat_router.post("/message", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest, user_payload: dict = Depends(get_current_user)):
    try:
        current_user_id = user_payload.get("uid")

        # 1. Config & Model
        config = get_mode_config(request.mode)
        
        # Pass the functions into tools，SDK will analyse Docstring and apply
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash", 
            tools=config["tools"]
        )
        
        # 2. History & Persistence
        history = get_chat_history(request.doc_id)
        save_chat_message(request.doc_id, current_user_id, "user", request.user_query)
        
        # 3. Start Chat
        # enable_automatic_function_calling=True for SDK to automatically handle Tool Functions Call
        chat = model.start_chat(
            history=history,
            enable_automatic_function_calling=True 
        )
        
        final_query = f"[SYSTEM: {config['prompt']}] \n\n USER QUERY: {request.user_query}"
        
        # 4. Gemini Call
        response = await chat.send_message_async(final_query)
        ai_raw_text = response.text
        
        # 5. Suggestion Engine
        doc_ref = db.collection("analysis_results").document(request.doc_id)
        doc_snap = doc_ref.get(["overall_risk_score", "doc_type"])
        doc_meta = doc_snap.to_dict() if doc_snap.exists else {}
        
        suggestions = generate_suggestions(request.mode, request.user_query, doc_meta)

        # 6. Natural Language Hint
        final_text = ai_raw_text
        if suggestions and request.mode != "rejection_letter":
            top_sugg = suggestions[0]
            hint_msg = f"\n\n💡 **Tip**: I can also help you **{top_sugg['label']}**. Just click the option below."
            final_text += hint_msg

        # 7. Save Response
        save_chat_message(request.doc_id, current_user_id, "model", final_text)

        return ChatResponse(
            response=final_text,
            suggested_actions=suggestions
        )

    except Exception as e:
        logger.exception("Chat Error")
        return ChatResponse(
            response="I'm analyzing the document securely, but the connection timed out. Please try asking again.",
            suggested_actions=[]
        )