import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from 'react-router-dom'
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
import { Loader2 } from "lucide-react";
import { HistoryDocumentAnalysis } from "./pages/HistoryDocumentAnalysis";
import ReviewDocumentList from "./pages/expert/ReviewDocumentList";

type AppState = "upload" | "analysis";

export default function App() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [expert, setExpert] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState<string>("")
  const [documentId, setDocumentId] = useState <string | null> (null)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [fileUploadLoading, setFileUploadLoading] = useState(false)
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
      setFileUploadLoading(true)
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
          'mimeType':file.type,
          'flagged': "False"
        })

        if(res.status === 201){
          setUploadedFile(file);
          setDocumentId(res.data.id)
          setAppState("analysis");
          toast.success("File successfully uploaded")
        } else {
          toast.error("Error uploading file")
          return
        };
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setFileUploadLoading(false)
    }
  };

  const handleBack = () => {
    setAppState("upload");
    setUploadedFile(null);
  };

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
        {/* Sidebar only appears if user is authenticated */}
        {user && <Sidebar user={user} />}

        <main className={`flex-1 transition-all duration-300 `}>
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
                  
                  <Route
                    path="/upload-document"
                    element={
                      <div className="size-full  ">
                        {
                          fileUploadLoading && (
                            <div className="w-full flex items-center justify-center inset-0 fixed z-50">
                                <Loader2 className="relative animate-spin mx-auto" size={50}/>
                            </div>
                          )
                        }
                        {!fileUploadLoading && appState === "upload" && (
                          <DocumentUploader onFileUpload={handleFileUpload} />
                        )}
                        {!fileUploadLoading && appState === "analysis" && uploadedFile && (
                          <AnalysisInterface
                            fileName={uploadedFile.name}
                            onBack={handleBack}
                            userEmail={user.email || "user@example.com"}
                            documentUrl={url}
                            fileType={uploadedFile.type}
                            file={uploadedFile}
                            documentId={documentId}
                            userId={currentUserId}
                          />
                        )}
                      </div>
                    }
                  />
                  {
                    expert ?
                      <>
                        {/* only expert */}
                        <Route path="/review-document-list" element={<ReviewDocumentList/>} />
                        <Route path="/expert-dashboard" element={<DocumentReview />} />
                        <Route path="/review-document/:docId" element={<DocumentAnalysis userId={currentUserId!}/>} />
                      </>

                      : (
                        <>
                          {/* only user */}
                          <Route path="/history" element={<HistoryPage userId={currentUserId!}/>} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/review-document-analysis/:docId" element={<HistoryDocumentAnalysis />} />
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