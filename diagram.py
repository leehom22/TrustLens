from diagrams import Diagram, Cluster, Edge
from diagrams.generic.compute import Rack
from diagrams.generic.database import SQL
from diagrams.generic.storage import Storage
from diagrams.programming.framework import React
from diagrams.programming.language import Python
from diagrams.onprem.client import User
from diagrams.generic.blank import Blank

with Diagram("TrustLens Architecture", show=False, direction="TB"):
    user = User("User")

    with Cluster("Frontend (React + TypeScript)"):
        frontend = React("React App\n(Vite)")
        doc_uploader = Rack("Document\nUploader")
        doc_viewer = Rack("Document\nViewer")
        analysis_ui = Rack("Analysis\nInterface")
        heatmap_viz = Rack("Heatmap\nVisualization")

    with Cluster("Backend (FastAPI + Python)"):
        backend = Python("FastAPI Server")
        with Cluster("API Routers"):
            analysis_router = Rack("Analysis\nRouter")
            chat_router = Rack("Chat\nRouter")
            speech_router = Rack("Speech\nRouter")
            files_router = Rack("Files\nRouter")
            user_router = Rack("User\nRouter")

        with Cluster("AI Services"):
            agent_service = Rack("Agent\nService")
            layer0 = Rack("Layer 0\n(Preprocessing)")
            layer1 = Rack("Layer 1\n(Feature Extraction)")
            layer2 = Rack("Layer 2\n(Analysis)")
            layer3 = Rack("Layer 3\n(Processing)")
            layer4 = Rack("Layer 4\n(Output)")

    with Cluster("Database & Storage"):
        firestore = SQL("Firebase\nFirestore")
        firebase_storage = Storage("Firebase\nStorage")

    with Cluster("External APIs"):
        google_ai = Blank("Google AI\nGenerative AI")
        deepgram = Blank("Deepgram\nSpeech-to-Text")

    # User flow
    user >> frontend
    frontend >> [doc_uploader, doc_viewer, analysis_ui, heatmap_viz]

    # Frontend to Backend
    frontend >> backend

    # Backend routers
    backend >> analysis_router
    backend >> chat_router
    backend >> speech_router
    backend >> files_router
    backend >> user_router

    # AI processing layers
    analysis_router >> agent_service
    agent_service >> [layer0, layer1, layer2, layer3, layer4]

    # Data connections
    [analysis_router, speech_router, files_router, user_router] >> firestore
    [analysis_router, files_router] >> firebase_storage

    # External API calls
    layer2 >> google_ai
    speech_router >> deepgram

    # Document processing flow
    doc_uploader >> files_router
    files_router >> analysis_router