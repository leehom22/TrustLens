import os
import httpx # Installed automatically with FastAPI/Deepgram
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

router = APIRouter()

@router.get("/deepgram")
async def get_deepgram_token():
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        print("❌ ERROR: DEEPGRAM_API_KEY is missing from .env")
        raise HTTPException(status_code=500, detail="Deepgram API key not found in .env")

    # Define the headers for authentication
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        try:
            # STEP 1: Get the Project ID
            # We call the API directly instead of relying on the SDK
            project_resp = await client.get("https://api.deepgram.com/v1/projects", headers=headers)
            
            if project_resp.status_code != 200:
                print(f"❌ Deepgram Project Error: {project_resp.text}")
                raise HTTPException(status_code=project_resp.status_code, detail="Failed to get Deepgram projects. Check API Key.")

            projects_data = project_resp.json()
            if not projects_data.get("projects"):
                raise HTTPException(status_code=500, detail="No Deepgram projects found for this key.")
            
            project_id = projects_data["projects"][0]["project_id"]

            # STEP 2: Create a Temporary Key
            # We create a key valid for 60 seconds with 'usage:write' scope
            payload = {
                "comment": "Ephemeral TrustLens Key",
                "scopes": ["usage:write"],
                "time_to_live_in_seconds": 60
            }
            
            key_resp = await client.post(
                f"https://api.deepgram.com/v1/projects/{project_id}/keys",
                headers=headers,
                json=payload
            )

            if key_resp.status_code != 201 and key_resp.status_code != 200:
                print(f"❌ Deepgram Key Gen Error: {key_resp.text}")
                raise HTTPException(status_code=key_resp.status_code, detail="Failed to create temporary key.")

            new_key_data = key_resp.json()
            return {"key": new_key_data["key"]}

        except httpx.RequestError as e:
            print(f"❌ Network Error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to connect to Deepgram API")