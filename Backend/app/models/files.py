from pydantic import BaseModel
from app.core.firebase import db
from firebase_admin import auth

file_collection = "upload_files"
class FilesSchema(BaseModel):
    user_id: str
    fileName: str
    fileUrl: str
    fileSize: int
    mimeType: str
    
    # get user uploaded files
    @staticmethod
    def get_files(user_id:str):
        docs = db.collection(file_collection).where("user_id", "==", user_id).stream()
        return [{**doc.to_dict(), "id": doc.id} for doc in docs]
    
    # get selected files
    def get_selected_file(doc_id: str):
        # 1. Get the document from Firestore
        doc_ref = db.collection(file_collection).document(doc_id).get()
        
        if not doc_ref.exists:
            return {"error": "Document not found"}, 404

        doc_data = doc_ref.to_dict()
        
        # 2. Get the User ID from the document
        # Assuming your document has a field named 'userId' or 'owner_id'
        user_id = doc_data.get("user_id") 
        print(f"The user id is {user_id}")
        user_info = {}
        if user_id:
            try:
                # 3. Fetch data from Firebase Authentication
                user = auth.get_user(user_id)
                user_info = {
                    "username": user.display_name,
                    "email": user.email,
                    "created_at": user.user_metadata.creation_timestamp # Epoch time
                }
                print(f"The user is {user_info}")
            except Exception as e:
                # Handle case where user exists in DB but was deleted from Auth
                print("Error occur while fetching user data ")
                user_info = {"error": "User profile not found"}

        # 4. Return combined data
        return {
            **doc_data, 
            "id": doc_ref.id,
            "user": user_info
        }