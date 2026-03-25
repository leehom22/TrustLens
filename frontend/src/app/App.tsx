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

export type Language = "en" | "ms";

export default function App() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
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

                {/* ── Guest Analysis Route ── */}
                <Route
                  path="/analyze"
                  element={user ? <Navigate to="/upload-document" /> : <AnalysisPage isGuest={true} />}
                />

                {/* Protected Routes */}
                {user && (
                  <>
                    <Route
                      path="/upload-document"
                      element={<AnalysisPage isGuest={false} />}
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
    </LanguageProvider>
  );
}