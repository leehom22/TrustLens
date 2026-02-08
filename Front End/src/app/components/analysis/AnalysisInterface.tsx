"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Mic, MicOff, AlertTriangle, Mail, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { toast } from "sonner";
import { generateAnalysisPDF, downloadPDF, type AnalysisData } from "@/lib/pdfGenerator";
import { AnalysisProcess } from "./AnalysisProcess";
import { AnalysisResults } from "./AnalysisResults";
import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";

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
  
  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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
        formData.append("file", new Blob([""], {type: 'application/pdf'}), `${fileName}_Report.pdf`);
        await fetch("http://127.0.0.1:8000/email/send-report", { method: "POST", body: formData });
    } catch (error) { console.error('Email failed:', error); }
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    setChatMessages(prev => [...prev, { role: "user", content: message }]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "assistant", content: "I understand. What else would you like to know?" }]);
    }, 1000);
    setMessage("");
  };

  // --- "HEAVY DUTY" AUDIO LOGIC (The one that works) ---
  const startRecording = async () => {
    try {
      console.log("🎤 Requesting Microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // FORCE audio/webm (Standard for Windows/Chrome)
      const mimeType = 'audio/webm';
      console.log(`🎤 Using Format: ${mimeType}`);

      console.log("🔑 Connecting to Backend...");
      const response = await fetch("http://127.0.0.1:8000/api/deepgram");
      const data = await response.json();
      if (!data.key) throw new Error("No key from backend");

      const deepgram = createClient(data.key);
      
      // BASIC CONFIG: No fancy settings.
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        punctuate: true, 
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("🟢 Deepgram Connection OPEN");
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
            console.log("📝 TEXT RECEIVED:", transcript);
            setMessage((prev) => prev + " " + transcript);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error("❌ Deepgram Error:", err);
      });

      liveConnectionRef.current = connection;

      // RECORDER SETUP
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
        }
      };

      // SLOW DOWN: Send chunks every 1000ms (1 second) to prevent silence bug
      mediaRecorder.start(1000); 
      
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.info("Listening... Speak continuously.");

    } catch (error) {
      console.error("Recording Error:", error);
      toast.error("Mic Error: " + String(error));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    
    toast.info("Finalizing speech...");

    // Wait 3 seconds for the last big chunk to process
    setTimeout(() => {
        if (liveConnectionRef.current) {
            liveConnectionRef.current.finish();
            liveConnectionRef.current = null;
        }
        setIsRecording(false);
        
        if (message.trim()) {
            handleSendMessage();
        } else {
            console.warn("Message still empty.");
            toast.warning("No text received.");
        }
    }, 3000); 
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
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pt-24 md:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Chat Column */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="lg:sticky lg:top-32">
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg flex flex-col h-[500px] lg:h-[calc(100vh-140px)]">
                <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                  <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-600">Ask questions about your analysis</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-gray-50 dark:bg-slate-900/50">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 shadow-sm text-sm ${ msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border"}`}>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-3 md:p-4 border-t border-gray-200 bg-white">
                  <div className="flex gap-2 mb-2">
                    <Input 
                      ref={inputRef} // <--- ATTACHED REF FOR SCROLLING
                      value={message} 
                      onChange={(e) => setMessage(e.target.value)} 
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} 
                      placeholder="Ask about the analysis..." 
                      disabled={stage !== "complete"} 
                    />
                    <Button onClick={isRecording ? stopRecording : startRecording} disabled={stage !== "complete"} variant="outline" size="icon" className={isRecording ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : ""}>
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Button onClick={handleSendMessage} disabled={stage !== "complete" || !message.trim()} size="icon" className="bg-blue-600 text-white">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {isRecording ? "Listening... (Speak for 3s)" : "Click mic to speak"}
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
    </div>
  );
}