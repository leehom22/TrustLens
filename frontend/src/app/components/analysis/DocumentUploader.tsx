import { Upload, AlertTriangle, Globe, LogIn } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Language } from "../../App";

interface DocumentUploaderProps {
  onFileUpload: (file: File, language: Language) => void;
  isGuest?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Language Selection Modal ─────────────────────────────────────────────────
interface LanguageModalProps {
  fileName: string;
  onConfirm: (language: Language) => void;
  onCancel: () => void;
}

function LanguageModal({ fileName, onConfirm, onCancel }: LanguageModalProps) {
  const [selected, setSelected] = useState<Language>("en");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Select Analysis Language
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
              {fileName}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 mt-3 leading-relaxed">
          Choose the language for your document analysis report. All findings, summaries, and risk assessments will be presented in the selected language.
        </p>

        {/* Language options */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* English */}
          <button
            onClick={() => setSelected("en")}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === "en"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-600/10 shadow-md shadow-blue-500/10"
                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 bg-white dark:bg-slate-800/50"
            }`}
          >
            <span className="text-3xl">ENG</span>
            <div className="text-center">
              <p className={`font-semibold text-sm ${selected === "en" ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                English
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">English</p>
            </div>
            {selected === "en" && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Bahasa Malaysia */}
          <button
            onClick={() => setSelected("ms")}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === "ms"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-600/10 shadow-md shadow-blue-500/10"
                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 bg-white dark:bg-slate-800/50"
            }`}
          >
            <span className="text-3xl">BM</span>
            <div className="text-center">
              <p className={`font-semibold text-sm ${selected === "ms" ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                Bahasa Malaysia
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Malay</p>
            </div>
            {selected === "ms" && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 border border-gray-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25"
            onClick={() => onConfirm(selected)}
          >
            Proceed with Upload
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main DocumentUploader ────────────────────────────────────────────────────
export function DocumentUploader({ onFileUpload, isGuest = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(
        `File too large! "${file.name}" is ${fileSizeMB}MB. Maximum file size is 10MB.`,
        { duration: 5000 }
      );
      return false;
    }

    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error(
        `Invalid file type! Please upload PDF, PNG, or JPG files only.`,
        { duration: 5000 }
      );
      return false;
    }

    return true;
  };

  // Show language modal after validation
  const handleFileSelected = (file: File) => {
    if (validateFile(file)) {
      setPendingFile(file);
    }
  };

  const handleLanguageConfirm = (language: Language) => {
    if (pendingFile) {
      onFileUpload(pendingFile, language);
      setPendingFile(null);
    }
  };

  const handleLanguageCancel = () => {
    setPendingFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 w-full relative">

      {/* ── Guest: Login button top-left ── */}
      {isGuest && (
        <div className="absolute top-5 left-5 z-10">
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm px-4 py-2 rounded-xl"
            onClick={() => navigate("/login")}
          >
            <LogIn className="w-4 h-4" />
            Log In
          </Button>
        </div>
      )}

      {/* ── Guest info banner ── */}
      {isGuest && (
        <div className="mb-6 max-w-4xl w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-blue-500 text-lg flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
            You're using TrustLens as a guest. Analysis results will not be saved to your history.{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
            >
              Log in
            </button>{" "}
            to save your analyses and access all features.
          </p>
        </div>
      )}

      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-6">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            TrustLens
          </h1>
          <p className="text-xl text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
            Advanced AI-powered document analysis to detect fraudulent modifications,
            alterations, and potential scams in your documents
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-slate-800/50' : ''}`}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
          />
          <label htmlFor="file-upload" className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-2xl p-12 md:p-16 text-center transition-all duration-300 ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-slate-800/70 scale-105'
                : 'border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800/50'
              }`}>
              <Upload className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-slate-400'
                }`} />
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                Upload Your Document
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-slate-400 mb-6 px-4">
                Drag and drop your file here, or click anywhere to browse
              </p>
              <div className="inline-block pointer-events-none">
                <Button
                  type="button"
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-base md:text-lg px-8 py-6"
                >
                  Upload File
                </Button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs md:text-sm text-gray-500 dark:text-slate-500">
                  Supported formats: PDF, PNG, JPG
                </p>
                <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Maximum file size: 10MB
                  </span>
                </div>
              </div>
            </div>
          </label>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Metadata Analysis
            </h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">
              Extract and analyze document metadata, IP addresses, and editing history
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🗺️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Heatmap Detection
            </h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">
              Visual representation of altered areas and potential forgeries
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Content Analysis
            </h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">
              AI-powered scanning for fraudulent clauses and suspicious content
            </p>
          </div>
        </div>
      </div>

      {/* Language Selection Modal */}
      {pendingFile && (
        <LanguageModal
          fileName={pendingFile.name}
          onConfirm={handleLanguageConfirm}
          onCancel={handleLanguageCancel}
        />
      )}
    </div>
  );
}
