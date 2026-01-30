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
    visual_evidence_url: Optional[str] = None

class FinalReport(BaseModel):
    request_id: str
    timestamp: datetime
    doc_type: str
    overall_risk_score: int
    risk_level: str
    summary: str
    evidence_chain: List[LayerResult]
    recommendation: str