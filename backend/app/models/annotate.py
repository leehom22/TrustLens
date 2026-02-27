from pydantic import BaseModel
from typing import Optional

class LoadAnnotationsRequest(BaseModel):
    documentId: str
    userId: str
    
class AnnotationModel(BaseModel):
    id: int
    type: str
    x: float
    y: float
    width: float
    height: float
    color: Optional[str] = None
    comment: Optional[str] = None


class SaveAnnotationRequest(BaseModel):
    documentId: str
    userId: str
    annotation: AnnotationModel
    
class DeleteAnnotationRequest(BaseModel):
    firestoreId: str
    
class LoadNotesRequest(BaseModel):
    documentId: str
    userId: str