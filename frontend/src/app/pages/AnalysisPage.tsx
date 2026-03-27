import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, X, FileText, FileImage, File, Sparkles, Upload } from "lucide-react";

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

const MAX_FILES = 3;

/** Returns a fitting icon based on MIME type */
function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType === "application/pdf" || mimeType.includes("text"))
    return <FileText className={className} />;
  return <File className={className} />;
}

/** Human-readable file size */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnalysisPage({ isGuest = false }: AnalysisPageProps) {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const { language } = useLanguage();

  // --- LANGUAGE CONTEXT ---
  const t = {
    en: {
      maxIgnored: `Only ${MAX_FILES} files allowed. Extra files were ignored.`,
      uploadFirst: "Please upload at least one file before analysing.",
      encrypting: (count: number) => `Encrypting and uploading ${count} document(s)...`,
      saving: "Saving document records...",
      success: "Files uploaded and ready for analysis!",
      failFallback: "Failed to upload files. Please try again.",
      processing: "Processing Documents...",
      selected: "Selected Files",
      maxReached: "Maximum files reached",
      startAnalyze: "Start Analyze"
    },
    ms: {
      maxIgnored: `Hanya ${MAX_FILES} fail dibenarkan. Fail tambahan diabaikan.`,
      uploadFirst: "Sila muat naik sekurang-kurangnya satu fail sebelum menganalisis.",
      encrypting: (count: number) => `Menyulitkan dan memuat naik ${count} dokumen...`,
      saving: "Menyimpan rekod dokumen...",
      success: "Fail dimuat naik dan sedia untuk dianalisis!",
      failFallback: "Gagal memuat naik fail. Sila cuba lagi.",
      processing: "Memproses Dokumen...",
      selected: "Fail Dipilih",
      maxReached: "Fail maksimum dicapai",
      startAnalyze: "Mula Analisis"
    }
  }[language];

  const user = auth.currentUser;
  const currentUserId = user?.uid || "guest";
  const userEmail = user?.email || "";

  const [isUploading, setIsUploading] = useState(false);

  // Staged files — selected but NOT yet sent to backend
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Final analysis data — set after successful backend upload
  const [analysisData, setAnalysisData] = useState<{
    fileNames: string[];
    documentUrls: string[];
    fileTypes: string[];
    documentIds: string[];
    files: File[];
    masterDocIds: string[];
  } | null>(null);

  // ─── Stage files from DocumentUploader ───────────────────────────────────────
  /**
   * DocumentUploader calls this with the newly chosen files.
   * We merge them into stagedFiles (respecting the MAX_FILES cap).
   */
  const handleFilesSelected = (incomingFiles: File[]) => {
    setStagedFiles((prev) => {
      const combined = [...prev, ...incomingFiles];
      if (combined.length > MAX_FILES) {
        toast.warning(t.maxIgnored);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  /** Remove a single staged file by index */
  const handleRemoveFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Start Analysis — upload to backend then show AnalysisInterface ──────────
  const handleStartAnalysis = async () => {
    if (stagedFiles.length === 0) {
      toast.error(t.uploadFirst);
      return;
    }

    localStorage.removeItem("latest_analysis");
    localStorage.removeItem("latest_analysis_header");

    setIsUploading(true);

    try {
      const fileNames = stagedFiles.map((f) => f.name);
      const fileTypes = stagedFiles.map((f) => f.type);

      // Guest flow — skip Firebase, use local blob URLs
      if (isGuest) {
        const localUrls = stagedFiles.map((file) => URL.createObjectURL(file));
        setAnalysisData({
          fileNames,
          documentUrls: localUrls,
          fileTypes,
          documentIds: stagedFiles.map(() => ""),
          files: stagedFiles,
          masterDocIds: [],
        });
        return;
      }

      toast.info(t.encrypting(stagedFiles.length));

      // Step 1: Encrypt and upload all files concurrently to Firebase Storage
      const uploadPromises = await Promise.all(
        stagedFiles.map(async (file) => {
          const encryptedFile = await encryptFile(file);
          const storageRef = ref(storage, `documents/${currentUserId}/${file.name}`);
          const snapshot = await uploadBytes(storageRef, encryptedFile.encryptedBlob);
          const downloadURL = await getDownloadURL(snapshot.ref);

          return {
            fileName: file.name,
            fileUrl: downloadURL,
            fileSize: file.size,
            mimeType: file.type,
            encryptedKey: bufferToBase64(encryptedFile.key),
            iv: bufferToBase64(encryptedFile.iv),
          };
        })
      );

      const formData = new FormData();
      stagedFiles.forEach((file) => {
        formData.append("files", file);
      });

      formData.append("metadata", JSON.stringify(uploadPromises));
      formData.append("user_id",currentUserId);
      const localUrls = stagedFiles.map((file) => URL.createObjectURL(file));

      // Step 2: Save metadata to backend DB
      toast.info(t.saving);

      const res = await axios.post(`${backendUrl}/files/upload_files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const documentIds = res.data.id;
      const masterDocIds = res.data.masterDocId;
      // Step 3: Transition to AnalysisInterface
      setAnalysisData({
        fileNames,
        documentUrls: localUrls,
        fileTypes,
        documentIds,
        files: stagedFiles,
        masterDocIds,
      });

      toast.success(t.success);
    } catch (error: any) {
      console.error("Upload error:", error);
      let msg = t.failFallback;
      if (error?.response?.data)
        msg = `Backend Error: ${JSON.stringify(error.response.data)}`;
      else if (error?.code) msg = `Firebase Storage Error: ${error.message}`;
      else if (error?.message) msg = error.message;
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    if (analysisData?.documentUrls) {
      analysisData.documentUrls.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    }
    setAnalysisData(null);
    setStagedFiles([]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  // Uploading spinner
  if (isUploading) {
    return (
      <div className="w-full h-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-medium animate-pulse text-slate-900 dark:text-slate-100 mb-2">
          {t.processing}
        </h2>
      </div>
    );
  }

  // Analysis interface
  if (analysisData) {
    return (
      <AnalysisInterface
        fileNames={analysisData.fileNames}
        documentUrls={analysisData.documentUrls}
        fileTypes={analysisData.fileTypes}
        documentIds={analysisData.documentIds}
        files={analysisData.files}
        language={language}
        userId={currentUserId}
        userEmail={userEmail}
        isGuest={isGuest}
        onBack={handleBack}
        masterDocIds={analysisData.masterDocIds}
      />
    );
  }

  // ─── Upload + staging page ────────────────────────────────────────────────────
  const remainingSlots = MAX_FILES - stagedFiles.length;

  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Document uploader — only shown if slots remain */}
      {remainingSlots > 0 && (
        <div className="w-full">
          <DocumentUploader
            onFileUpload={handleFilesSelected}
            isGuest={isGuest}
          />
        </div>
      )}

      {/* Staged file list */}
      {stagedFiles.length > 0 && (
        <div className="w-full max-w-2xl mx-auto px-4 mt-6 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase">
              {t.selected} ({stagedFiles.length}/{MAX_FILES})
            </p>
            {remainingSlots === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {t.maxReached}
              </span>
            )}
          </div>

          {/* File cards */}
          {stagedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <FileIcon
                  mimeType={file.type}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400"
                />
              </div>

              {/* File name + size */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatBytes(file.size)}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Start Analyze button */}
          <button
            onClick={handleStartAnalysis}
            disabled={stagedFiles.length === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Sparkles className="w-5 h-5" />
            {t.startAnalyze}
          </button>
        </div>
      )}
    </div>
  );
}