# setup 
env: put .env under /app
env: dont put "" for the API KEY

# run the server (at Backend path)
python -m app.main

# to put the env variable in a file, use the following code
<!-- can refer file: routers/user.py at function 'signIn_user' -->
        BASE_DIR = Path(__file__).resolve().parent.parent  # Backend/app/core -> Backend/
        load_dotenv(BASE_DIR / ".env")  # Make sure .env is loaded

        API_KEY = os.getenv("API_KEY")
        if not API_KEY:
            raise ValueError("API_KEY not found in .env")

# put 'serviceAccountKey.json' under /app (to connect with firestore db)

# testing endpoint (eg: Postman)
http://127.0.0.1:8000/

# Backend Testing
# - Set-up Test (Terminal)
python Backend/run.py
# - Endpoint Test
http://127.0.0.1:8000/docs

# Deploy Issues
Error occur with opencv-python 

#Deploy backend with Cloud Run 
gcloud run deploy trustlens-backend --source . --region asia-southeast1

1. Sending annotated image to user (DONE)
2. ATS Analysis bug
3. Ai chatbot mode (delete mode selection) (DONE)
4. Deploy CORS issues (DONE)

Fronend Fix:
1. Expert - Document Review Yellow Color text color
2. Display more analysis