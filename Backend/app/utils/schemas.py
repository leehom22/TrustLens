from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

# Conceptual-like Typescript Interface but in Python, can auto doing type parsing and validation
# For formatting final response of all analysis into JSON structure

class LayerStatus(str, Enum):
    SKIPPED = "skipped"
    CLEAN = "clean"
    SUSPICIOUS = "suspicious"
    HIGH_RISK = "high_risk"
    ERROR = "error"

class LayerResult(BaseModel):
    layer_name: str
    status: LayerStatus
    score: int = Field(..., description="0-100 Risk Score")
    details: Dict[str, Any]
    risk_signals: List[str] = Field(default_factory=list)
    visual_evidence_url: Optional[str] = None

class FinalReport(BaseModel):
    request_id: str
    timestamp: datetime
    doc_type: str
    overall_risk_score: int
    risk_level: str
    risk_signals: List [str]
    summary_code: str
    evidence_chain: List[LayerResult]
    rule_metadata: Dict[str, Any]   # For AI Agent to understand the rules set in config.py
    grounding_info: Dict[str, Any]   # Compile all grounding search info

class AnalysisRecord(FinalReport):
    # Inherit from FinalReport, add on with AI Agent Response
    
    # agent_verdict: str = Field(..., description="Agent ACCEPT | REJECT | REVIEW")
    summary: str   # = Field(..., description="Agent Summary")
    grounding_result: Optional[Dict[str, Any]]    # = Field(None, description="Google Search Result")
    recommendation: Optional[str] = None