/**
 * AnalysisInterface.tsx
 *
 * Main analysis page shown after a document is uploaded.
 * Handles the full analysis flow:
 *   1. Calls /ai-analyze-document — language-agnostic; backend stores both EN+BM in DB.
 *   2. Calls /ai-restructure-data with the selected language to get display-ready JSON.
 *   3. Renders AnalysisProcess (loading state) or AnalysisResults (complete state).
 *   4. Language toggle button lets the user switch EN ↔ BM AFTER analysis is done.
 *      This re-calls /ai-restructure-data with the new language — the backend fetches
 *      the pre-generated version from DB (no re-analysis, fast).
 *   5. Language is also forwarded to AiAssistant so /chat receives it.
 *   6. Guest mode: skips DB saves and email notification, shows Login prompt for
 *      features that require an account (e.g. Request Review).
 */

import { useState, useEffect, useRef } from "react";
import { FileText, Loader2, AlertTriangle, LogIn, Globe } from "lucide-react";
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface AnalysisInterfaceProps {
  fileName: string;
  onBack: () => void;
  userEmail: string;
  documentUrl: string;
  fileType: string;
  documentId: string;
  file: File;
  userId: string;
  /** Initial display language chosen by the user in the language modal */
  language?: Language;
  /** When true: skips all DB/Firebase writes and email notifications */
  isGuest?: boolean;
}

