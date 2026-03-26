import { Upload, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageToggleButton } from "../../components/LanguageToggleButton";
import { useLanguage } from "../../components/LanguageProvider";

interface DocumentUploaderProps {
  onFileUpload: (files: File[]) => void;
  isGuest?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 3;

export function DocumentUploader({ onFileUpload, isGuest = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const t = {
    en: {
        login: "Log In",
        guestLine1: "You're using TrustLens as a guest. Analysis results will not be saved to your history. ",
        guestLine2: "Log in",
        guestLine3: " to save your analyses and access all features.",
        desc: "Advanced AI-powered document analysis to detect fraudulent modifications, alterations, and potential scams in your documents",
        upTo: "Upload Up To 3 Documents",
        drag: "Drag and drop your files here, or click anywhere to browse",
        uploadBtn: "Upload Files",
        formats: "Supported formats: PDF, PNG, JPG",
        maxSize: "Maximum file size: 10MB per file",
        f1: "Metadata Analysis",
        f1d: "Extract and analyze document metadata, IP addresses, and editing history",
        f2: "Heatmap Detection",
        f2d: "Visual representation of altered areas and potential forgeries",
        f3: "Content Analysis",
        f3d: "AI-powered scanning for fraudulent clauses and suspicious content",
        errLarge: "is too large! Maximum is 10MB.",
        errType: "Invalid file type for",
        errMax: `Maximum ${MAX_FILES} files allowed. Only the first ${MAX_FILES} will be processed.`
    },
    ms: {
        login: "Log Masuk",
        guestLine1: "Anda menggunakan TrustLens sebagai tetamu. Hasil analisis tidak akan disimpan ke sejarah anda. ",
        guestLine2: "Log masuk",
        guestLine3: " untuk menyimpan analisis dan mengakses semua ciri.",
        desc: "Analisis dokumen dipacu AI termaju untuk mengesan pengubahsuaian penipuan, pindaan, dan potensi penipuan dalam dokumen anda",
        upTo: "Muat Naik Sehingga 3 Dokumen",
        drag: "Seret dan lepaskan fail anda di sini, atau klik di mana-mana untuk melayari",
        uploadBtn: "Muat Naik Fail",
        formats: "Format disokong: PDF, PNG, JPG",
        maxSize: "Saiz fail maksimum: 10MB setiap fail",
        f1: "Analisis Metadata",
        f1d: "Mengekstrak dan menganalisis metadata dokumen, alamat IP, dan sejarah penyuntingan",
        f2: "Pengesanan Peta Haba",
        f2d: "Perwakilan visual kawasan yang diubah dan potensi pemalsuan",
        f3: "Analisis Kandungan",
        f3d: "Imbasan dipacu AI untuk klausa penipuan dan kandungan yang mencurigakan",
        errLarge: "terlalu besar! Maksimum ialah 10MB.",
        errType: "Jenis fail tidak sah untuk",
        errMax: `Maksimum ${MAX_FILES} fail dibenarkan. Hanya ${MAX_FILES} pertama akan diproses.`
    }
  }[language];

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`"${file.name}" ${t.errLarge} (${mb}MB)`, { duration: 5000 });
      return false;
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(`${t.errType} "${file.name}"!`, { duration: 5000 });
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const validFiles = files.filter(validateFile);
      if (validFiles.length > MAX_FILES) {
        toast.warning(t.errMax);
        onFileUpload(validFiles.slice(0, MAX_FILES));
      } else if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const validFiles = files.filter(validateFile);
      if (validFiles.length > MAX_FILES) {
        toast.warning(t.errMax);
        onFileUpload(validFiles.slice(0, MAX_FILES));
      } else if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }
    }
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
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 w-full relative">
      
      {isGuest && (
        <div className="absolute top-5 left-5 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm px-4 py-2 rounded-xl"
            onClick={() => navigate("/login")}
          >
            <LogIn className="w-4 h-4" />
            {t.login}
          </Button>
          <LanguageToggleButton variant="default" />
        </div>
      )}

      {!isGuest && (
        <div className="absolute top-5 right-5 z-10">
          <LanguageToggleButton variant="default" />
        </div>
      )}

      {isGuest && (
        <div className="mb-6 max-w-4xl w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-blue-500 text-lg flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
            {t.guestLine1}
            <button
              onClick={() => navigate("/login")}
              className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
            >
              {t.guestLine2}
            </button>{" "}
            {t.guestLine3}
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
            {t.desc}
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
            multiple
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
          />
          <label htmlFor="file-upload" className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-2xl p-12 md:p-16 text-center transition-all duration-300 ${
              isDragging 
                ? 'border-blue-500 bg-blue-50 dark:bg-slate-800/70 scale-105' 
                : 'border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800/50'
            }`}>
              <Upload className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 transition-colors ${
                isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-slate-400'
              }`} />
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                {t.upTo}
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-slate-400 mb-6 px-4">
                {t.drag}
              </p>
              <div className="inline-block pointer-events-none">
                <Button type="button" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-base md:text-lg px-8 py-6">
                  {t.uploadBtn}
                </Button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs md:text-sm text-gray-500 dark:text-slate-500">
                  {t.formats}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-400">{t.maxSize}</span>
                </div>
              </div>
            </div>
          </label>
        </div>
      
      {/*
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t.f1}</h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">{t.f1d}</p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🗺️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t.f2}</h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">{t.f2d}</p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t.f3}</h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm">{t.f3d}</p>
          </div>
        </div> */}
      </div>
    </div>
  );
}