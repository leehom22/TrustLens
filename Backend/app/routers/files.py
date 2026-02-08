from fastapi import APIRouter, status, HTTPException
from app.models.files import FilesSchema
from app.core.firebase import db
from google.cloud import firestore
files_router = APIRouter()

# user upload files
@files_router.post("/upload_files",status_code=status.HTTP_201_CREATED)
def upload_files(file_data: FilesSchema):
    try: 
        data_to_save = file_data.model_dump()
        
        update_time, doc_ref = db.collection("upload_files").add({
            **data_to_save,
            "created_at": firestore.SERVER_TIMESTAMP
        })
            
        return {
            "message": "File successfully uploaded",
            "id": doc_ref.id,
            "timestamp": str(update_time)
        }
    
    except Exception as e:
        print(f"Error saving to Firestore: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to store information in database"
        )