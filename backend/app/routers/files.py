from fastapi import APIRouter, status, HTTPException,Form, UploadFile, File
from app.models.files import FilesSchema
from app.models.files import FlagDocumentRequest, SpamDocumentRequest
from app.utils.scam_alert import sha256_hex,perceptual_hash, utcnow
from app.models.scam_alert import find_duplicate,create_doc
from app.core.firebase import db
from google.cloud import firestore
from google.cloud.firestore import FieldFilter
from datetime import datetime
import base64

files_router = APIRouter()


# user upload files
@files_router.post("/upload_files",status_code=status.HTTP_201_CREATED)
async def upload_files(
    user_id: str = Form(...),
    fileName: str = Form(...),
    fileUrl: str = Form(...),
    fileSize: int = Form(...),
    mimeType: str = Form(...),
    flagged: bool = Form(False),
    encryptedKey: str = Form(...),
    iv: str = Form(...),
    file: UploadFile = File(...)
):
    try: 
        if not fileName:
            raise HTTPException(400,"No file provided")
        
        # create sha details of the document 
        raw = await file.read()
        file_sha256 = sha256_hex(raw)
        phash       = perceptual_hash(raw)
        
        # ── Deduplication check ───────────────────────────────────────────────────
        existing = find_duplicate(file_sha256, phash)
        if existing:
            master_docId = existing["id"]
            print("Same document has been uploaded before. The document will not be saved in the 'documents collection")
        else:
            # Save documents into /documents collection 
            doc_data = {
                "filename":         fileName,
                "ai_analysis_id": '', # update in analysis.py
                "file_hash":        file_sha256,
                "perceptual_hash":  phash,
                "fileUrl":   fileUrl,
        
                "document_type":    mimeType,
                "threat_category":  "Unknown",
                "ai_confidence":    0, # update in analysis.py
                "scam_indicators":  [],
                "redacted_preview": "",
                "gemini_reasoning": "", # update in analysis.py
        
                "track":            None,
                "status":           "PENDING",
                "report_count":     0,
                "avg_report_score": 0.0,
                "states_reported":  [],
                "is_national":      False,
        
                "first_flagged":    utcnow(),
                "last_seen":        utcnow(),
                "published_at":     None,
                "created_at":       utcnow(),
            }
            master_docId = create_doc(doc_data)
        
        file_data = {
            "user_id" : user_id,
            "master_doc_id":master_docId,
            "fileName": fileName,
            "fileUrl" : fileUrl,
            "fileSize": fileSize,
            "mimeType": mimeType,
            "flagged": flagged,
            "encryptedKey":encryptedKey,
            "iv":iv,
        }
        
        update_time, doc_ref = db.collection("upload_files").add({
            **file_data,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updatedAt": ''
        })
            
        return {
            "message": "File successfully uploaded",
            "id": doc_ref.id,
            "masterDocId":master_docId,
            "timestamp": str(update_time)
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