import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, LogIn, Layers } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AnalysisProcess } from "./AnalysisProcess";
import { AnalysisResults } from "./AnalysisResults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import DocumentViewer from "./DocumentViewer";
import AiAssistant from "./AiAssistant";
import { setFileAsFlagged } from "@/api/document";
import { toast } from "react-toastify";
import axios from "axios";
import { DocumentAnalysisOverallResult, DocumentAnalysisResult } from "@/app/types/db-ai-analysis-type";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../LanguageProvider";
import type { Language } from "../../App";

// ─── Props ────────────────────────────────────────────────────────────────────
interface AnalysisInterfaceProps {
  fileNames: string[];
  documentUrls: string[];
  fileTypes: string[];
  documentIds: string[];
  files: File[];
  onBack: () => void;
  userEmail: string;
  userId: string;
  language?: Language;
  isGuest?: boolean;
}

type AnalysisStage = "idle" | "analyzing" | "complete" | "error";

export function AnalysisInterface({
  fileNames,
  onBack,
  userEmail,
  documentUrls,
  fileTypes,
  documentIds,
  files,
  userId,
  language: initialLanguage = "en",
  isGuest = false,
}: AnalysisInterfaceProps) {

  // ─── State ──────────────────────────────────────────────────────────────────
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [stages, setStages] = useState<AnalysisStage[]>(files.map(() => "idle"));
  
  const [aiAnalysisList, setAiAnalysisList] = useState<(DocumentAnalysisResult | null)[]>(files.map(() => null));
  const [aiAnalysisHeaders, setAiAnalysisHeaders] = useState<(DocumentAnalysisOverallResult | null)[]>(files.map(() => null));
  const [rawAnalysisDataList, setRawAnalysisDataList] = useState<any[]>(files.map(() => null));

  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [requestReview, setRequestReview] = useState<boolean>(false);
  const [flaggedReason, setflaggedReason] = useState<string>("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { language } = useLanguage();
  const [langSwitching, setLangSwitching] = useState(false);
  // Guards against the language useEffect firing on initial mount.
  // The effect should only trigger when the user actively presses the EN|BM toggle.
  const hasMountedRef = useRef(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  // Active state proxies
  const activeStage = stages[activeFileIndex];
  const activeFileName = fileNames[activeFileIndex];
  const activeAnalysis = aiAnalysisList[activeFileIndex];
  const activeHeader = aiAnalysisHeaders[activeFileIndex];
  const activeDocId = documentIds[activeFileIndex];

  // ─── Prevent accidental page close during analysis ───────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stages.includes("analyzing")) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stages]);

  // ─── Main Analysis Pipeline ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => startBatchAnalysis(), 500);
    return () => clearTimeout(timer);
  }, []);

  const startBatchAnalysis = async () => {
    setStages(files.map(() => "analyzing"));
    
    try {
      const analyzeFormData = new FormData();
      files.forEach(f => analyzeFormData.append("file", f));
      analyzeFormData.append("user_id", isGuest ? "guest" : userId);
      
      if (!isGuest) {
        documentIds.forEach(id => analyzeFormData.append("doc_id", id));
      }

      const aiAnalysis = await axios.post(`${backendUrl}/analysis/ai-analyze-document`, analyzeFormData);

      if (aiAnalysis.status === 200 && aiAnalysis.data.results) {
        const batchResults = aiAnalysis.data.results; 
        setRawAnalysisDataList(batchResults.map((r: any) => r.status === 'success' ? r.data : null));

        const restructurePromises = batchResults.map(async (result: any, idx: number) => {
            if (result.status === 'success') {
                const restructureFormData = new FormData();
                restructureFormData.append("file", files[idx]);
                restructureFormData.append("document_raw_data", JSON.stringify(result.data));
                restructureFormData.append("language", language);
                restructureFormData.append("documentId", isGuest ? "" : documentIds[idx]);

                const res = await axios.post(`${backendUrl}/analysis/ai-restructure-data`, restructureFormData, { 
                    headers: { "Content-Type": "multipart/form-data" } 
                });
                return res.data;
            }
            return null;
        });

        const restructuredData = await Promise.all(restructurePromises);
        
        setAiAnalysisList(restructuredData.map(r => r ? r.analysis_content : null));
        setAiAnalysisHeaders(restructuredData.map(r => r ? r : null));
        
        setStages(batchResults.map((r: any) => r.status === 'success' ? "complete" : "error"));

        if (!isGuest && userEmail) {
            sendEmailNotification(userEmail);
        }
      }
    } catch (error) {
      console.error(error);
      setStages(files.map(() => "error"));
      toast.error("Batch Analysis Failed. Please try again later");
    }
  };

  // ─── Re-restructure ALL files when global language changes ─────────────────
  useEffect(() => {
    // Skip on the very first render — initial analysis already uses the correct language.
    // Only re-fetch when the user actively toggles EN | BM.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (stages.every(s => s !== "complete")) return;

    const refetchForLanguage = async () => {
      setLangSwitching(true);
      try {
        const promises = rawAnalysisDataList.map(async (rawData, idx) => {
            if (!rawData) return null;
            const restructureFormData = new FormData();
            restructureFormData.append("file", files[idx]);
            restructureFormData.append("document_raw_data", JSON.stringify(rawData));
            restructureFormData.append("language", language);
            restructureFormData.append("documentId", isGuest ? "" : documentIds[idx]);

            const res = await axios.post(`${backendUrl}/analysis/ai-restructure-data`, restructureFormData, { 
                headers: { "Content-Type": "multipart/form-data" } 
            });
            return res.data;
        });

        const retranslated = await Promise.all(promises);
        setAiAnalysisList(retranslated.map(r => r ? r.analysis_content : null));
        setAiAnalysisHeaders(retranslated.map(r => r ? r : null));
        toast.success(language === "ms" ? "Dipaparkan dalam Bahasa Malaysia" : "Displayed in English");
      } catch (error) {
        toast.error("Failed to switch language. Please try again.");
      } finally {
        setLangSwitching(false);
      }
    };
    refetchForLanguage();
  }, [language]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleRequestReview = () => {
    if (isGuest) setShowLoginPrompt(true);
    else setRequestReview(true);
  };

  const handleConfirmReview = async () => {
    if (!activeDocId) return;
    try {
      const res = await setFileAsFlagged(activeDocId, flaggedReason);
      if (res.success) {
        toast.success("Successfully requested for review");
        setRequestReview(false);
      } else {
        toast.error("Failed to request for review. Please try again later");
      }
    } catch (error) {
      console.log("Error request for a review: ", error);
    }
  };

  const sendEmailNotification = async (email: string) => {
    if (!email) return;
    try {
      // Loop through and send notifications for all completed files
      fileNames.forEach(async (name, idx) => {
          if(stages[idx] === 'complete') {
            const formData = new FormData();
            formData.append("email", email);
            formData.append("file", new Blob([""], { type: "application/pdf" }), `${name}_Report.pdf`);
            await fetch(`${backendUrl}/email/send-report`, { method: "POST", body: formData });
          }
      });
    } catch (error) {
      console.error("Email failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 w-full pb-10">

      {/* ── Warning Banner ── */}
      {stages.includes("analyzing") && !hasShownWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
              <p className="text-xs sm:text-sm text-white truncate">
                <strong>{language === "ms" ? "Analisis sedang berjalan." : "Analysis in progress."}</strong>{" "}
                <span className="hidden sm:inline">{language === "ms" ? "Jangan tutup halaman ini." : "Do not close this page."}</span>
              </p>
            </div>
            <button onClick={() => setHasShownWarning(true)} className="text-white hover:text-yellow-100 text-xs sm:text-sm font-medium">
              {language === "ms" ? "Tutup" : "Dismiss"}
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Header Bar ── */}
      <div className={`fixed left-0 right-0 z-40 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-200 ${stages.includes("analyzing") && !hasShownWarning ? "top-10" : "top-0"}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2">

          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <Button variant="ghost" onClick={onBack} className="text-gray-700 dark:text-slate-300 px-2 sm:px-3 text-sm flex-shrink-0">
              ← <span className="hidden sm:inline ml-1">{language === "ms" ? "Kembali" : "Back"}</span>
            </Button>
            
            {/* Desktop File Switcher Tabs */}
            {files.length > 1 && (
                <div className="hidden md:flex gap-1 ml-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    {fileNames.map((name, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setActiveFileIndex(idx)}
                            className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${activeFileIndex === idx ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span className="max-w-[140px] truncate">{name}</span>
                            {stages[idx] === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin text-blue-600"/>}
                            {stages[idx] === 'complete' && <div className="w-2 h-2 bg-green-500 rounded-full"/>}
                            {stages[idx] === 'error' && <div className="w-2 h-2 bg-red-500 rounded-full"/>}
                        </button>
                    ))}
                </div>
            )}
            
            {/* Single File fallback title */}
            {files.length === 1 && (
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className="min-w-0">
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[140px] sm:max-w-xs">{activeFileName}</h2>
                    </div>
                </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Spinner shown while language switch re-fetch is in progress */}
            {langSwitching && (
              <span className="flex items-center gap-1 text-xs text-slate-500 px-2 py-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
            {isGuest && (
              <button onClick={() => navigate("/login")} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <LogIn className="w-3 h-3" />
                {language === "ms" ? "Log Masuk untuk Simpan" : "Log In to Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className={`w-full mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 transition-all duration-200 ${stages.includes("analyzing") && !hasShownWarning ? "pt-28 sm:pt-28 md:pt-32" : "pt-16 md:pt-20"}`}>
        <div className="max-w-7xl mx-auto">
          
          {/* Mobile File Switcher */}
          {files.length > 1 && (
            <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar">
                 {fileNames.map((name, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => setActiveFileIndex(idx)}
                        className={`flex-shrink-0 px-4 py-2 text-sm rounded-lg border font-medium flex items-center gap-2 ${activeFileIndex === idx ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                    >
                        {name}
                        {stages[idx] === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin text-blue-600"/>}
                        {stages[idx] === 'complete' && <div className="w-2 h-2 bg-green-500 rounded-full"/>}
                    </button>
                ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            
            {/* ── Analysis Results Column ── */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              {activeStage === "analyzing" && <AnalysisProcess language={language} />}
              
              {activeStage === "error" && (
                  <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 dark:bg-red-900/20 dark:border-red-800 flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6"/>
                      <div>
                          <h3 className="font-bold">Analysis Failed</h3>
                          <p className="text-sm">There was an error processing this specific document. Please try again later.</p>
                      </div>
                  </div>
              )}

              {activeStage === "complete" && activeAnalysis && activeHeader && (
                <AnalysisResults
                  setRequestReview={handleRequestReview}
                  ai_analysis_format={activeAnalysis}
                  doc_type={activeHeader.doc_type}
                  raw_analysis_id={activeHeader.raw_analysis_id}
                  language={language}
                />
              )}
            </div>

            {/* ── Document Viewer + AI Assistant Column ── */}
            <Tabs className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-3" defaultValue="document">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <TabsTrigger value="document" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 shadow-sm">
                  {language === "ms" ? "Dokumen" : "Document"}
                </TabsTrigger>
                <TabsTrigger value="ai-assistant" className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 shadow-sm">
                  {language === "ms" ? "Pembantu AI" : "AI Assistant"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="document">
                <DocumentViewer fileType={fileTypes[activeFileIndex]} fileUrl={documentUrls[activeFileIndex]} />
              </TabsContent>

              <TabsContent value="ai-assistant">
                {/* Reset component completely when active doc changes by passing key */}
                <AiAssistant
                  key={activeHeader?.raw_analysis_id || `assistant-${activeFileIndex}`}
                  reqId={activeHeader?.raw_analysis_id || ''}
                  stage={activeStage}
                  userType="user"
                />
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </div>

      {/* ── Request Review Modal ── */}
      {requestReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRequestReview(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {language === "ms" ? "Minta Semakan Forensik" : "Request Forensic Review"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                {language === "ms" ? "Dokumen ini akan diutamakan untuk pengesahan manual." : "This document will be prioritized for manual verification by our forensic team."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="review-reason" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {language === "ms" ? "Sebab semakan manual" : "Reason for manual review"}
              </label>
              <textarea
                id="review-reason"
                rows={4}
                onChange={(e) => setflaggedReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button variant="ghost" className="flex-1 border border-gray-300 dark:border-slate-600" onClick={() => setRequestReview(false)}>
                {language === "ms" ? "Batal" : "Cancel"}
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmReview}>
                {language === "ms" ? "Sahkan Permintaan" : "Confirm Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Login Required Modal ── */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLoginPrompt(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {language === "ms" ? "Log Masuk Diperlukan" : "Login Required"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {language === "ms" ? "Meminta semakan forensik memerlukan akaun. Log masuk atau daftar untuk mengakses ciri ini." : "Requesting a forensic review requires an account. Log in or sign up to access this feature."}
            </p>
            <div className="flex flex-col gap-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/login")}>
                {language === "ms" ? "Log Masuk / Daftar" : "Log In / Sign Up"}
              </Button>
              <Button variant="ghost" className="w-full text-slate-500" onClick={() => setShowLoginPrompt(false)}>
                {language === "ms" ? "Teruskan sebagai Tetamu" : "Continue as Guest"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}