from fastapi import APIRouter, status, HTTPException, Form, UploadFile, File
from app.models.files import FilesSchema
from app.models.files import FlagDocumentRequest, SpamDocumentRequest
from app.utils.scam_alert import sha256_hex,perceptual_hash, utcnow
from app.models.scam_alert import find_duplicate,create_doc
from app.core.firebase import db
from google.cloud import firestore
from google.cloud.firestore import FieldFilter
from datetime import datetime
from typing import List
import base64

files_router = APIRouter()


# user upload files (allow multiple files)
@files_router.post("/upload_files",status_code=status.HTTP_201_CREATED)
def upload_files(files_data: List[FilesSchema]):

    if not files_data:
        raise HTTPException(status_code=400, detail="No file data provided.")
    if len(files_data) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 files allowed per request.")
    
    try: 
        batch = db.batch()
        collection_ref = db.collection("upload_files")
        doc_ids = []
        
        server_time = firestore.SERVER_TIMESTAMP
        
        for file_item in files_data:
            doc_ref = collection_ref.document()
            data_to_save = file_item.model_dump()
            payload = {
                **data_to_save,
                "created_at": server_time,
                "updatedAt": '',
                "analysis_status": "PENDING" 
            }
            batch.set(doc_ref, payload)
            doc_ids.append(doc_ref.id)

        batch.commit()
            
        return {
            "message": "File successfully uploaded",
            "id": doc_ids,
            "timestamp": str(server_time)
        }
    
    except Exception as e:
        print(f"Error saving to Firestore: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to store information in database"
        )

# get all user uploaded files
@files_router.get("/get_uploaded_files/{user_id}")
def get_files(user_id:str):
    try:
        print(f"the user id is {user_id}")
        res = FilesSchema.get_files(user_id=user_id)
        return {
            "success":True,
            "data":res
        }
    except Exception as e:
        print(f"Error fetching uploaded_file: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch data from database"
        )
        
# get selected file (specific)
@files_router.get("/get_selected_files/{doc_id}")
def get_selected_files(doc_id:str):
    try:
        res = FilesSchema.get_selected_file(doc_id = doc_id)
        return {
            "success":True,
            "data":res
        }
    except Exception as e:
        print(f"Error fetch selected_file: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch selected data from database"
        )
        
@files_router.post("/delete_selected_files") # Added trailing slash for better compatibility
def delete_selected_files(doc_id: str = Form(...)):
    try:
        res = FilesSchema.delete_selected_file(doc_id=doc_id)
        
        # If the internal logic reported a failure, we should reflect that
        if not res.get("success"):
            raise HTTPException(
                status_code=400, 
                detail=res.get("error", "Failed to delete file")
            )
            
        return {
            "success": True,
            "data": res
        }
    except HTTPException:
        raise # Re-raise FastAPI HTTP exceptions so they aren't caught by the general Exception
    except Exception as e:
        print(f"Failed to delete selected file with id {doc_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: {str(e)}"
        )
        
# get flagged document for expert side
@files_router.get("/flagged_document") 
def get_flagged_document():
    try:
        data = FilesSchema.get_flagged_files()
        
        return {
            "success":"true",
            "files":data
        }
    except Exception as e:
        print("Error while fetching flagged document: ",e)
        return {
            "success":"false",
            "data":str(e)
        }
    
@files_router.get("/get_history_files/{user_id}")
def get_history_files(user_id: str):
    try:
        # Call our new smart merge function
        res = FilesSchema.get_history_data(user_id=user_id)
        return {
            "success": True,
            "data": res
        }
    except Exception as e:
        print(f"Error fetching history files: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch history data: {str(e)}"
        )

@files_router.get("/dashboard_stats/{user_id}")
def get_dashboard_stats(user_id: str):
    try:
        stats = {
            "total_documents": 0,
            "high_risk_count": 0,       # From analysis_results
            "pending_review_count": 0,  # From upload_files
            "risk_breakdown": {"SAFE": 0, "SUSPICIOUS": 0, "CRITICAL": 0, "CAUTION": 0}
        }

        # 1. Get Risk Data from 'analysis_results'
        analysis_ref = db.collection("analysis_results").where(filter=FieldFilter("user_id", "==", user_id))
        analysis_docs = analysis_ref.stream()

        for doc in analysis_docs:
            data = doc.to_dict()
            risk = data.get("risk_level", "SAFE")
            
            # Pie Chart Data
            if risk in stats["risk_breakdown"]:
                stats["risk_breakdown"][risk] += 1
            
            # KPI: High/Med Risk
            if risk in ["CRITICAL", "SUSPICIOUS"]:
                stats["high_risk_count"] += 1

        # 2. Get Workflow Data from 'upload_files'
        files_ref = db.collection("upload_files").where(filter=FieldFilter("user_id", "==", user_id))
        file_docs = files_ref.stream()

        for doc in file_docs:
            data = doc.to_dict()
            stats["total_documents"] += 1

            # KPI: Pending Review
            is_flagged = data.get("flagged", False)
            expert_review = data.get("expertReview", False)
            # Handle string "true"/"false" or boolean
            is_reviewed = str(expert_review).lower() == "true" or expert_review is True

            if is_flagged and not is_reviewed:
                stats["pending_review_count"] += 1

        return {"success": True, "data": stats}

    except Exception as e:
        print(f"Error fetching stats: {e}")
        return {"success": False, "error": str(e)}
    
    
@files_router.post("/set_flag_document")
def set_file_as_flagged(request: FlagDocumentRequest):

    try:
        document_ref = db.collection("upload_files").document(request.documentId)

        document_ref.set(
            {
                "flagged": True,
                "flaggedReason": request.flaggedReason,
                "expertReview": False,
                "updatedAt": datetime.utcnow().isoformat(),
            },
            merge=True
        )

        return {
            "success": True,
            "message": "Document flagged successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error flagging document: {str(e)}"
        )
        
@files_router.post('/set_spam_document')
def set_file_as_spam(request: SpamDocumentRequest):
    try:
        
        return {
            "success": True,
            "message": "Document flagged successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error flagging document: {str(e)}"
        )