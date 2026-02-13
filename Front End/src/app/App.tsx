import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ThemeProvider } from "./components/ThemeProvider";
import { Toaster } from "./components/ui/sonner";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ToastContainer, toast } from 'react-toastify';
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import { DocumentUploader } from "./components/analysis/DocumentUploader";
import { AnalysisInterface } from "./components/analysis/AnalysisInterface";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";
import DocumentReview from "./pages/expert/DocumentReviewPage";
import DocumentAnalysis from "./pages/expert/DocumentAnalysis";
import axios from 'axios'

type AppState = "upload" | "analysis";

export default function App() {
  const navigate = useNavigate();
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [expert, setExpert] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState<string>("")

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  // Reset to upload page when user logs in or changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // 1. Handle Logout
      if (!currentUser) {
        setUser(null);
        setExpert(false);
        setCurrentUserId(null);
        setAppState("upload");
        setUploadedFile(null);
        localStorage.removeItem('role');
        setLoading(false);
        navigate('/login');
        return;
      }

      // 2. Fetch User Claims (Role)
      let isExpert = false;
      try {
        const idTokenResult = await currentUser.getIdTokenResult();
        isExpert = !!idTokenResult.claims.expert;
      } catch (error) {
        console.error("Error fetching claims:", error);
      }

      // 3. Handle Login/User Change Logic
      if (currentUser.uid !== currentUserId) {
        // Only reset the app flow if they AREN'T an expert 
        // Experts usually land on a different view (Review/Dashboard)
        if (!isExpert) {
          setAppState("upload");
          setUploadedFile(null);
          setResetKey(prev => prev + 1);
        }

        setCurrentUserId(currentUser.uid);
      }

      // 4. Update Final States
      setUser(currentUser);
      setExpert(isExpert);
      localStorage.setItem('role', isExpert ? 'expert' : 'user');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const handleFileUpload = async (file: File) => {
    // //! Development 
    // setUploadedFile(file);
    // setAppState("analysis");
    // return 
    if (!file) return
    const storageRef = ref(storage, `documents/${file.name}`)

    try {
      // 2. Upload the file
      const snapshot = await uploadBytes(storageRef, file);

      // 3. Get the public download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      setUrl(downloadURL);
      console.log(`=======Upload successful! - ${downloadURL}=======`);
      if (downloadURL) {
        const res = await axios.post(`${backendUrl}/files/upload_files`,{
          "user_id":currentUserId,
          "fileName":file.name,
          "fileUrl":downloadURL,
          'fileSize':file.size,
          'mimeType':file.type
        })

        if(res.status === 201){
          setUploadedFile(file);
          setAppState("analysis");
          toast.success("File successfully uploaded")
        } else {
          toast.error("Error uploading file")
          return
        };
      }
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  const handleBack = () => {
    setAppState("upload");
    setUploadedFile(null);
  };

  return (
    <ThemeProvider>
      <div className="w-screen">
        {/* Sidebar only appears if user is authenticated */}
        {user && <Sidebar user={user} />}

        <main className={`${user ? "flex-1" : "w-full"}`}>
          <div className={user ? "p-7 max-w-7xl mx-auto" : ""}>

            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Conditional Home Logic */}
              <Route
                path="/"
                element={!user ? <LandingPage /> : <Navigate to={expert ? "/expert-dashboard" : "/upload-document"} />}
              />

              {/* Protected R outes */}
              {user && (
                <>
                  {/* uer & expert */}
                  <Route path="/history" element={<HistoryPage userId={currentUserId!}/>} />
                  <Route
                    path="/upload-document"
                    element={
                      <div className="size-full  ">
                        {appState === "upload" && (
                          <DocumentUploader onFileUpload={handleFileUpload} />
                        )}
                        {appState === "analysis" && uploadedFile && (
                          <AnalysisInterface
                            fileName={uploadedFile.name}
                            onBack={handleBack}
                            userEmail={user.email || "user@example.com"}
                            documentUrl={url}
                            fileType={uploadedFile.type}
                          />
                        )}
                      </div>
                    }
                  />
                  {
                    expert ?
                      <>
                        {/* only expert */}
                        <Route path="/expert-dashboard" element={<DocumentReview />} />
                        <Route path="/review-document/:docId" element={<DocumentAnalysis userId={currentUserId!}/>} />
                      </>

                      : (
                        <>
                          {/* only user */}
                          <Route path="/dashboard" element={<Dashboard />} />
                        </>
                      )
                  }
                </>

              )}

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>

            <Toaster />
            <ToastContainer />
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}