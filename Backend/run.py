import uvicorn
import sys
import os

PORT = int(os.getenv("PORT", 8080))

if __name__ == "__main__":
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    uvicorn.run("app.main:app", host="127.0.0.1", port=PORT, reload=True)