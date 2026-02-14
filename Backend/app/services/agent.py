import json
import asyncio
from google import genai
from google.genai import types
from typing import Dict, Any, List
from ..core.config import GEMINI_API_KEY, logger
from ..utils.schemas import FinalReport
from ..utils.utils import clean_and_repair_json
from ..core.firebase import db
from google.cloud import firestore
from google.cloud.firestore import FieldFilter



# =============== SYSTEM PROMPT =================
AGENT_SYSTEM_INSTRUCTION = """
You are TrustLens, a specialized Forensic Investigator.
Your role is to provide "Contextual Verification" to complement a deterministic forensic analysis.

INPUT DATA:
1. Technical Analysis: Hard-coded forensic scores (ELA, Metadata). DO NOT challenge these technical findings.
2. Entity Data: Vendor names, addresses, amounts.

YOUR TASKS:
1. EXTERNAL VERIFICATION:
   - Perform Google Search on the 'vendor_info' (Name, Address).
   - Verify: Does this vendor exist? Is the address legitimate?
   - Check: Are there scam reports associated with this entity?
   - Check: If items are listed, are prices consistent with market rates?

2. FRAUD PATTERN RECOGNITION:
   - Analyze extracted text for psychological triggers (urgency, threats) or known scam templates.

3. HISTORICAL KNOWLEDGE APPLICATION:
    - You may receive "Historical Lessons" from previous user feedback.
    - **Priority**: Verified historical lessons > Default assumptions.
    - If a lesson states that a specific "Risk Signal" is a false positive for this vendor/doc_type, you MUST DOWNGRADE the risk.
    - If a lesson confirms a fraud pattern, you MUST UPGRADE the risk.

4. OUTPUT GENERATION (JSON ONLY):
   - 'agent_summary': A concise executive summary merging technical and grounding findings.
   - 'verification_status': VERIFIED (Legit) | UNVERIFIED (No Data) | SUSPICIOUS (Red Flags).
   - 'grounding_score': An integer (0-100) representing External Risk.
     - 0: Vendor confirmed, consistent data.
     - 50: Vendor not found or data ambiguous.
     - 100: Confirmed scam, fake address, or price gouging.
   - 'layer_summaries': Explain the technical findings (L1-L4) in plain English for a non-technical user.

RESPONSE FORMAT:
{
    "agent_summary": "...",
    "verification_status": "VERIFIED",
    "grounding_score": 0,
    "grounding_result": {
        "notes": "Vendor found at...",
        "sources": ["url1", "url2"]
    },
    "layer_summaries": {
        "L1_Metadata": "...",
        "L2_Visual": "...",
        "L3_Content": "...",
        "L4_Logic": "..."
    }
}
"""


def fetch_relevant_lessons(doc_type: str, flagged_layers: List[str], vendor_name: str = None) -> Dict[str, Any]:
    """
    RAG Retrieving Logic:
    1. Hard Filter for current doc_type
    2. Soft Filter for matching current flagged_layers or General
    3. Prioritise the current extracted vendor

    RAG Retrieving Logic (Refactored):
    1. Query 'feedback' collection directly.
    2. Filter by doc_type and weight.
    3. In-memory filter for 'target_layer' matching.
    """

    lessons_text = []
    raw_lessons = []   # For frontend display / DB record

    valid_labels = ["incorrect", "warning", "correct"]

    try:
        # 1. For current doc type (collect 15 for further filter)
        query = db.collection("feedback")\
                  .where(filter=FieldFilter("applicable_doc_types", "array_contains", doc_type))\
                  .where(filter=FieldFilter("label", "in", valid_labels))\
                  .where(filter=FieldFilter("weight", ">=", 0.6))\
                  .order_by("weight", direction=firestore.Query.DESCENDING)\
                  .limit(15)

        docs = query.stream()
        
        # Mapping suitable sentence prefix to the labels
        PREFIX_MAP = {
            "incorrect": "[CORRECTION / MUST FOLLOW]",
            "warning":   "[RISK WARNING]",
            "correct":   "[CONFIRMED PATTERN]"
        }

        count = 0
        
        # ----- Loop for formatting lessons prompt ------
        for d in docs:
            if count >= 5: break   # Retrieve at most five lessons
            
            data = d.to_dict()

            # Filter lessons with unmatch layers
            l_layer = data.get("target_layer", "General")
            if l_layer != "General" and l_layer not in flagged_layers: continue

            # 2. Filter lessons specific to an entity but not match the current entity
            l_entities = data.get("related_entities", [])
            if l_entities and (not vendor_name or not any(e.lower() in vendor_name.lower() for e in l_entities)):
                continue

            # --- Format Prompt ---
            label = data.get("label", "neutral")
            prefix = PREFIX_MAP.get(label)

            entity_tag = f"[SPECIFIC: {l_entities[0]}]" if l_entities else "[GENERIC]"
            line = f"{count+1}. {prefix} {entity_tag} (Layer: {l_layer}): {data.get('ai_lessons')}"
            lessons_text.append(line)
            raw_lessons.append(data.get('ai_lessons'))
            count += 1


        # Lesson Title (Only insert when lesson exist)
        if lessons_text:
            lessons_text.insert(0, "[HISTORICAL KNOWLEDGE BASE - PREVIOUS CORRECTIONS]")

        return {
            "prompt_text": "\n".join(lessons_text),
            "raw_list": raw_lessons
        }

    except Exception as e:
        logger.warning(f"RAG Retrieval Failed: {e}")
        return {"prompt_text": "", "raw_list": []}



