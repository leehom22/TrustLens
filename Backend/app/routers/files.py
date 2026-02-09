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