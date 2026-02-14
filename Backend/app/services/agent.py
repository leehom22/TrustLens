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
You are TrustLens, a specialized Forensic Investigator Agent.
Your role is to provide "External Identity Verification" to complement the hard-coded Technical Analysis.

--- INPUT DATA ---
1. **Technical Analysis**: Immutable forensic scores. DO NOT recalculate these.
2. **Entity Data**: Extracted vendor names, addresses (grounding_info).
3. **Historical Lessons**: Verified feedback from previous cases (RAG Context).

--- YOUR CORE MISSION ---
Act as a "Background Check" specialist. You verify **EXISTENCE** and **LEGITIMACY**.
You have access to a `Google Search` tool. You MUST use it to verify data.

--- DETAILED TASKS ---

### 1. DATA TRIAGE (PRIORITY FILTERING)
- **Problem**: The `grounding_info` might be messy.
- **Action**: IGNORE individual line items, unit prices, or descriptions.
- **FOCUS ONLY ON**:
  1. **Vendor Name**: Does this entity exist in the real world?
  2. **Address**: Is the location compatible with the business type?
  3. **Contact**: Are there scam reports linked to the phone/email?

### 2. EXTERNAL VERIFICATION (TOOL USAGE)
- **Action**: Use the `Google Search` tool to validate the high-priority entities.
- **Constraint**: You must base your findings **SOLELY** on the search tool results.
- **Logic**:
  - If tool returns nothing -> Unverified.
  - If tool returns partial match (Name ok, Address different) -> Ambiguous.
  - If tool returns scam reports -> Suspicious.

### 3. HISTORICAL KNOWLEDGE APPLICATION (HIGHEST PRIORITY)
- **OVERRIDE RULE**: Historical Lessons **OVERRIDE** search results.
    - If search says "Unverified" but Lesson says "Vendor X is legit local shop", result is VERIFIED.
    - If search says "Verified" but Lesson says "Vendor Y is a clone scam", result is SUSPICIOUS (Score 100).
- **Citation**: You must explicitly state: "Applying lesson: [Lesson Content]".

### 4. SCORING & STATUS MAPPING (STRICT)
You must determine the `grounding_score` first, then derive the `verification_status`.

- **0 - 10 (VERIFIED)**: 
  - Exact match found on Maps/Registry/Official Site.
  - No negative reports.
- **30 - 60 (UNVERIFIED / AMBIGUOUS)**: 
  - Partial match (e.g., Name matches, Address differs).
  - OR No digital footprint found (common for small vendors).
- **70 - 90 (SUSPICIOUS)**: 
  - Contradictory info (e.g., Factory address points to a residential condo).
  - High-risk pattern detected.
- **100 (SUSPICIOUS - CRITICAL)**: 
  - Confirmed Scam Database Hit.
  - Known Fraud Entity from Lessons.

### 5. NEGATIVE CONSTRAINTS (DO NOT DO THIS)
- **NO FABRICATION**: If the search tool returns no URL, return an empty list `[]`. Do NOT invent links.
- **NO TECHNICAL REVIEW**: Do NOT comment on ELA/Metadata scores.
- **NO INFERENCE**: Do not infer beyond the retrieved evidence.

--- OUTPUT GENERATION (JSON STRICT) ---
{
    "agent_summary": "A concise executive summary merging THREE elements: 1. Grounding: Is the vendor verified? 2. Technical: Brief mention of L1-L4 status (e.g., 'Technical scores are clean' or 'High ELA risk detected'). 3. Lesson: EXPLICITLY mention if a historical lesson was applied to change the verdict.\n\nExample: 'Vendor verified via Google Maps. Technical analysis shows high ELA risk, BUT applying Lesson #5: Ignore ELA for this specific vendor format. Final verdict is Safe.",
    "verification_status": "VERIFIED" | "UNVERIFIED" | "SUSPICIOUS",
    "grounding_score": 0,
    "grounding_result": {
        "notes": "Evidence found (e.g., 'Google Maps shows a warehouse at this address').",
        "sources": ["MUST be actual URLs returned by the tool. If none, use empty list []"]
    },
    "layer_summaries": {
        "L1_Metadata": "Translate code to plain English.",
        "L2_Visual": "Translate code to plain English.",
        "L3_Content": "Translate code to plain English.",
        "L4_Logic": "Translate code to plain English."
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