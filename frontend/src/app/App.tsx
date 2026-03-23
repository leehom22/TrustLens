import { useState, useEffect, useRef } from "react";
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
import ExpertDashboardPage from "./pages/expert/ExpertDashboardPage";
import DocumentAnalysis from "./pages/expert/DocumentAnalysis";
import axios from 'axios'
import { Loader2 } from "lucide-react";
import { HistoryDocumentAnalysis } from "./pages/HistoryDocumentAnalysis";
import ReviewDocumentList from "./pages/expert/ReviewDocumentList";
import { bufferToBase64, encryptFile } from "@/lib/encrypt";

type AppState = "upload" | "analysis";
export type Language = "en" | "ms";

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
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en")
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [fileUploadLoading, setFileUploadLoading] = useState(false)

  // ─── Guest (unauthenticated) state ───────────────────────────────────────
  const [guestAppState, setGuestAppState] = useState<AppState>("upload")
  const [guestFile, setGuestFile] = useState<File | null>(null)
  const [guestUrl, setGuestUrl] = useState<string>("")
  const [guestLanguage, setGuestLanguage] = useState<Language>("en")

  // Tracks whether the user was previously authenticated — used to detect sign-out vs initial load
  const wasLoggedInRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        const wasLoggedIn = wasLoggedInRef.current;
        wasLoggedInRef.current = false;
        setUser(null);
        setExpert(false);
        setCurrentUserId(null);
        setAppState("upload");
        setUploadedFile(null);
        localStorage.removeItem('role');
        setLoading(false);
        // Only redirect to /analyze if user was previously signed in (sign-out event)
        // Not on initial page load where user was never logged in
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
        if (!isExpert) {
          setAppState("upload");
          setUploadedFile(null);
          setResetKey(prev => prev + 1);
        }
        setCurrentUserId(currentUser.uid);
      }

      setUser(currentUser);
      setExpert(isExpert);
      localStorage.setItem('role', isExpert ? 'expert' : 'user');
      setLoading(false);
      wasLoggedInRef.current = true; // mark that a user is now logged in
    });

    return () => unsubscribe();
  }, [currentUserId, navigate]);

  // ─── Authenticated user upload ────────────────────────────────────────────
  const handleFileUpload = async (file: File, language: Language) => {
    setSelectedLanguage(language);
    localStorage.removeItem('latest_analysis');
    localStorage.removeItem('latest_analysis_header');

    if (!file) return;
    const storageRef = ref(storage, `documents/${currentUserId}/${file.name}`)

    try {
      setFileUploadLoading(true)
      const encryptedFile = await encryptFile(file);
      const snapshot = await uploadBytes(storageRef, encryptedFile.encryptedBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const fileUrl = URL.createObjectURL(file)
      setUrl(fileUrl);

      if (downloadURL) {
        const res = await axios.post(`${backendUrl}/files/upload_files`, [
          {
            "user_id": currentUserId,
            "fileName": file.name,
            "fileUrl": downloadURL,
            "fileSize": file.size,
            "mimeType": file.type,
            "flagged": "False",
            "encryptedKey": bufferToBase64(encryptedFile.key),
            "iv": bufferToBase64(encryptedFile.iv)
          }
        ])

        if (res.status === 201) {
          setUploadedFile(file);
          setDocumentId(res.data.id[0])  // backend returns array of ids
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

  // ─── Guest upload (no Firebase, no DB) ───────────────────────────────────
  const handleGuestFileUpload = (file: File, language: Language) => {
    localStorage.removeItem('latest_analysis');
    localStorage.removeItem('latest_analysis_header');
    const fileUrl = URL.createObjectURL(file);
    setGuestFile(file);
    setGuestUrl(fileUrl);
    setGuestLanguage(language);
    setGuestAppState("analysis");
  };

  const handleBack = () => {
    localStorage.removeItem('latest_analysis')
    localStorage.removeItem('latest_analysis_header')
    setAppState("upload");
    setUploadedFile(null);
  };

  const handleGuestBack = () => {
    localStorage.removeItem('latest_analysis')
    localStorage.removeItem('latest_analysis_header')
    setGuestAppState("upload");
    setGuestFile(null);
  };

  return (
    <ThemeProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-white dark:bg-slate-900 transition-colors duration-300">

        {user && (
          <div className="md:sticky md:inset-y-0 md:left-0 z-50 md:flex md:w-72 flex-col border-r border-gray-200 dark:border-slate-700">
            <Sidebar user={user} />
          </div>
        )}

        <main className={`flex-1 w-full min-w-0 transition-colors duration-300 ${user ? "bg-gray-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"
          }`}>

          <div className={user ? "p-4 md:p-7 w-full max-w-7xl mx-auto" : "w-full"}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Conditional Home Logic */}
              <Route
                path="/"
                element={!user ? <LandingPage /> : <Navigate to={expert ? "/expert-dashboard" : "/upload-document"} />}
              />

              {/* ── Guest Analysis Route (no login required) ── */}
              <Route
                path="/analyze"
                element={
                  user
                    ? <Navigate to="/upload-document" /> // logged-in users use the real flow
                    : (
                      <div className="w-full min-h-screen">
                        {guestAppState === "upload" && (
                          <DocumentUploader
                            onFileUpload={handleGuestFileUpload}
                            isGuest
                          />
                        )}
                        {guestAppState === "analysis" && guestFile && (
                          <AnalysisInterface
                            fileName={guestFile.name}
                            onBack={handleGuestBack}
                            userEmail=""
                            documentUrl={guestUrl}
                            fileType={guestFile.type}
                            file={guestFile}
                            documentId=""
                            userId=""
                            language={guestLanguage}
                            isGuest
                          />
                        )}
                      </div>
                    )
                }
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
                            language={selectedLanguage}
                            isGuest={false}
                          />
                        )}
                      </div>
                    }
                  />

                  {expert ? (
                    <>
                      <Route path="/review-document-list" element={<ReviewDocumentList />} />
                      <Route path="/expert-dashboard" element={<ExpertDashboardPage />} />
                      <Route path="/review-document/:docId" element={<DocumentAnalysis userId={currentUserId!} />} />
                    </>
                  ) : (
                    <>
                      <Route path="/history" element={<HistoryPage userId={currentUserId!} />} />
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
  );
}
