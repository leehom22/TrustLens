import { Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

interface DocumentUploaderProps {
  onFileUpload: (file: File) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export function DocumentUploader({ onFileUpload }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateAndUploadFile = (file: File) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(
        `File too large! "${file.name}" is ${fileSizeMB}MB. Maximum file size is 10MB.`,
        { duration: 5000 }
      );
      return;
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error(
        `Invalid file type! Please upload PDF, DOC, DOCX, PNG, or JPG files only.`,
        { duration: 5000 }
      );
      return;
    }

    // File is valid
    toast.success(`File "${file.name}" uploaded successfully!`);
    onFileUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndUploadFile(file);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
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
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
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
                  Supported formats: PDF, DOC, DOCX, PNG, JPG
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
    </div>
  );
}