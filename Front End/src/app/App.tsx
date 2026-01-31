import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { AuthGate } from "@/app/components/AuthGate";
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
import DocumentReview from "./pages/admin/documentReview";

type AppState = "upload" | "analysis";

export default function App() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true)

  // Reset to upload page when user logs in or changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const newUserId = user?.uid || null;

      if (newUserId !== currentUserId) {
        // User changed (login, logout, or different user)
        setCurrentUserId(newUserId);
        setAppState("upload");
        setUploadedFile(null);
        setResetKey(prev => prev + 1); // Force complete remount
      }
    });

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      <div className={user ? "p-8 max-w-7xl mx-auto" : ""}>
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Conditional Home Logic */}
          <Route 
            path="/" 
            element={!user ? <LandingPage /> : <Navigate to="/upload-document" />} 
          />

          {/* Protected Routes */}
          {user && (
            <Route
              path="/upload-document"
              element={
                <div className="size-full">
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
            
          )}
          {
            user && <Route path="/dashboard" element={<Dashboard/>}/>
          }
          {
            user && <Route path="/history" element={<HistoryPage/>}/>
          }
          {
            user && <Route path="/review" element={<DocumentReview/>}/>
          }

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