async def run_agent_analysis(report: FinalReport) -> Dict[str, Any]:

    # Executes the AI investigation. Returns a Dictionary of AI findings (NOT the full AnalysisRecord yet).

    req_id = report.request_id
    logger.info(f"Agent: Starting Grounding Investigation", extra={"request_id": req_id})

    # Indicate current flagged layers
    flagged_layers = []
    for layer in report.evidence_chain:
        if layer.status in ["suspicious", "high_risk"]:
            layer_code = layer.layer_name.split("_")[0]
            flagged_layers.append(layer_code)
    vendor_name = report.grounding_info.get('vendor_name', '')

    # RAG Searching for suitable Lessons
    lessons_data = fetch_relevant_lessons(report.doc_type, flagged_layers, vendor_name)
    lessons_prompt_str = lessons_data["prompt_text"]

    # ------ Prompt Context -------
    # Only give neceesary info to reduce consumption of tokens
    user_prompt = f"""
    [FORENSIC REPORT SUMMARY]
    Doc Type: {report.doc_type}
    Technical Risk Score: {report.overall_risk_score} / 100
    Risk Level: {report.risk_level}
    Key Signals: {report.risk_signals}

    # Lesson Prompts
    {lessons_prompt_str}

    [ENTITIES TO VERIFY]
    Vendor Name: {report.grounding_info.get('vendor_name', 'N/A')}
    Address: {report.grounding_info.get('vendor_address', 'N/A')}
    Total Amount: {report.grounding_info.get('total_amount', 'N/A')}
    Details: {report.grounding_info}
    """

    # 2. Execution
    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=AGENT_SYSTEM_INSTRUCTION,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                # response_mime_type="application/json"
            )
        )
        
        ai_output = clean_and_repair_json(response.text)
        
        # Safety check for output format
        defaults = {
            "agent_summary": "AI Analysis failed to generate summary.",
            "verification_status": "UNVERIFIED",
            "grounding_score": 0, # Default to 0 risk if AI fails, let Tech Score rule
            "grounding_result": {"error": "Parsing error"},
            "layer_summaries": {}
        }
        
        # Combining output with default format
        final_output = {**defaults, **ai_output}
        final_output["active_lessons_applied"] = lessons_data["raw_list"]
        
        logger.info("Agent: Investigation Complete", extra={"g_score": final_output['grounding_score']})
        return final_output
    
    # Fallback
    except Exception as e:
        logger.error(f"Agent Logic Failed: {e}")
        return {
            "agent_summary": "Automated forensic analysis complete. AI Grounding service unavailable.",
            "verification_status": "UNVERIFIED",
            "grounding_score": 0,
            "grounding_result": {"error": str(e)},
            "layer_summaries": {},
            "active_lessons_applied": []
        }