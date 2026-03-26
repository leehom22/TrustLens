import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from "./components/ThemeProvider";
import { LanguageProvider } from "./components/LanguageProvider";
import { Toaster } from "./components/ui/sonner";
import { auth, storage } from "../lib/firebase"; // Ensure storage is exported from firebase config
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ToastContainer, toast } from 'react-toastify';
import axios from "axios";
import { Loader2 } from "lucide-react";

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
import { DocumentUploader } from "./components/analysis/DocumentUploader";
import { AnalysisInterface } from "./components/analysis/AnalysisInterface";
import { bufferToBase64, encryptFile } from "@/lib/encrypt";
import ScamManagementList from "./pages/expert/ScamManagementList";
import ScamManagement from "./pages/expert/ScamManagement";
import ScamAlertPage from "./pages/ScamAlertPage";
import AnalysisPage from "./pages/AnalysisPage";


export type Language = "en" | "ms";

export default function App() {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // --- State Declarations ---
  const [user, setUser] = useState<User | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expert, setExpert] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [fileUploadLoading, setFileUploadLoading] = useState<boolean>(false)
  // App Logic States
  const [appState, setAppState] = useState<"upload" | "analysis">("upload");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // Array of files  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [url, setUrl] = useState<string[]>([]);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);  // Array of IDs  const [masterDocId, setMasterDocId] = useState<[string] | null>(null);
  const [masterDocIds, setMasterDocIds] = useState<string[]>([]); // Array of Master IDs
  const [fileNames, setFileNames] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wasLoggedInRef = useRef(false);

  // --- Auth Observer ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        wasLoggedInRef.current = false;
        setUser(null);
        setExpert(false);
        setCurrentUserId(null);
        localStorage.removeItem('role');
        setLoading(false);
        return;
      }

      let isExpert = false;
      try {
        const idTokenResult = await currentUser.getIdTokenResult();
        isExpert = !!idTokenResult.claims.expert;
      } catch (error) {
        console.error("Error fetching claims:", error);
      }

      setCurrentUserId(currentUser.uid);
      setUser(currentUser);
      setExpert(isExpert);
      localStorage.setItem('role', isExpert ? 'expert' : 'user');
      setLoading(false);

      // Navigate to analyze if they just logged in
      if (!wasLoggedInRef.current) {
        wasLoggedInRef.current = true;
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // --- Handlers ---
  const handleFileUpload = async (files: File[]) => { // Changed from file: File
    localStorage.removeItem('latest_analysis');
    localStorage.removeItem('latest_analysis_header');

    if (!files || files.length === 0 || !currentUserId) return;

    try {
      setFileUploadLoading(true);

      // We will collect metadata for ALL files before calling the backend
      const filesMetadata = await Promise.all(files.map(async (file) => {
        // 1. Encrypt each file
        const encryptedFile = await encryptFile(file);
        const storageRef = ref(storage, `documents/${currentUserId}/${file.name}`);

        // 2. Upload encrypted blob to Firebase
        const snapshot = await uploadBytes(storageRef, encryptedFile.encryptedBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        setUrl(prev => [...prev, downloadURL])
        // Return the object structure your backend "FilesSchema" expects
        return {
          fileName: file.name,
          fileUrl: downloadURL,
          fileSize: file.size,
          mimeType: file.type,
          encryptedKey: bufferToBase64(encryptedFile.key),
          iv: bufferToBase64(encryptedFile.iv),
          // file: file // Note: In FastAPI, the binary is usually a separate Form field
        };
      }));

      // 3. Prepare FormData for the backend
      const formData = new FormData();

      // Append the binary files
      files.forEach((file) => {
        formData.append("files", file); // Backend expects a list of files
      });

      // Append the metadata as a JSON string (or individual fields if preferred)
      // Most FastAPI 'List[Schema]' setups prefer the metadata sent this way 
      // when mixed with multi-file uploads
      formData.append("metadata", JSON.stringify(filesMetadata));

      const res = await axios.post(`${backendUrl}/files/upload_files`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.status === 201) {
        setUploadedFiles(files);      // Store the whole array
        const newFileNames = files.map(file => file.name);
        const newFileTypes = files.map(file => file.type)

        setFileNames(prev => [...prev, ...newFileNames]);
        setFileTypes(prev => [...prev, ...newFileTypes])

        setDocumentIds(res.data.id);  // Array of IDs from backend
        setMasterDocIds(res.data.masterDocId); // Array of Master IDs

        // Navigate or change view
        setAppState("analysis");
        toast.success(`${files.length} file(s) successfully uploaded`);
      }
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Error uploading files");
    } finally {
      setFileUploadLoading(false);
    }
  };

  const handleBack = () => {
    localStorage.removeItem('latest_analysis');
    localStorage.removeItem('latest_analysis_header');
    setAppState("upload");
    setUploadedFiles([]);
  };

  if (loading) return null;

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
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/"
                  element={!user ? <LandingPage /> : <Navigate to={expert ? "/expert-dashboard" : "/upload-document"} />}
                />
                {/* ── Guest Analysis Route ── */}
                <Route
                  path="/analyze"
                  element={user ? <Navigate to="/upload-document" /> : <AnalysisPage isGuest={true} />}
                />
                {user && (
                  <>
                    {/* Protected Routes */}
                      <>
                        <Route
                          path="/upload-document"
                          element={<AnalysisPage isGuest={false} />}
                        />
                      </>


                    {expert ? (
                      <>
                        <Route path="/review-document-list" element={<ReviewDocumentList />} />
                        <Route path="/expert-dashboard" element={<ExpertDashboardPage />} />
                        <Route path="/review-document/:docId" element={<DocumentAnalysis userId={currentUserId!} />} />
                        <Route path="/scam-alert-list" element={<ScamManagementList />} />
                        <Route path="/scam-alert/:docId/:adminQId" element={<ScamManagement userId={currentUserId!} />} /> {/*adminQId = adminQueueId , docId = masterDocId */}
                      </>
                    ) : (
                      <>
                        <Route path="/history" element={<HistoryPage userId={currentUserId!} />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/review-document-analysis/:docId/:masterDocId" element={<HistoryDocumentAnalysis />} />
                        <Route path="/alert" element={<ScamAlertPage />} />
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
      </ThemeProvider >
    </LanguageProvider >
  );
}


{/* <Route
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

                          {/* Show each of the files  
                          {!fileUploadLoading && appState === "analysis" && uploadedFiles.length > 0 && (
                            <AnalysisInterface
                              fileNames={fileNames}
                              onBack={handleBack}
                              userEmail={user.email || "user@example.com"}
                              documentUrls={url} // You might need to update this to url[0]
                              fileTypes={fileTypes}
                              files={uploadedFiles}
                              documentIds={documentIds} // Pass the first ID
                              userId={currentUserId!}
                              masterDocIds={masterDocIds}
                            />
                          )}
                          {/* {!fileUploadLoading && appState === "analysis" && uploadedFiles.length > 0 && (
                            <AnalysisInterface
                              fileName={uploadedFiles[selectedIndex].name}
                              fileType={uploadedFiles[selectedIndex].type} // Only passes the .type string
                              documentUrl={url[selectedIndex]}
                              documentId={documentIds[selectedIndex]}
                              file={uploadedFiles[selectedIndex]}
                              onBack={handleBack}
                              userId={currentUserId!}
                            />
                          )} */}
                      //   </div >
                      // }/> 
                      // */}