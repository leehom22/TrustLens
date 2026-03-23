import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Mic, MicOff, AlertTriangle, Mail, Download, LogIn } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AnalysisProcess } from "./AnalysisProcess";
import { AnalysisResults } from "./AnalysisResults";
import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import DocumentViewer from "./DocumentViewer";
import AiAssistant from "./AiAssistant";
import { setFileAsFlagged } from "@/api/document";
import { toast } from "react-toastify";
import axios from "axios";
import { DocumentAnalysisOverallResult, DocumentAnalysisResult } from "@/app/types/db-ai-analysis-type";
import { useNavigate } from "react-router-dom";
import type { Language } from "../../App";

interface AnalysisInterfaceProps {
  fileName: string;
  onBack: () => void;
  userEmail: string;
  documentUrl: string;
  fileType: string;
  documentId: string;
  file: File;
  userId: string;
  /** Language for the analysis output ("en" = English, "ms" = Bahasa Malaysia) */
  language?: Language;
  /** When true: skip all DB/Firebase calls, hide history-only features */
  isGuest?: boolean;
}

type AnalysisStage = "idle" | "analyzing" | "complete";

export function AnalysisInterface({
  fileName,
  onBack,
  userEmail,
  documentUrl,
  fileType,
  documentId,
  file,
  userId,
  language = "en",
  isGuest = false,
}: AnalysisInterfaceProps) {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [allAnalysisComplete, setAllAnalysisComplete] = useState(false);
  const [requestReview, setRequestReview] = useState<boolean>(false);
  const [flaggedReason, setflaggedReason] = useState<string>('');
  const [ai_analysis, setAi_analysis] = useState<DocumentAnalysisResult | null>(null);
  const [ai_analysis_header, setAi_analysis_header] = useState<DocumentAnalysisOverallResult | null>(null);
  const [rawAnalysisData, setRawAnalysisData] = useState(null);
  // Login-required modal for guests trying to request review
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const liveConnectionRef = useRef<LiveClient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  const setWithExpiry = (key: string, value: any) => {
    const item = {
      data: value,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem(key, JSON.stringify(item));
  };

  useEffect(() => {
    const savedAnalysisRaw = localStorage.getItem('latest_analysis');
    const savedHeaderRaw = localStorage.getItem('latest_analysis_header');

    if (savedAnalysisRaw && savedHeaderRaw) {
      const analysisObj = JSON.parse(savedAnalysisRaw);
      const headerObj = JSON.parse(savedHeaderRaw);
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (now - analysisObj.timestamp < twentyFourHours) {
        setAi_analysis(analysisObj.data);
        setAi_analysis_header(headerObj.data);
        setStage("complete");
        setAllAnalysisComplete(true);
        setChatMessages([{
          role: "model",
          content: "Restored recent forensic Results (Valid for 24h)."
        }]);
        return;
      } else {
        localStorage.removeItem('latest_analysis');
        localStorage.removeItem('latest_analysis_header');
      }
    }

    const timer = setTimeout(() => startAnalysis(), 500);
    return () => {
      clearTimeout(timer);
      if (liveConnectionRef.current) liveConnectionRef.current.finish();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === "analyzing") { e.preventDefault(); e.returnValue = ""; return ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [chatMessages]);

  const startAnalysis = async () => {
    setStage("analyzing");
    setAllAnalysisComplete(false);
    setChatMessages([{
      role: "model",
      content: `I've received your document "${fileName}". Starting comprehensive forensic analysis...`
    }]);

    try {
      const formData = new FormData();
      // Backend expects file as a List[UploadFile] — always append as 'file'
      formData.append('file', file);
      // Pass language to backend so it can tailor output language
      formData.append('language', language);
      // user_id is always required by backend — use "guest" for unauthenticated users
      formData.append('user_id', isGuest ? 'guest' : userId);
      // doc_id is a list field — send empty string for guests (backend pads it automatically)
      if (!isGuest) {
        formData.append('doc_id', documentId);
      }

      const aiAnalysis = await axios.post(`${backendUrl}/analysis/ai-analyze-document`, formData);

      if (aiAnalysis.status === 200) {
        formData.append('document_raw_data', JSON.stringify(aiAnalysis.data));
        // documentId is required by backend — send empty string for guests
        formData.append('documentId', isGuest ? '' : documentId);

        const res = await axios.post(`${backendUrl}/analysis/ai-restructure-data`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.status === 200) {
          const analysisContent = res.data.analysis_content;
          const analysisHeader = res.data;

          // Cache result locally (works for both guest and auth users)
          setWithExpiry('latest_analysis', analysisContent);
          setWithExpiry('latest_analysis_header', analysisHeader);

          setRawAnalysisData(aiAnalysis.data);
          setAi_analysis(res.data.analysis_content);
          setAi_analysis_header(res.data);
          setAllAnalysisComplete(true);
          setStage("complete");
          setChatMessages(prev => [
            ...prev,
            { role: "model", content: " Analysis complete! Please review the detailed results below." }
          ]);

          // Only send email notification for authenticated users
          if (!isGuest && userEmail) {
            sendEmailNotification(userEmail);
            toast.success("Analysis complete! Notification email sent.");
          } else {
            toast.success("Analysis complete!");
          }
        }
      } else {
        toast.error("Failed to generate analysis");
        throw new Error("Initial analysis failed");
      }

    } catch (error) {
      // Only attempt DB cleanup for authenticated users
      if (!isGuest) {
        try {
          const deleteDocFormData = new FormData();
          deleteDocFormData.append('doc_id', documentId);
          const res = await axios.post(`${backendUrl}/files/delete_selected_files`, deleteDocFormData);
          if (res.data.success) {
            console.log("Deleted uploaded document after failed analysis");
          }
        } catch (deleteError) {
          console.error("Failed to delete document:", deleteError);
        }
      }

      console.error(error);
      setStage("idle");
      toast.error("Analysis Failed. Please try again later");

      if (!isGuest) {
        navigate("/dashboard");
      } else {
        onBack();
      }
      return;
    }
  };

  // Intercept review request for guests
  const handleRequestReview = () => {
    if (isGuest) {
      setShowLoginPrompt(true);
    } else {
      setRequestReview(true);
    }
  };

  const handleConfirmReview = async () => {
    try {
      const res = await setFileAsFlagged(documentId, flaggedReason);
      if (res.success) {
        toast.success("Successfully request for review");
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
      const formData = new FormData();
      formData.append("email", email);
      formData.append("file", new Blob([""], { type: 'application/pdf' }), `${fileName}_Report.pdf`);
      await fetch(`${backendUrl}/email/send-report`, { method: "POST", body: formData });
    } catch (error) { console.error('Email failed:', error); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 w-full">

      {/* Warning Banner */}
      {stage === "analyzing" && !hasShownWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
              <p className="text-xs sm:text-sm text-white truncate">
                <strong>Analysis in progress.</strong>{" "}
                <span className="hidden sm:inline">Do not close this page.</span>
              </p>
            </div>
            <button
              onClick={() => setHasShownWarning(true)}
              className="text-white hover:text-yellow-100 text-xs sm:text-sm font-medium flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className={`fixed left-0 right-0 z-40 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-200 ${stage === "analyzing" && !hasShownWarning ? "top-10" : "top-0"
          }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2">
          {/* Left: back + file info */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-700 dark:text-slate-300 px-2 sm:px-3 text-sm flex-shrink-0"
            >
              ← <span className="hidden sm:inline ml-1">Back</span>
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[140px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  {fileName}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                  Forensic Analysis
                  {language === "ms" && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      🇲🇾 BM
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right: guest badge + status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isGuest && (
              <button
                onClick={() => navigate("/login")}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <LogIn className="w-3 h-3" />
                Log In to Save
              </button>
            )}
            {stage === "analyzing" && (
              <span className="text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="hidden sm:inline">Analyzing...</span>
              </span>
            )}
            {stage === "complete" && (
              <span className="text-xs text-green-600 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="hidden sm:inline">Complete</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`w-full mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 transition-all duration-200 ${stage === "analyzing" && !hasShownWarning
            ? "pt-28 sm:pt-28 md:pt-32"
            : "pt-16 md:pt-20"
          }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

            {/* Analysis Column */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              {stage === "analyzing" && <AnalysisProcess language={language} />}
              {stage === "complete" && (
                <AnalysisResults
                  setRequestReview={handleRequestReview}
                  ai_analysis_format={ai_analysis!}
                  doc_type={ai_analysis_header?.doc_type!}
                  raw_analysis_id={ai_analysis_header?.raw_analysis_id!}
                  language={language}
                />
              )}
            </div>

            {/* Document / AI Chat Column */}
            <Tabs
              className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-3"
              defaultValue="document"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <TabsTrigger
                  value="document"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Document
                </TabsTrigger>
                <TabsTrigger
                  value="ai-assistant"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  AI Assistant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="document">
                <DocumentViewer fileType={fileType} fileUrl={documentUrl} />
              </TabsContent>
              <TabsContent value="ai-assistant">
                <AiAssistant
                  reqId={ai_analysis_header?.raw_analysis_id!}
                  initialMessages={chatMessages}
                  stage={stage}
                  userType="user"
                />
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </div>

      {/* ── Request Review Modal (authenticated users only) ── */}
      {requestReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRequestReview(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Request Forensic Review
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                This document will be prioritized for manual verification by our forensic team.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="review-reason"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Reason for manual review
              </label>
              <textarea
                id="review-reason"
                rows={4}
                placeholder="Briefly describe why this document requires human oversight..."
                onChange={(e) => setflaggedReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                variant="ghost"
                className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-600"
                onClick={() => setRequestReview(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
                onClick={handleConfirmReview}
              >
                Confirm Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Login Required Modal (guest users trying to request review) ── */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowLoginPrompt(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Login Required
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Requesting a forensic review requires an account. Log in or sign up to access this feature and save your analysis history.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => navigate("/login")}
              >
                Log In / Sign Up
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400"
                onClick={() => setShowLoginPrompt(false)}
              >
                Continue as Guest
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
