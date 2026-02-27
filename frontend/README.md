💻 TrustLens Frontend
The user interface for document ingestion and real-time forgery reporting.

✨ Features

Login:

Analysis Dashboard: Visualizes "Confidence Scores" and highlighted forgery zones.

Expert Analysis Dashboard Page: 

Expert Document Review Page: 

Secure Auth: Firebase Authentication for multi-tenant access.

Drag-and-Drop: Intuitive document upload interface.


Responsive Design: Built with Tailwind CSS for mobile and desktop forensics.

📦 Setup

Navigate to folder: cd frontend

Install dependencies: npm install

Configure .env:

Plaintext
VITE_FIREBASE_API_KEY= your_key
VITE_BACKEND_URL=http://127.0.0.1:8000

Launch: npm run dev