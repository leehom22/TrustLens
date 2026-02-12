from pydantic import BaseModel, Field
from app.core.firebase import db
from google.cloud import firestore
from app.services.layerFeedback import analyze_feedback_content

class FeedbackCreate(BaseModel):
    analysis_id: str
    analysis_type: str = Field(..., description="layer1 | layer2 | layer3 | layer4")
    feedback_text: str

class ExpertReview(BaseModel):
    document_id: str
    user_id: str # expert id 
    review_decision: str
    review_notes: str
    review_agrees: bool

class FeedbackModel:
    
    @staticmethod
    def create_feedback(feedback: FeedbackCreate, user_id: str = 'anonymous', email: str = 'anonymous'):
        
        # --- Get Doc Type ---
        record_snapshot = db.collection("analysis_results").document(feedback.analysis_id).get()
        
        current_doc_type = "general_document"   # Default
        
        if record_snapshot.exists:
            record_data = record_snapshot.to_dict()
            current_doc_type = record_data.get("doc_type") or record_data.get("type", "general_document")
        else:
            print(f"Warning: Analysis Record not found for ID {feedback.analysis_id}")

        # --- Execution of AI Lesson Learning ---
        lesson = analyze_feedback_content(
            text = feedback.feedback_text, 
            current_doc_type = current_doc_type,
            analysis_type = feedback.analysis_type
        )
        
        # --- Save into Firebase ---
        data = feedback.model_dump()
        data.update({
            "timestamp": firestore.SERVER_TIMESTAMP,
            "user_id": user_id,
            "email": email,
            "doc_type": current_doc_type, 
            "target_layer": feedback.analysis_type,
            
            # AI Lesson Summary
            "weight": lesson.get('weight', 0.5),
            "label": lesson.get('label', 'neutral'),
            "ai_lessons": lesson.get('ai_lessons', feedback.feedback_text),
            "applicable_doc_types": lesson.get('applicable_doc_types', [current_doc_type]),
            "related_entities": lesson.get('related_entities', [])
        })
        
        _, new_feedback_ref = db.collection("feedback").add(data)
        return new_feedback_ref.id
    
    @staticmethod
    def get_all_feedback():
        docs = db.collection("feedback").stream()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    def create_expert_review(review: ExpertReview):
        data = review.model_dump()
        data['timestamp'] = firestore.SERVER_TIMESTAMP
        _, doc_ref = db.collection('document_review').add(data)
        return doc_ref.id