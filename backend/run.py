import uvicorn
import sys
import os

PORT = int(os.getenv("PORT", 8080))

if __name__ == "__main__":
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)