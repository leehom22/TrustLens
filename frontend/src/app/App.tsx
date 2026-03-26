import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from "./components/ThemeProvider";
import { LanguageProvider } from "./components/LanguageProvider";
import { Toaster } from "./components/ui/sonner";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ToastContainer } from 'react-toastify';

// Pages & Components
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import ExpertDashboardPage from "./pages/expert/ExpertDashboardPage";
import DocumentAnalysis from "./pages/expert/DocumentAnalysis";
import { HistoryDocumentAnalysis } from "./pages/HistoryDocumentAnalysis";
import ReviewDocumentList from "./pages/expert/ReviewDocumentList";

// Import the new wrapper page
import AnalysisPage from "./pages/AnalysisPage";
import AlertDocument from "./pages/ScamAlertPage";
import ScamManagementList from "./pages/expert/ScamManagementList";
import ScamManagement from "./pages/expert/ScamManagement";

export type Language = "en" | "ms";

export default function App() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [expert, setExpert] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState<string>("")
  const [documentId, setDocumentId] = useState <string | null> (null)
  const [masterDocId, setMasterDocId] = useState <string | null> (null)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [fileUploadLoading, setFileUploadLoading] = useState(false)
  // Reset to upload page when user logs in or changes
  const [expert, setExpert] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const wasLoggedInRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        const wasLoggedIn = wasLoggedInRef.current;
        wasLoggedInRef.current = false;
        setUser(null);
        setExpert(false);
        setCurrentUserId(null);
        localStorage.removeItem('role');
        setLoading(false);
        if (wasLoggedIn) {
          navigate("/analyze");
        }
        return;
      }

      let isExpert = false;
      try {
        const idTokenResult = await currentUser.getIdTokenResult();
        isExpert = !!idTokenResult.claims.expert;
      } catch (error) {
        console.error("Error fetching claims:", error);
      }

      if (currentUser.uid !== currentUserId) {
        setCurrentUserId(currentUser.uid);
      }

      setUser(currentUser);
      setExpert(isExpert);
      localStorage.setItem('role', isExpert ? 'expert' : 'user');
      setLoading(false);
      wasLoggedInRef.current = true; 
    });

    return () => unsubscribe();
  }, [currentUserId, navigate]);

  if (loading) return null; // Or a global loading spinner
  }, [currentUserId, navigate]); // Added navigate to dependency array

  const handleFileUpload = async (file: File) => {
    // //! Development 
    // setUploadedFile(file);
    // setAppState("analysis");
    // return 
      localStorage.removeItem('latest_analysis');
      localStorage.removeItem('latest_analysis_header');
    

    if (!file) return
    const storageRef = ref(storage, `documents/${currentUserId}/${file.name}`)

    try {
      // 2. Upload the file
      setFileUploadLoading(true)
      // const snapshot = await uploadBytes(storageRef, file);
      // ! Update: Encrypt document in firebase storage 
       const encryptedFile = await encryptFile(file);
      const snapshot = await uploadBytes(storageRef, encryptedFile.encryptedBlob);

      // 3. Get the public download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      const fileUrl = URL.createObjectURL(file)
      setUrl(fileUrl);
      
      const formData = new FormData()
      formData.append("file", file); 

      // 2. Add the metadata fields individually
      formData.append("user_id", currentUserId!);
      formData.append("fileName", file.name);
      formData.append("fileUrl", downloadURL);
      formData.append("fileSize", file.size.toString()); // FormData only accepts strings/blobs
      formData.append("mimeType", file.type);
      formData.append("flagged", "False");
      formData.append("encryptedKey", bufferToBase64(encryptedFile.key));
      formData.append("iv", bufferToBase64(encryptedFile.iv));

      if (downloadURL) {
        console.log("==========The key and iv is: ",bufferToBase64(encryptedFile.key), bufferToBase64(encryptedFile.iv))
        const res = await axios.post(`${backendUrl}/files/upload_files`,formData,{
          headers:{
            "Content-Type":"multipart/form-data"
          }
        })

        if(res.status === 201){
          setUploadedFile(file);
          setDocumentId(res.data.id)
          setMasterDocId(res.data.masterDocId)
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
    localStorage.removeItem('latest_analysis')
    localStorage.removeItem('latest_analysis_header')
    setAppState("upload");
    setUploadedFile(null);
  };

  return (
    <LanguageProvider>
      <ThemeProvider>
        <div className="flex min-h-screen w-full overflow-x-hidden bg-white dark:bg-slate-900 transition-colors duration-300">

          {user && (
            <div className="md:sticky md:inset-y-0 md:left-0 z-50 md:flex md:w-72 flex-col border-r border-gray-200 dark:border-slate-700">
              <Sidebar user={user} />
            </div>
          )}

          <main className={`flex-1 w-full min-w-0 transition-colors duration-300 ${user ? "bg-gray-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}`}>
            <div className={user ? "p-4 md:p-7 w-full max-w-7xl mx-auto" : "w-full"}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />

          {/* Conditional Home Logic */}
          <Route
            path="/"
            element={!user ? <LandingPage /> : <Navigate to={expert ? "/expert-dashboard" : "/upload-document"} />}
          />

          {/* Protected Routes */}
          {user && (
            <>
              <Route
                path="/upload-document"
                element={
                  <div className="w-full h-full min-h-[calc(100vh-4rem)]">
                    {fileUploadLoading && (
                      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="animate-spin text-primary" size={50} />
                          <p className="text-lg font-medium animate-pulse text-slate-900 dark:text-slate-100">
                            Uploading Document...
                          </p>
                        </div>
                      </div>
                    )}
                    
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
                        documentId={documentId!}
                        userId={currentUserId!}
                      />
                    )}
                  </div>
                }
              />
              
              {expert ? (
                <>
                  <Route path="/review-document-list" element={<ReviewDocumentList/>} />
                  <Route path="/expert-dashboard" element={<ExpertDashboardPage />} />
                  <Route path="/review-document/:docId" element={<DocumentAnalysis userId={currentUserId!}/>} />
                </>
              ) : (
                <>
                  <Route path="/history" element={<HistoryPage userId={currentUserId!}/>} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/review-document-analysis/:docId" element={<HistoryDocumentAnalysis />} />
                </>
              )}
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
    </LanguageProvider>
  );
}