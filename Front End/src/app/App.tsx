import { useState, useEffect } from "react";
import { DocumentUploader } from "@/app/components/DocumentUploader";
import { AnalysisInterface } from "@/app/components/AnalysisInterface";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { AuthGate } from "@/app/components/AuthGate";
import { Toaster } from "@/app/components/ui/sonner";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type AppState = "upload" | "analysis";

export default function App() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

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
      <AuthGate key={resetKey}>
        <div className="size-full">
          {appState === "upload" && (
            <DocumentUploader onFileUpload={handleFileUpload} />
          )}
          {appState === "analysis" && uploadedFile && (
            <AnalysisInterface 
              key={uploadedFile.name + Date.now()}
              fileName={uploadedFile.name}
              onBack={handleBack}
              userEmail={auth.currentUser?.email || "user@example.com"}
            />
          )}
        </div>
        <Toaster />
      </AuthGate>
    </ThemeProvider>
  );
}