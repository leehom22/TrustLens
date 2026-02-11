import React, { useEffect, useRef, useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Mic, MicOff, Send } from 'lucide-react'
import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { toast } from 'sonner'

type AnalysisStage = "idle" | "analyzing" | "complete";

const AiAssistant = (props: {
    messages:Array<{ role: "user" | "assistant"; content: string }>,
    stage: AnalysisStage
 }) => {
    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>(props.messages);
    const [message, setMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    // --- REFS ---
    const inputRef = useRef<HTMLInputElement>(null); // Ref for auto-scroll
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const liveConnectionRef = useRef<LiveClient | null>(null);
    const stage = props.stage

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

      useEffect(() => {
        if (inputRef.current) {
          inputRef.current.scrollLeft = inputRef.current.scrollWidth;
        }
      }, [message]);

      useEffect(() => {
        setChatMessages(props.messages);
    }, [props.messages]);
    return (
        <div>
            <div className="lg:sticky lg:top-32">
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg flex flex-col h-[500px] lg:h-[calc(100vh-140px)]">
                    <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                        <p className="text-xs text-gray-600">Ask questions about your analysis</p>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-gray-50 dark:bg-slate-900/50">
                        {chatMessages?.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 shadow-sm text-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border"}`}>
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
    )
}

export default AiAssistant