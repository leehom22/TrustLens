import json
import asyncio
import google.generativeai as genai
from typing import Dict, Any
from ..core.config import GEMINI_API_KEY, logger
from ..utils.schemas import FinalReport
from ..utils.utils import clean_and_repair_json
from google.generativeai.types import content_types


genai.configure(api_key=GEMINI_API_KEY)

# Google Search Grounding
tools = [
    content_types.Tool(
        google_search_retrieval=content_types.GoogleSearchRetrieval(
            dynamic_threshold_config=content_types.DynamicThresholdConfig(
                mode=content_types.DynamicThresholdConfig.Mode.AUTO
            )
        )
    )
]

# =============== SYSTEM PROMPT =================
AGENT_SYSTEM_INSTRUCTION = """
You are TrustLens, a specialized Forensic Investigator.
Your role is to provide "Contextual Verification" to complement a deterministic forensic analysis.

INPUT DATA:
1. Technical Analysis: Hard-coded forensic scores (ELA, Metadata). DO NOT challenge these technical findings.
2. Entity Data: Vendor names, addresses, amounts.

YOUR TASKS:
1. EXTERNAL VERIFICATION (The Eyes):
   - Perform Google Search on the 'vendor_info' (Name, Address).
   - Verify: Does this vendor exist? Is the address legitimate?
   - Check: Are there scam reports associated with this entity?
   - Check: If items are listed, are prices consistent with market rates?

2. FRAUD PATTERN RECOGNITION (The Brain):
   - Analyze extracted text for psychological triggers (urgency, threats) or known scam templates.

3. OUTPUT GENERATION (JSON ONLY):
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

async def run_agent_analysis(report: FinalReport) -> Dict[str, Any]:

    # Executes the AI investigation. Returns a Dictionary of AI findings (NOT the full AnalysisRecord yet).

    req_id = report.request_id
    logger.info(f"Agent: Starting Grounding Investigation", extra={"request_id": req_id})

    # ------ Prompt Context -------
    # Only give neceesary info to reduce consumption of tokens
    user_prompt = f"""
    [FORENSIC REPORT SUMMARY]
    Doc Type: {report.doc_type}
    Technical Risk Score: {report.overall_risk_score} / 100
    Risk Level: {report.risk_level}
    Key Signals: {report.risk_signals}

    [ENTITIES TO VERIFY]
    Vendor Name: {report.grounding_info.get('vendor_name', 'N/A')}
    Address: {report.grounding_info.get('vendor_address', 'N/A')}
    Total Amount: {report.grounding_info.get('total_amount', 'N/A')}
    Details: {report.grounding_info}
    """

    # 2. Execution
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash', 
        tools=tools,
        system_instruction=AGENT_SYSTEM_INSTRUCTION
    )

    try:
        response = await model.generate_content_async(
            user_prompt,
            generation_config={"response_mime_type": "application/json"}
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
            "layer_summaries": {}
        }