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
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
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
  // Auto-start analysis
  useEffect(() => {
    const timer = setTimeout(() => startAnalysis(), 500);
    return () => { clearTimeout(timer); if (liveConnectionRef.current) liveConnectionRef.current.finish(); };
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
      role: "assistant",
      content: `I've received your document "${fileName}". Starting comprehensive forensic analysis...`
    }]);

    try {
      // 1. Initialize FormData correctly
      const formData = new FormData(); 
      formData.append('file',file)
      formData.append('doc_id',documentId)
      formData.append('user_id',userId)
      console.log("The file is :",file)

      // 2. Initial Forensic Analysis
      const aiAnalysis = await axios.post(`${backendUrl}/analysis/ai-analyze-document`, formData);

      if (aiAnalysis.status === 200) {
        console.log("Rawdata: ", aiAnalysis);
        console.log("Rawdata: ", aiAnalysis.data);

        // 3. Prepare for Restructuring (Multi-modal)
        // We use a fresh FormData or append to the existing one to ensure visual grounding
        formData.append('document_raw_data', JSON.stringify(aiAnalysis.data));
        console.log("The document Id is: ",documentId)
        formData.append('documentId', documentId);

        // Fixed: Removed double slash //
        const res = await axios.post(`${backendUrl}/analysis/ai-restructure-data`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (res.status === 200) {
          console.log("Data from structure ai analysis: ", res.data);
          setRawAnalysisData(aiAnalysis.data)
          setAi_analysis(res.data.analysis_content)
          setAi_analysis_header(res.data)
          // 4. Success Logic - Move this INSIDE the successful result block
          setAllAnalysisComplete(true);
          setStage("complete");
          setChatMessages(prev => [
            ...prev,
            { role: "assistant", content: " Analysis complete! Please review the detailed results below." }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 w-385">
      {/* Warning Banner */}
      {stage === "analyzing" && !hasShownWarning && (
        <div className="fixed top-23 left-0 right-0 z-40 bg-yellow-500 dark:bg-yellow-600 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-white" />
              <p className="text-sm text-white">
                <strong>Analysis in progress.</strong> Do not close this page.
              </p>
            </div>
            <button onClick={() => setHasShownWarning(true)} className="text-white hover:text-yellow-100 text-sm font-medium">Dismiss</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={` border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed left-0 right-0 ${stage === "analyzing" && !hasShownWarning ? "top-3" : "top-3"} z-10`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <Button variant="ghost" onClick={onBack} className="text-gray-700 dark:text-slate-300">← Back</Button>
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base truncate">{fileName}</h2>
                <p className="text-xs text-gray-600 dark:text-slate-400 hidden sm:block">Forensic Analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stage === "analyzing" && (
              <span className="text-xs md:text-sm text-gray-700 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin text-blue-600" /> Analyzing...</span>
            )}
            {stage === "complete" && (
              <span className="text-xs md:text-sm text-green-600 flex items-center gap-1"><span className="w-2 h-2 bg-green-600 rounded-full"></span> Complete</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full mx-auto px-4 md:px-6 py-6 md:py-8 pt-24 md:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {/* Chat Column */}
          <Tabs className="lg:col-span-5 order-2 lg:order-1 gap-4" defaultValue="document">
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
            <TabsContent value="ai-assistant" >
              <AiAssistant messages={chatMessages} stage={stage} />
            </TabsContent>
          </Tabs>

          {/* Analysis Column */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            {stage === "analyzing" && <AnalysisProcess />}
            {stage === "complete" && <AnalysisResults setRequestReview={setRequestReview} ai_analysis_format={ai_analysis!} doc_type={ai_analysis_header?.doc_type!} raw_analysis_id={ai_analysis_header?.raw_analysis_id!}/>}
          </div>
        </div>
      </div>
      {
        requestReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setRequestReview(false)}
            />

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
              {/* Header Section */}
              <div className="flex items-start gap-4 mb-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Request Forensic Review</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    This document will be prioritized for manual verification by our forensic team.
                  </p>
                </div>
              </div>

              {/* Form Section */}
              <div className="flex flex-col gap-3">
                <label
                  htmlFor="review-reason"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1"
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
              <div className="flex gap-3 mt-8">
                <Button
                  variant="ghost"
                  className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-gray-500"
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
        )
      }
    </div>
  );
}