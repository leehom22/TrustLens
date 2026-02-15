from fastapi import APIRouter, Depends, Form
from app.models.feedback import FeedbackModel,FeedbackCreate, ExpertReview
from app.core.auth import get_current_user
feedback_router = APIRouter()

# user feedback
@feedback_router.post("/submit_feedback")
def submit_feedback(data: FeedbackCreate , user = Depends(get_current_user)):
    # print("--------------- Received feedback data ----------------")
    # print(data)
    userIid = user['uid'] if user else 'anonymous'
    email = user['email'] if user and 'email' in user else 'anonymous'
    
    feedback_id = FeedbackModel.create_feedback(data, user_id=userIid, email=email)

    if not feedback_id:
        return {
            "success": False,
            "message": "Failed to submit feedback"
        }
    print(f"Feedback submitted with ID: {feedback_id}")
    return {
        "success": True,
        "message": "Feedback received",
        "feedback_id": feedback_id
    }

# expert review
@feedback_router.post("/submit_document_review")
def submit_document_review(data: ExpertReview):
    
    review_id = FeedbackModel.create_expert_review(data)
    
    if not review_id:
        return {
            "success": False,
            "message": "Failed to submit document review"
        }
    
    return {
        "success": True,
        "message":"Document Review submitted",
        "review_id": review_id
    }
    
@feedback_router.get("/get_document_review")
def get_document_review(docId:str):
    try:
        doc_review = FeedbackModel.get_expert_review(docId)
        
        return {
            "success":True,
            "review":doc_review
        }
    except Exception as e:
        print("Error fetching document review: ",e)
        return {
            "success": False,
            "review":[]
        }
