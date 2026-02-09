import os
from dotenv import load_dotenv
from deepgram import DeepgramClient

# 1. Force load the .env file
load_dotenv(dotenv_path="app/.env") 

# 2. Get Key
api_key = os.getenv("DEEPGRAM_API_KEY")
print(f"1. Loaded Key: {api_key[:5]}...{api_key[-5:] if api_key else 'NONE'}")

if not api_key:
    print("❌ ERROR: No API Key found. Check app/.env location.")
    exit()

try:
    # 3. Initialize Client (The correct way)
    deepgram = DeepgramClient(api_key=api_key)

    # 4. Test Fetching Projects (This validates the key)
    print("2. Testing connection to Deepgram...")
    projects = deepgram.manage.v1.get_projects()
    
    if projects.projects:
        print(f"✅ SUCCESS! Found Project ID: {projects.projects[0].project_id}")
        print("   Your API Key is VALID and working.")
    else:
        print("❌ ERROR: Key is valid, but no Projects found. You need to create a Project in Deepgram console.")

except Exception as e:
    print(f"❌ CRITICAL ERROR: {e}")
    print("   -> If this says 'Invalid credentials', your key is wrong.")
    print("   -> If this says 'Forbidden', your key needs 'Admin' scope.")