// ─── Analysis pipeline stage ──────────────────────────────────────────────────
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
  language: initialLanguage = "en",
  isGuest = false,
}: AnalysisInterfaceProps) {

  // ─── State ──────────────────────────────────────────────────────────────────

  /** Current stage of the analysis pipeline */
  const [stage, setStage] = useState<AnalysisStage>("idle");

  /** Messages shown in the AI assistant panel */
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);

  /** Whether the yellow "do not close" warning banner has been dismissed */
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const [allAnalysisComplete, setAllAnalysisComplete] = useState(false);

  /** Controls visibility of the Request Review modal */
  const [requestReview, setRequestReview] = useState<boolean>(false);

  /** Reason text typed by the user in the Request Review modal */
  const [flaggedReason, setflaggedReason] = useState<string>("");

  /** Structured analysis data used to render the results UI */
  const [ai_analysis, setAi_analysis] = useState<DocumentAnalysisResult | null>(null);

  /** Header/metadata for the analysis result (doc_type, raw_analysis_id, etc.) */
  const [ai_analysis_header, setAi_analysis_header] = useState<DocumentAnalysisOverallResult | null>(null);

  /**
   * Raw response from /ai-analyze-document.
   * Stored so we can re-call /ai-restructure-data on language toggle
   * without having to re-run the full analysis.
   */
  const [rawAnalysisData, setRawAnalysisData] = useState<any>(null);

  /** Controls the Login Required modal for guest users */
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  /**
   * Active display language.
   * Initialized from the user's pre-upload modal selection.
   * Can be toggled after analysis via the EN/BM button in the header.
   */
  const [displayLanguage, setDisplayLanguage] = useState<Language>(initialLanguage);

  /** True while a language-switch re-fetch is in progress */
  const [langSwitching, setLangSwitching] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const liveConnectionRef = useRef<LiveClient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Persists a value to localStorage with a timestamp.
   * Used to cache analysis results for 24 hours so the user
   * doesn't need to re-run analysis if they refresh the page.
   */
  const setWithExpiry = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify({
      data: value,
      timestamp: new Date().getTime(),
    }));
  };

  // ─── On mount: restore 24h cache or start fresh analysis ─────────────────────
  useEffect(() => {
    const savedAnalysisRaw = localStorage.getItem("latest_analysis");
    const savedHeaderRaw = localStorage.getItem("latest_analysis_header");

    if (savedAnalysisRaw && savedHeaderRaw) {
      const analysisObj = JSON.parse(savedAnalysisRaw);
      const headerObj = JSON.parse(savedHeaderRaw);
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (now - analysisObj.timestamp < twentyFourHours) {
        // Valid cached result — restore immediately, skip re-analysis
        setAi_analysis(analysisObj.data);
        setAi_analysis_header(headerObj.data);
        setStage("complete");
        setAllAnalysisComplete(true);
        setChatMessages([{
          role: "model",
          content: "Restored recent forensic Results (Valid for 24h).",
        }]);
        return;
      } else {
        // Cache expired — clear and run fresh
        localStorage.removeItem("latest_analysis");
        localStorage.removeItem("latest_analysis_header");
      }
    }

    // Delay by 500ms to allow the UI to render first
    const timer = setTimeout(() => startAnalysis(), 500);
    return () => {
      clearTimeout(timer);
      if (liveConnectionRef.current) liveConnectionRef.current.finish();
    };
  }, []);

  // ─── Prevent accidental page close during analysis ───────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === "analyzing") {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage]);

  // ─── Auto-scroll chat input ───────────────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [chatMessages]);

  // ─── Main Analysis Pipeline ───────────────────────────────────────────────────

  /**
   * Runs the two-step analysis pipeline:
   *
   * Step 1 — /ai-analyze-document:
   *   Language is NOT sent here. Per backend team's design, this endpoint
   *   generates BOTH EN and BM versions internally and stores them in DB.
   *   doc_id and user_id are only sent for authenticated users.
   *
   * Step 2 — /ai-restructure-data:
   *   Language IS sent here. The backend returns the structured display JSON
   *   for the requested language (fetched from DB, not regenerated).
   */
  const startAnalysis = async () => {
    setStage("analyzing");
    setAllAnalysisComplete(false);
    setChatMessages([{
      role: "model",
      content: `I've received your document "${fileName}". Starting comprehensive forensic analysis...`,
    }]);

    try {
      // ── Step 1: Raw forensic analysis (language-agnostic) ──────────────────
      const analyzeFormData = new FormData();
      analyzeFormData.append("file", file);
      // user_id is always required — send "guest" for unauthenticated users
      analyzeFormData.append("user_id", isGuest ? "guest" : userId);
      // doc_id only for authenticated users; backend skips DB write if absent
      if (!isGuest) {
        analyzeFormData.append("doc_id", documentId);
      }

      const aiAnalysis = await axios.post(
        `${backendUrl}/analysis/ai-analyze-document`,
        analyzeFormData
      );

      if (aiAnalysis.status === 200) {
        // Save raw data so language toggle can re-restructure without re-analysing
        setRawAnalysisData(aiAnalysis.data);

        // ── Step 2: Restructure into language-specific display JSON ───────────
        const restructureFormData = new FormData();
        restructureFormData.append("file", file);
        restructureFormData.append("document_raw_data", JSON.stringify(aiAnalysis.data));
        // Language tells the backend which DB version to return
        restructureFormData.append("language", displayLanguage);
        // Empty string for guests — backend handles gracefully
        restructureFormData.append("documentId", isGuest ? "" : documentId);

        const res = await axios.post(
          `${backendUrl}/analysis/ai-restructure-data`,
          restructureFormData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (res.status === 200) {
          // Cache the result for 24h (works for both guest and authenticated users)
          setWithExpiry("latest_analysis", res.data.analysis_content);
          setWithExpiry("latest_analysis_header", res.data);

          setAi_analysis(res.data.analysis_content);
          setAi_analysis_header(res.data);
          setAllAnalysisComplete(true);
          setStage("complete");
          setChatMessages(prev => [
            ...prev,
            { role: "model", content: " Analysis complete! Please review the detailed results below." },
          ]);

          // Email notification only for authenticated users with a valid email
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
      // Clean up the uploaded DB record on failure (authenticated users only)
      if (!isGuest) {
        try {
          const deleteDocFormData = new FormData();
          deleteDocFormData.append("doc_id", documentId);
          const res = await axios.post(`${backendUrl}/files/delete_selected_files`, deleteDocFormData);
          if (res.data.success) console.log("Deleted uploaded document after failed analysis");
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
    }
  };

  // ─── Language Toggle ──────────────────────────────────────────────────────────

  /**
   * Switches the displayed language between EN and BM.
   *
   * Re-calls /ai-restructure-data with the new language code.
   * The backend fetches the pre-generated version from DB — no re-analysis needed.
   * The new language is also propagated to AiAssistant so /chat and
   * /get-doc-analysis receive the correct language parameter.
   */
  const handleLanguageToggle = async () => {
    const newLang: Language = displayLanguage === "en" ? "ms" : "en";

    // Raw analysis data is required to re-restructure
    if (!rawAnalysisData) {
      toast.info(
        newLang === "ms"
          ? "Sesi analisis asal diperlukan. Sila muat naik semula."
          : "Language switch requires the original analysis session. Please re-upload."
      );
      return;
    }

    setLangSwitching(true);
    try {
      const restructureFormData = new FormData();
      restructureFormData.append("file", file);
      restructureFormData.append("document_raw_data", JSON.stringify(rawAnalysisData));
      restructureFormData.append("language", newLang);
      restructureFormData.append("documentId", isGuest ? "" : documentId);

      const res = await axios.post(
        `${backendUrl}/analysis/ai-restructure-data`,
        restructureFormData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.status === 200) {
        setAi_analysis(res.data.analysis_content);
        setAi_analysis_header(res.data);
        setDisplayLanguage(newLang);
        toast.success(newLang === "ms" ? "Dipaparkan dalam Bahasa Malaysia" : "Displayed in English");
      }
    } catch (error) {
      console.error("Language switch failed:", error);
      toast.error("Failed to switch language. Please try again.");
    } finally {
      setLangSwitching(false);
    }
  };

  // ─── Review Request ───────────────────────────────────────────────────────────

  /**
   * Intercepts the review button click.
   * Guests see the Login Required modal; authenticated users see the review form.
   */
  const handleRequestReview = () => {
    if (isGuest) {
      setShowLoginPrompt(true);
    } else {
      setRequestReview(true);
    }
  };

  /** Submits the manual review request to the backend */
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

  // ─── Email Notification ───────────────────────────────────────────────────────

  /** Sends the PDF analysis report to the authenticated user's email address */
  const sendEmailNotification = async (email: string) => {
    if (!email) return;
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("file", new Blob([""], { type: "application/pdf" }), `${fileName}_Report.pdf`);
      await fetch(`${backendUrl}/email/send-report`, { method: "POST", body: formData });
    } catch (error) {
      console.error("Email failed:", error);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 w-full">

      {/* ── Warning Banner: shown while analysis is running ── */}
      {stage === "analyzing" && !hasShownWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
              <p className="text-xs sm:text-sm text-white truncate">
                <strong>
                  {displayLanguage === "ms" ? "Analisis sedang berjalan." : "Analysis in progress."}
                </strong>{" "}
                <span className="hidden sm:inline">
                  {displayLanguage === "ms" ? "Jangan tutup halaman ini." : "Do not close this page."}
                </span>
              </p>
            </div>
            <button
              onClick={() => setHasShownWarning(true)}
              className="text-white hover:text-yellow-100 text-xs sm:text-sm font-medium flex-shrink-0"
            >
              {displayLanguage === "ms" ? "Tutup" : "Dismiss"}
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Header Bar ── */}
      <div
        className={`fixed left-0 right-0 z-40 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-200 ${
          stage === "analyzing" && !hasShownWarning ? "top-10" : "top-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2">

          {/* Left: Back button + document name */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-700 dark:text-slate-300 px-2 sm:px-3 text-sm flex-shrink-0"
            >
              ← <span className="hidden sm:inline ml-1">{displayLanguage === "ms" ? "Kembali" : "Back"}</span>
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[140px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  {fileName}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                  {displayLanguage === "ms" ? "Analisis Forensik" : "Forensic Analysis"}
                  {/* Active language badge */}
                  <span className="ml-2 inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {displayLanguage === "ms" ? "🇲🇾 BM" : "🇬🇧 EN"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Right: Language toggle + guest badge + status indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Language toggle — only visible when analysis is complete */}
            {stage === "complete" && (
              <button
                onClick={handleLanguageToggle}
                disabled={langSwitching}
                title={displayLanguage === "en" ? "Switch to Bahasa Malaysia" : "Tukar ke Bahasa Inggeris"}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {langSwitching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Globe className="w-3 h-3" />
                )}
                {/* Show the TARGET language (what we're switching TO) */}
                {displayLanguage === "en" ? "BM" : "EN"}
              </button>
            )}

            {/* Guest: "Log In to Save" prompt */}
            {isGuest && (
              <button
                onClick={() => navigate("/login")}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <LogIn className="w-3 h-3" />
                {displayLanguage === "ms" ? "Log Masuk untuk Simpan" : "Log In to Save"}
              </button>
            )}

            {/* Analyzing spinner */}
            {stage === "analyzing" && (
              <span className="text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="hidden sm:inline">
                  {displayLanguage === "ms" ? "Sedang Menganalisis..." : "Analyzing..."}
                </span>
              </span>
            )}

            {/* Complete indicator */}
            {stage === "complete" && (
              <span className="text-xs text-green-600 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="hidden sm:inline">
                  {displayLanguage === "ms" ? "Selesai" : "Complete"}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div
        className={`w-full mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 transition-all duration-200 ${
          stage === "analyzing" && !hasShownWarning
            ? "pt-28 sm:pt-28 md:pt-32"
            : "pt-16 md:pt-20"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

            {/* ── Analysis Results Column (right on desktop) ── */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              {/* Show animated step-by-step progress while analyzing */}
              {stage === "analyzing" && <AnalysisProcess language={displayLanguage} />}

              {/* Show full structured results once analysis is complete */}
              {stage === "complete" && (
                <AnalysisResults
                  setRequestReview={handleRequestReview}
                  ai_analysis_format={ai_analysis!}
                  doc_type={ai_analysis_header?.doc_type!}
                  raw_analysis_id={ai_analysis_header?.raw_analysis_id!}
                  language={displayLanguage}
                />
              )}
            </div>

            {/* ── Document Viewer + AI Assistant Column (left on desktop) ── */}
            <Tabs
              className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-3"
              defaultValue="document"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {/* Document preview tab */}
                <TabsTrigger
                  value="document"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                    data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                    dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                    text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {displayLanguage === "ms" ? "Dokumen" : "Document"}
                </TabsTrigger>

                {/* AI chat assistant tab */}
                <TabsTrigger
                  value="ai-assistant"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                    data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                    dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                    text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {displayLanguage === "ms" ? "Pembantu AI" : "AI Assistant"}
                </TabsTrigger>
              </TabsList>

              {/* Renders the uploaded document (PDF/image) */}
              <TabsContent value="document">
                <DocumentViewer fileType={fileType} fileUrl={documentUrl} />
              </TabsContent>

              {/* AI chat panel — language forwarded so /chat API uses correct language */}
              <TabsContent value="ai-assistant">
                <AiAssistant
                  reqId={ai_analysis_header?.raw_analysis_id!}
                  initialMessages={chatMessages}
                  stage={stage}
                  userType="user"
                  language={displayLanguage}
                />
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </div>

      {/* ── Request Review Modal (authenticated users only) ── */}
      {requestReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRequestReview(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {displayLanguage === "ms" ? "Minta Semakan Forensik" : "Request Forensic Review"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                {displayLanguage === "ms"
                  ? "Dokumen ini akan diutamakan untuk pengesahan manual oleh pasukan forensik kami."
                  : "This document will be prioritized for manual verification by our forensic team."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="review-reason" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {displayLanguage === "ms" ? "Sebab semakan manual" : "Reason for manual review"}
              </label>
              <textarea
                id="review-reason"
                rows={4}
                placeholder={
                  displayLanguage === "ms"
                    ? "Terangkan secara ringkas mengapa dokumen ini memerlukan semakan manusia..."
                    : "Briefly describe why this document requires human oversight..."
                }
                onChange={(e) => setflaggedReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button variant="ghost" className="flex-1 border border-gray-300 dark:border-slate-600" onClick={() => setRequestReview(false)}>
                {displayLanguage === "ms" ? "Batal" : "Cancel"}
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmReview}>
                {displayLanguage === "ms" ? "Sahkan Permintaan" : "Confirm Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Login Required Modal (guests attempting a restricted action) ── */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLoginPrompt(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {displayLanguage === "ms" ? "Log Masuk Diperlukan" : "Login Required"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {displayLanguage === "ms"
                ? "Meminta semakan forensik memerlukan akaun. Log masuk atau daftar untuk mengakses ciri ini."
                : "Requesting a forensic review requires an account. Log in or sign up to access this feature."}
            </p>
            <div className="flex flex-col gap-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/login")}>
                {displayLanguage === "ms" ? "Log Masuk / Daftar" : "Log In / Sign Up"}
              </Button>
              <Button variant="ghost" className="w-full text-slate-500" onClick={() => setShowLoginPrompt(false)}>
                {displayLanguage === "ms" ? "Teruskan sebagai Tetamu" : "Continue as Guest"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
