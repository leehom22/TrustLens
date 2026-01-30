from fastapi import APIRouter, Depends
from app.models.feedback import FeedbackModel,FeedbackCreate
from app.core.auth import get_current_user
feedback_router = APIRouter()

@feedback_router.post("/submit_feedback")
def submit_feedback(data: FeedbackCreate , user = Depends(get_current_user)):
    print("--------------- Received feedback data ----------------")
    print(data)
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
