import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Mic, MicOff, AlertTriangle, Mail, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { AnalysisProcess } from "./AnalysisProcess";
import { AnalysisResults } from "./AnalysisResults";
import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import DocumentViewer from "./DocumentViewer";
import AiAssistant from "./AiAssistant";

interface AnalysisInterfaceProps {
  fileName: string;
  onBack: () => void;
  userEmail: string;
}

type AnalysisStage = "idle" | "analyzing" | "complete";

export function AnalysisInterface({ fileName, onBack, userEmail }: AnalysisInterfaceProps) {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [allAnalysisComplete, setAllAnalysisComplete] = useState(false);

  // --- REFS ---
  const liveConnectionRef = useRef<LiveClient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Ref for auto-scroll

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
  }, [message]);

  const startAnalysis = () => {
    setStage("analyzing");
    setAllAnalysisComplete(false);
    setChatMessages([{ role: "assistant", content: `I've received your document "${fileName}". Starting comprehensive forensic analysis...` }]);
    setTimeout(() => {
      setAllAnalysisComplete(true);
      setStage("complete");
      setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Analysis complete! Please review the detailed results below." }]);
      sendEmailNotification(userEmail);
      toast.success("Analysis complete! Notification email sent.");
    }, 8000);
  };

  const sendEmailNotification = async (email: string) => {
    if (!email) return;
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("file", new Blob([""], { type: 'application/pdf' }), `${fileName}_Report.pdf`);
      await fetch("http://127.0.0.1:8000/email/send-report", { method: "POST", body: formData });
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
              <DocumentViewer fileType="image" fileUrl="https://firebasestorage.googleapis.com/v0/b/trustlens-632fa.firebasestorage.app/o/documents%2Fgoogle%20(2).png?alt=media&token=dc5a9691-9aeb-42dd-bdc1-b6ee34184337" />
            </TabsContent>
            <TabsContent value="ai-assistant" >
              <AiAssistant messages={chatMessages} stage={stage}/>
            </TabsContent>
          </Tabs>

          {/* Analysis Column */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            {stage === "analyzing" && <AnalysisProcess />}
            {stage === "complete" && <AnalysisResults />}
          </div>
        </div>
      </div>
    </div>
  );
}