from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum


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
    ATS_Hacking: Optional[str] = None
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
    raw_document_content: Optional[str] = Field(default="", description="Full raw text content for semantic analysis")   # Only for legal doc or contract

class ForensicLesson(BaseModel):
    ai_lessons: str = Field(..., description="Human readable lesson")
    target_layer: str = Field(..., description="L1 | L2 | L3 | L4 | General")
    applicable_doc_types: List[str] = Field(..., description="List of doc types this applies to")
    related_entities: List[str] = Field(default_factory=list, description="Specific vendors if applicable")
    label: str = Field(..., description="correct | incorrect | neutral | warning | feature_request")
    weight: float = Field(..., description="Importance (0.0 - 1.0)")

class AnalysisRecord(FinalReport):
    # Inherit data from FinalReport (L1-L4 Technical Data)
    doc_id: str = Field(..., description="The unique Firestore ID of the uploaded file")
    req_id: str = Field(..., description="The unique Firestore ID of the analysis")
    user_id: str = "guest"
    file_name: str = "unknown_file"
    
    # 1. AI Explanation Summary (Context)
    agent_summary: Union[str, Dict[str, str]] = Field(..., description="AI generated executive summary")
    final_recommendation: Union[str, Dict[str, str]] = Field(..., description="Actionable guidance sentence from AI Agent")
    active_lessons_applied: List[str] = Field(default_factory=list, description="Historical lessons used in reasoning")

    # 2. Grounding Search result
    verification_status: str = Field(..., description="VERIFIED | UNVERIFIED | SUSPICIOUS")
    grounding_score: int = Field(..., description="Risk score (0-100) based on Google Search")
    grounding_result: Dict[str, Any] = Field(default_factory=dict, description="Search sources and verification details")

    # 3. Layer Summary (Frontend Display)
    layer_summaries: Union[Dict[str, str], Dict[str, Dict[str, str]]] = Field(default_factory=dict, description="Plain English explanation for each layer")

class BatchTaskResult(BaseModel):
    doc_id: Optional[str] = None
    status: str  # "success" | "failed" | "critical_failure"
    error: Optional[str] = None
    data: Optional[AnalysisRecord] = None 

class BatchAnalysisResponse(BaseModel):
    batch_status: str
    results: List[BatchTaskResult]