from fastapi import APIRouter,status,HTTPException
from app.models.user import UserRegisterSchema,UserLoginSchema
from firebase_admin import auth
user_router = APIRouter()
import requests
import json
from pathlib import Path
from dotenv import load_dotenv
import os
from app.core.firebase import db
from google.cloud import firestore
import uuid

@user_router.post("/register_user", status_code=status.HTTP_201_CREATED)
@user_router.post("/register_user")
def register_user(user_data: UserRegisterSchema):
    # displayName
    # email
    # password
    try:
        # 1. Create User in Firebase Authentication (Secure)
        user_record = auth.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.display_name
        )
        
         # set user identity as a expert
        if user_data.role == 'expert':
            auth.set_custom_user_claims(user_record.uid,{ 'expert': True })
        else: 
            auth.set_custom_user_claims(user_record.uid,{ 'expert': False })
        
        # 2. Save User Profile/Role in Firestore 'users' collection
        db.collection("users").document(user_record.uid).set({
            "email": user_data.email,
            "role": "user",  # or "expert"
            "displayName": user_data.display_name,
            "created_at": firestore.SERVER_TIMESTAMP,
            "is_immunized": False
        })

        return {"message": "User registered and profile created", "uid": user_record.uid}
    except auth.EmailAlreadyExistsError:
        # Specific catch for existing emails
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
@user_router.post("/signIn_user")
def signIn_user(user_data: UserLoginSchema):
    """
    Signs in the user by exchanging email/password for an ID Token
    using the Firebase Auth REST API.
    """
    try:
        BASE_DIR = Path(__file__).resolve().parent.parent  # Backend/app/core -> Backend/
        load_dotenv(BASE_DIR / ".env")  # Make sure .env is loaded

        FIREBASE_WEB_API = os.getenv("FIREBASE_WEB_API")
        if not FIREBASE_WEB_API:
            raise ValueError("FIREBASE_WEB_API not found in .env")

        request_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API}"
        
        payload = {
            "email": user_data.email,
            "password": user_data.password,
            "returnSecureToken": True
        }
        
        # Make the request to Firebase
        response = requests.post(request_url, json=payload)
        response_data = response.json()
        # custom_token = auth.create_custom_token(uuid_string)
        
        # Check for errors in the response
        if "error" in response_data:
            error_msg = response_data["error"]["message"]
            raise HTTPException(
                status_code=400, 
                detail=f"Login failed: {error_msg}"
            )
            
        # Success: Return the ID Token and User Info
        return {
            "message": "Login successful",
            "access_token": response_data["idToken"],
            "refresh_token": response_data["refreshToken"],
            "user_id": response_data["localId"],
            "expires_in": response_data["expiresIn"],
            # "token":custom_token
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {str(e)}"
    )
    

