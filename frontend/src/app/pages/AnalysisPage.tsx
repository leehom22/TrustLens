/**
 * AnalysisPage.tsx
 *
 * Wrapper page that orchestrates the upload → analysis flow.
 * Language selection modal has been removed — the backend saves both EN and BM
 * automatically. The display language comes from the global LanguageProvider
 * (useLanguage hook), so toggling EN | BM anywhere updates the whole app.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Firebase & Utils
import { auth, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { encryptFile, bufferToBase64 } from "@/lib/encrypt";

// Components
import { DocumentUploader } from "../components/analysis/DocumentUploader";
import { AnalysisInterface } from "../components/analysis/AnalysisInterface";
import { useLanguage } from "../components/LanguageProvider";

interface AnalysisPageProps {
  isGuest?: boolean;
}

export default function AnalysisPage({ isGuest = false }: AnalysisPageProps) {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // Language comes from global context — no local state needed
  const { language } = useLanguage();

  const user = auth.currentUser;
  const currentUserId = user?.uid || "guest";
  const userEmail = user?.email || "";

  const [isUploading, setIsUploading] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    fileNames: string[];
    documentUrls: string[];
    fileTypes: string[];
    documentIds: string[];
    files: File[];
  } | null>(null);

  // ─── Handle File Uploads ──────────────────────────────────────────────────────
  /**
   * Called by DocumentUploader with validated files.
   * No language parameter — language is read from LanguageProvider context.
   */
  const handleFileUpload = async (uploadedFiles: File[]) => {
    localStorage.removeItem("latest_analysis");
    localStorage.removeItem("latest_analysis_header");

    setIsUploading(true);

    try {
      const fileNames = uploadedFiles.map(f => f.name);
      const fileTypes = uploadedFiles.map(f => f.type);

      // Guest flow — skip Firebase, use local blob URLs
      if (isGuest) {
        const localUrls = uploadedFiles.map(file => URL.createObjectURL(file));
        setAnalysisData({
          fileNames,
          documentUrls: localUrls,
          fileTypes,
          documentIds: uploadedFiles.map(() => ""),
          files: uploadedFiles,
        });
        return;
      }

      toast.info(`Encrypting and uploading ${uploadedFiles.length} document(s)...`);

      // Step 1: Encrypt and upload all files concurrently to Firebase Storage
      const uploadPromises = uploadedFiles.map(async (file) => {
        if (!user) throw new Error("Firebase Auth sync error. Please refresh and try again.");
        const encryptedFile = await encryptFile(file);
        const uniqueName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const storageRef = ref(storage, `documents/${currentUserId}/${uniqueName}`);
        const snapshot = await uploadBytes(storageRef, encryptedFile.encryptedBlob);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return {
          file,
          downloadUrl,
          encryptedKey: bufferToBase64(encryptedFile.key),
          iv: bufferToBase64(encryptedFile.iv),
        };
      });

      const uploadedData = await Promise.all(uploadPromises);
      const localUrls = uploadedFiles.map(file => URL.createObjectURL(file));

      // Step 2: Save metadata to backend DB
      toast.info("Saving document records...");
      const filesPayload = uploadedData.map(data => ({
        user_id: currentUserId,
        fileName: data.file.name,
        fileUrl: data.downloadUrl,
        fileSize: data.file.size,
        mimeType: data.file.type,
        flagged: false,
        encryptedKey: data.encryptedKey,
        iv: data.iv,
      }));

      const dbResponse = await axios.post(`${backendUrl}/files/upload_files`, filesPayload);
      const documentIds = dbResponse.data.id;

      // Step 3: Transition to analysis — language is read from context in AnalysisInterface
      setAnalysisData({
        fileNames,
        documentUrls: localUrls,
        fileTypes,
        documentIds,
        files: uploadedFiles,
      });

      toast.success("Files uploaded and ready for analysis!");

    } catch (error: any) {
      console.error("Upload error:", error);
      let msg = "Failed to upload files. Please try again.";
      if (error?.response?.data) msg = `Backend Error: ${JSON.stringify(error.response.data)}`;
      else if (error?.code) msg = `Firebase Storage Error: ${error.message}`;
      else if (error?.message) msg = error.message;
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    // Revoke object URLs to avoid memory leaks
    if (analysisData?.documentUrls) {
      analysisData.documentUrls.forEach(url => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    }
    setAnalysisData(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  // Uploading spinner
  if (isUploading) {
    return (
      <div className="w-full h-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-medium animate-pulse text-slate-900 dark:text-slate-100 mb-2">
          Processing Documents...
        </h2>
      </div>
    );
  }

  // Analysis interface — language comes from useLanguage() inside AnalysisInterface
  if (analysisData) {
    return (
      <AnalysisInterface
        fileNames={analysisData.fileNames}
        documentUrls={analysisData.documentUrls}
        fileTypes={analysisData.fileTypes}
        documentIds={analysisData.documentIds}
        files={analysisData.files}
        language={language}        // from global LanguageProvider context
        userId={currentUserId}
        userEmail={userEmail}
        isGuest={isGuest}
        onBack={handleBack}
      />
    );
  }

  // Upload page
  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)]">
      <DocumentUploader onFileUpload={handleFileUpload} isGuest={isGuest} />
    </div>
  );
}
