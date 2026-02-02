import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { Toaster } from "@/app/components/ui/sonner";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ToastContainer, toast } from 'react-toastify';
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import { DocumentUploader } from "./components/analysis/DocumentUploader";
import { AnalysisInterface } from "./components/analysis/AnalysisInterface";
import DocumentReview from "./pages/expert/DocumentReviewPage";
import DocumentAnalysis from "./components/expert/documentAnalysis";

type AppState = "upload" | "analysis";

export default function App() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [expert, setExpert] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)

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

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setAppState("analysis");
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
                  <Route path="/history" element={<HistoryPage />} />
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
                      <Route path="/review-document" element={<DocumentAnalysis/>}/>
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
// <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
//   <Sidebar user={user}/>
//   <ThemeProvider>
//     <Routes>
//       <Route path="login" element={<LoginPage/>}/>
//       {
//         !user &&  <Route path="/" element={<LandingPage/>}/>
//       }
//       {
//         user && (
//           <Route path="/"/>
//         )
//       }
//     </Routes>
//     {/* <AuthGate key={resetKey}>
//       <div className="size-full">
//         {appState === "upload" && (
//           <DocumentUploader onFileUpload={handleFileUpload} />
//         )}
//         {appState === "analysis" && uploadedFile && (
//           <AnalysisInterface
//             key={uploadedFile.name + Date.now()}
//             fileName={uploadedFile.name}
//             onBack={handleBack}
//             userEmail={auth.currentUser?.email || "user@example.com"}
//           />
//         )}
//       </div>
//     </AuthGate> */}
//     <Toaster />
//     <ToastContainer />
//   </ThemeProvider>
// </div>