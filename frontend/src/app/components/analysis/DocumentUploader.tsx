/**
 * DocumentUploader.tsx
 *
 * Upload page shown before analysis begins.
 * The language selection modal has been removed — the backend automatically
 * saves analysis data in BOTH English and Bahasa Malaysia. Users switch the
 * display language at any time via the EN | BM toggle in the Sidebar or header.
 *
 * Files are handed to onFileUpload() immediately after validation passes.
 */

import { Upload, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageToggleButton } from "../../components/LanguageToggleButton";

interface DocumentUploaderProps {
  /** Called with validated files immediately — no language step */
  onFileUpload: (files: File[]) => void;
  isGuest?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 3;

export function DocumentUploader({ onFileUpload, isGuest = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  // ─── Validation ──────────────────────────────────────────────────────────────
  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`File too large! "${file.name}" is ${mb}MB. Maximum is 10MB.`, { duration: 5000 });
      return false;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error(`Invalid file type for "${file.name}"! Please upload PDF, PNG, or JPG only.`, { duration: 5000 });
      return false;
    }
    return true;
  };

  /**
   * Validate files and call onFileUpload immediately.
   * No language modal — backend stores both EN and BM automatically.
   */
  const handleFilesSelected = (files: File[]) => {
    const valid = files.filter(validateFile);
    if (valid.length === 0) return;
    const capped = valid.slice(0, MAX_FILES);
    if (valid.length > MAX_FILES) {
      toast.warning(`Maximum ${MAX_FILES} files allowed. Only the first ${MAX_FILES} will be processed.`);
    }
    onFileUpload(capped);
  };

  // ─── Event Handlers ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFilesSelected(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) handleFilesSelected(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 w-full relative">

      {/* ── Guest: Log In + Language toggle (top-left) ── */}
      {isGuest && (
        <div className="absolute top-5 left-5 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm px-4 py-2 rounded-xl"
            onClick={() => navigate("/login")}
          >
            <LogIn className="w-4 h-4" />
            Log In
          </Button>
          <LanguageToggleButton variant="default" />
        </div>
      )}

      {/* ── Authenticated: Language toggle (top-right) ── */}
      {!isGuest && (
        <div className="absolute top-5 right-5 z-10">
          <LanguageToggleButton variant="default" />
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
        {/* ── Page title ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-6">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">TrustLens</h1>
          <p className="text-xl text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
            Advanced AI-powered document analysis to detect fraudulent modifications,
            alterations, and potential scams in your documents
          </p>
        </div>

        {/* ── Drop Zone ── */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-slate-800/50" : ""}`}
        >
          <input type="file" id="file-upload" className="hidden" multiple onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
          <label htmlFor="file-upload" className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-2xl p-12 md:p-16 text-center transition-all duration-300 ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-slate-800/70 scale-105"
                : "border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800/50"
            }`}>
              <Upload className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 transition-colors ${isDragging ? "text-blue-500" : "text-gray-400 dark:text-slate-400"}`} />
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-3">Upload Up To 3 Documents</h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-slate-400 mb-6 px-4">
                Drag and drop your files here, or click anywhere to browse
              </p>
              <div className="inline-block pointer-events-none">
                <Button type="button" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-base md:text-lg px-8 py-6">
                  Upload Files
                </Button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs md:text-sm text-gray-500 dark:text-slate-500">Supported formats: PDF, PNG, JPG</p>
                <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-400">Maximum file size: 10MB per file</span>
                </div>
              </div>
            </div>
          </label>
        </div>

        {/* ── Feature cards ── */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "🔍", title: "Metadata Analysis", desc: "Extract and analyze document metadata, IP addresses, and editing history", bg: "bg-blue-100 dark:bg-blue-600/20" },
            { icon: "🗺️", title: "Heatmap Detection", desc: "Visual representation of altered areas and potential forgeries", bg: "bg-purple-100 dark:bg-purple-600/20" },
            { icon: "📄", title: "Content Analysis", desc: "AI-powered scanning for fraudulent clauses and suspicious content", bg: "bg-green-100 dark:bg-green-600/20" },
          ].map(({ icon, title, desc, bg }) => (
            <div key={title} className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
              <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                <span className="text-2xl">{icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-gray-600 dark:text-slate-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
