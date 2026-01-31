from pydantic import BaseModel
from app.core.firebase import db
from google.cloud import firestore
from app.services.layerFeedback import analyze_feedback_content

class FeedbackCreate(BaseModel):
    # user_id: str
    # tmestamp: firestore.SERVER_TIMESTAMP
    analysis_id: str
    analysis_type: str # metadata, heatmap, content analysis, key findings
    feedback_text: str
    document_class: str # legal, medical, ...
    # AI analyze feedback fields
    weight: float | None = None # how much the feedback should influence the model
    label: str | None = None # correct, incorrect, warning 
    ai_lessons: str | None = None # what the AI should learn from this feedback
    
class FeedbackModel:
    
    @staticmethod
    def create_feedback(feedback: FeedbackCreate, user_id: str = 'anonymous', email: str = 'anonymous'):
        print(f"Creating feedback for {feedback.analysis_type}...")
        
        # --- AI ANALYZE USER FEEDBACK ---
        analysis = analyze_feedback_content(feedback.feedback_text, feedback.analysis_type)
        
        # Update the object with AI insights
        feedback.weight = analysis.get('weight')
        feedback.label = analysis.get('label')
        feedback.ai_lessons = analysis.get('ai_lessons')
        # --------------------------------
        
        data = feedback.model_dump()
        data['timestamp'] = firestore.SERVER_TIMESTAMP
        data['user_id'] = user_id
        data['email'] = email
        
        # Add to Firestore
        _, doc_ref = db.collection("feedback").add(data)
        
        return doc_ref.id

    @staticmethod
    def get_all_feedback():
        docs = db.collection("feedback").stream()
        return [doc.to_dict() for doc in docs]
    
    