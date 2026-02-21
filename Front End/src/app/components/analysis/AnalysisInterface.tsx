import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Mic, MicOff, AlertTriangle, Mail, Download } from "lucide-react";
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

interface AnalysisInterfaceProps {
  fileName: string;
  onBack: () => void;
  userEmail: string;
  documentUrl: string
  fileType: string
  documentId: string
  file: File
  userId: string
}

type AnalysisStage = "idle" | "analyzing" | "complete";

export function AnalysisInterface({ fileName, onBack, userEmail, documentUrl, fileType, documentId, file, userId }: AnalysisInterfaceProps) {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [allAnalysisComplete, setAllAnalysisComplete] = useState(false);
  const [requestReview, setRequestReview] = useState<boolean>(false)
  const [flaggedReason, setflaggedReason] = useState<string>('')
  const [ai_analysis, setAi_analysis] = useState<DocumentAnalysisResult | null>(null)
  const [ai_analysis_header, setAi_analysis_header] = useState<DocumentAnalysisOverallResult | null>(null)
  const [rawAnalysisData, setRawAnalysisData] = useState(null)
  // console.log("The document URL is: ",documentUrl)
  // --- REFS ---
  const liveConnectionRef = useRef<LiveClient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Ref for auto-scroll
  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const navigate = useNavigate()

  const setWithExpiry = (key: string, value: any) => {
    const item = {
      data: value,
      timestamp: new Date().getTime(), // Current time in milliseconds
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
      const twentyFourHours = 24 * 60 * 60 * 1000; // in milliseconds
      // console.log("===========Timestamp of saved analysis: ", analysisObj.timestamp, "Current time: ", now, "Difference (ms): ", now - analysisObj.timestamp, "Twenty Four Hours (ms): ", twentyFourHours, "Is data fresh? ", now - analysisObj.timestamp < twentyFourHours,"=============");
      // Check if the data is still fresh
      if (now - analysisObj.timestamp < twentyFourHours) {
        setAi_analysis(analysisObj.data);
        setAi_analysis_header(headerObj.data);
        setStage("complete");
        setAllAnalysisComplete(true);

        setChatMessages([{
          role: "assistant",
          content: "Restored recent forensic Results (Valid for 24h)."
        }]);
        return; // Exit here, don't trigger startAnalysis
      } else {
        // Data is too old, clear it
        localStorage.removeItem('latest_analysis');
        localStorage.removeItem('latest_analysis_header');
      }
    }
    console.log("Starting new analysis, no valid cached data found.");
    // If we reach here, either no data existed or it was expired
    const timer = setTimeout(() => startAnalysis(), 500);
    return () => {
      clearTimeout(timer);
      if (liveConnectionRef.current) liveConnectionRef.current.finish();
    };
  }, []);

  // Prevent accidental close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === "analyzing") { e.preventDefault(); e.returnValue = ""; return ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage]);

  // --- AUTO-SCROLL LOGIC ---
  // Whenever 'message' updates, force the input to scroll to the far right
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
      // 1. Initialize FormData correctly
      const formData = new FormData();
      formData.append('file', file)
      formData.append('doc_id', documentId)
      formData.append('user_id', userId)
      // console.log("The file is :", file)

      // 2. Initial Forensic Analysis
      const aiAnalysis = await axios.post(`${backendUrl}/analysis/ai-analyze-document`, formData);

      if (aiAnalysis.status === 200) {
        // We use a fresh FormData or append to the existing one to ensure visual grounding
        formData.append('document_raw_data', JSON.stringify(aiAnalysis.data));
        // console.log("The document Id is: ", documentId)
        formData.append('documentId', documentId);

        // Fixed: Removed double slash //
        const res = await axios.post(`${backendUrl}/analysis/ai-restructure-data`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (res.status === 200) {
          // console.log("Data from structure ai analysis: ", res.data);
          const analysisContent = res.data.analysis_content;
          const analysisHeader = res.data;

          setWithExpiry('latest_analysis', analysisContent);
          setWithExpiry('latest_analysis_header', analysisHeader);

          setRawAnalysisData(aiAnalysis.data)
          setAi_analysis(res.data.analysis_content)
          // localStorage.setItem('latest_analysis', JSON.stringify(res.data.analysis_content))
          setAi_analysis_header(res.data)
          // localStorage.setItem('latest_analysis_header', JSON.stringify(res.data))
          // 4. Success Logic - Move this INSIDE the successful result block
          setAllAnalysisComplete(true);
          // Hello World
          setStage("complete");
          setChatMessages(prev => [
            ...prev,
            { role: "model", content: " Analysis complete! Please review the detailed results below." }
          ]);

          sendEmailNotification(userEmail);
          toast.success("Analysis complete! Notification email sent.");

          // Optionally store res.data in your state here
          // setFinalAnalysis(res.data); 
        }
      } else {
        toast.error("Failed to generate analysis")
        throw new Error("Initial analysis failed");
      }

    } catch (error) {
      try {
        // Delete the document from the db if the analysis fail
        const deleteDocFormData = new FormData()
        deleteDocFormData.append('doc_id', documentId)
        const res = await axios.post(`${backendUrl}/files/delete_selected_files`, deleteDocFormData)
        const result = res.data

        if (result.success) {
          console.log("Delete uploaded document")
        } else {
          console.log("Failed to delete document")
        }
      } catch (deleteError) {
        console.error("Failed to delete document:", deleteError);
      }
      console.error(error);
      setStage("idle"); // Set a proper error stage
      toast.error("Analysis Failed. Please try again later");
      navigate("/dashboard")
      return
    }
  };

  const handleConfirmReview = async () => {
    try {
      const res = await setFileAsFlagged(documentId, flaggedReason)

      if (res.success) {
        toast.success("Successfully request for review")
        setRequestReview(false)
      } else {
        toast.error("Failed to request for review. Please try again later")
      }
    } catch (error) {
      console.log("Error request for a review: ", error)
    }
  }

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

      {/* Header — shifts down when warning banner is visible */}
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
                </p>
              </div>
            </div>
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Main Content — top padding accounts for banner + header */}
      <div
        className={`w-full mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 transition-all duration-200 ${stage === "analyzing" && !hasShownWarning
            ? "pt-28 sm:pt-28 md:pt-32"
            : "pt-16 md:pt-20"
          }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* On mobile: analysis first, then document/chat tabs below */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

            {/* Analysis Column — top on mobile, right on desktop */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              {stage === "analyzing" && <AnalysisProcess />}
              {stage === "complete" && (
                <AnalysisResults
                  setRequestReview={setRequestReview}
                  ai_analysis_format={ai_analysis!}
                  doc_type={ai_analysis_header?.doc_type!}
                  raw_analysis_id={ai_analysis_header?.raw_analysis_id!}
                />
              )}
            </div>

            {/* Document / AI Chat Column — bottom on mobile, left on desktop */}
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
                <AiAssistant reqId={ai_analysis_header?.raw_analysis_id!} initialMessages={chatMessages} stage={stage} userType="user" />
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </div>

      {/* Request Review Modal */}
      {requestReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRequestReview(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Request Forensic Review
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                This document will be prioritized for manual verification by our forensic team.
              </p>
            </div>

            {/* Textarea */}
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

            {/* Actions */}
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

    </div>
  );
}