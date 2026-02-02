import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Mic, MicOff, AlertTriangle, Mail, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { generateAnalysisPDF, downloadPDF, type AnalysisData } from "@/lib/pdfGenerator";
import { AnalysisProcess } from "./AnalysisProcess";
import { AnalysisResults } from "./AnalysisResults";

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
  const [isRecording, setIsRecording] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [allAnalysisComplete, setAllAnalysisComplete] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Auto-start analysis when component mounts
    const timer = setTimeout(() => {
      startAnalysis();
    }, 500);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);
  
  // Prevent accidental page close during analysis
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === "analyzing") {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stage]);

  const startAnalysis = () => {
    setStage("analyzing");
    setAllAnalysisComplete(false);
    setChatMessages([
      { 
        role: "assistant", 
        content: `I've received your document "${fileName}". Starting comprehensive forensic analysis. This will take approximately 8-10 seconds...` 
      }
    ]);

    // Wait for ALL analysis to complete (8 seconds)
    setTimeout(() => {
      // All analysis steps are done
      setAllAnalysisComplete(true);
      setStage("complete");
      
      setChatMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: "✅ Analysis complete! All forensic checks have been performed. I've detected several important findings. Please review the detailed results below." 
        }
      ]);
      
      // Send email notification ONLY once when everything is done
      sendEmailNotification(userEmail);
      toast.success("Analysis complete! Notification email sent to " + userEmail);
    }, 100); // 8 seconds for ALL analysis steps
  };

  const sendEmailNotification = (email: string) => {
    // TODO: Implement actual email sending using Firebase Functions or Email API
    // For now, this is a placeholder
    console.log(`Email notification sent to: ${email}`);
    console.log(`Subject: Document Analysis Complete - ${fileName}`);
    console.log(`Body: Your forensic analysis for "${fileName}" has been completed. Please return to the application to view your results.`);
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    setChatMessages(prev => [
      ...prev,
      { role: "user", content: message }
    ]);

    // Simulate AI response
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: "I understand your question. Based on the analysis, I can provide more specific details about any section of the report. What would you like to know more about?" 
        }
      ]);
    }, 1000);

    setMessage("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // TODO: Send to Deepgram for transcription
        // For now, simulating transcription
        toast.info("Speech-to-text feature requires Deepgram API key");
        
        // Simulated transcription
        const transcribedText = "This is a simulated transcription. Please configure Deepgram API.";
        setMessage(transcribedText);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Recording stopped, processing...");
    }
  };

  const handleDownloadPDF = () => {
    // Mock analysis data matching the actual analysis structure
    const analysisData: AnalysisData = {
      fileName: fileName,
      metadata: {
        fileName: fileName,
        fileSize: "2.4 MB",
        createdDate: "December 15, 2025",
        modifiedDate: "January 10, 2026",
        author: "John Doe",
        lastModifiedBy: "Unknown User",
        totalEdits: 7,
        ipAddress: "192.168.1.142",
        location: "San Francisco, CA, USA",
        editingSoftware: ["Adobe Photoshop CC 2024", "Microsoft Word 2021", "Canva Pro"],
        suspiciousActivity: true
      },
      findings: [
        {
          type: "warning",
          title: "Multiple Editing Software Detected",
          description: "Document shows traces of editing from Adobe Photoshop, MS Word, and Canva. This is unusual for authentic documents.",
          severity: "medium"
        },
        {
          type: "warning",
          title: "Metadata Inconsistencies",
          description: "Creation date and first modification date don't match. Last modifier identity could not be verified.",
          severity: "medium"
        },
        {
          type: "alert",
          title: "Suspicious Content Detected",
          description: "Section 4.2 contains unusual clauses commonly found in fraudulent contracts. Hidden text layers detected.",
          severity: "high"
        }
      ],
      contentAnalysis: [
        {
          section: "Section 1: Introduction",
          status: "safe",
          details: "Standard contract introduction with no suspicious terms detected."
        },
        {
          section: "Section 4.2: Liability Clause",
          status: "danger",
          details: "⚠ CRITICAL: Contains one-sided liability terms heavily favoring the other party."
        },
        {
          section: "Section 6: Dispute Resolution",
          status: "danger",
          details: "⚠ Arbitration clause specifies jurisdiction in foreign country with unfavorable laws."
        }
      ],
      riskLevel: "medium"
    };
    
    const pdf = generateAnalysisPDF(analysisData);
    downloadPDF(pdf, `${fileName}_Forensic_Report.pdf`);
    toast.success("PDF report downloaded successfully!");
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Warning Banner */}
      {stage === "analyzing" && !hasShownWarning && (
        <div className="fixed top-23 left-0 right-0 z-40 bg-yellow-500 dark:bg-yellow-600 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-white" />
              <p className="text-sm text-white">
                <strong>Analysis in progress.</strong> Do not close this page. You can leave it open - we'll send an email to <strong>{userEmail}</strong> when complete.
              </p>
            </div>
            <button
              onClick={() => setHasShownWarning(true)}
              className="text-white hover:text-yellow-100 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={` border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed left-0 right-0 ${stage === "analyzing" && !hasShownWarning ? "top-3" : "top-3"} z-10`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white text-sm md:text-base px-2 md:px-4"
            >
              ← Back
            </Button>
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
              <span className="text-xs md:text-sm text-gray-700 dark:text-slate-400 flex items-center gap-1 md:gap-2">
                <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Analyzing...</span>
              </span>
            )}
            {stage === "complete" && (
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-xs md:text-sm text-green-600 dark:text-green-400 flex items-center gap-1 md:gap-2">
                  <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></span>
                  <span className="hidden sm:inline">Complete</span>
                </span>
                <Mail className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pt-24 md:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Chat Column - Fixed Position on Desktop, Regular on Mobile */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="lg:sticky lg:top-32">
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg flex flex-col h-[500px] lg:h-[calc(100vh-140px)]">
                <div className="p-3 md:p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-t-xl">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">AI Assistant</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-400">Ask questions about your analysis</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gray-50 dark:bg-slate-900/50">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-2 md:p-3 shadow-sm text-sm md:text-base ${ 
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600"
                        }`}
                      >
                        <p className="text-xs md:text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="p-3 md:p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Ask about the analysis..."
                      className="bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-slate-400 text-sm"
                      disabled={stage !== "complete"}
                    />
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={stage !== "complete"}
                      variant="outline"
                      size="icon"
                      className={`flex-shrink-0 ${isRecording ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : "border-gray-300 dark:border-slate-600"}`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={handleSendMessage}
                      disabled={stage !== "complete" || !message.trim()}
                      size="icon"
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-500 text-center hidden md:block">
                    Click mic to use speech-to-text (Deepgram)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Column */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            {stage === "analyzing" && <AnalysisProcess />}
            {stage === "complete" && <AnalysisResults />}
          </div>
        </div>
      </div>

      {/* Download Button */}
      {stage === "complete" && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleDownloadPDF}
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}