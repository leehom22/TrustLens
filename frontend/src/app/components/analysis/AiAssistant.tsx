import React, { useEffect, useRef, useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
    Mic,
    MicOff,
    Send,
    Sparkles,
    ShieldAlert,
    Scale,
    FileX,
    Search,
    ChevronUp
} from 'lucide-react'
import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { toast } from 'sonner'
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import ReactMarkdown from 'react-markdown'
import { auth, db } from "../../../lib/firebase";
import { useLanguage } from "../LanguageProvider";

// --- TYPES ---
type AnalysisStage = "idle" | "analyzing" | "complete";
type ChatMode = "forensic_analyst" | "contract_guardian" | "policy_advisor" | "rejection_letter";

interface ChatMessage {
    role: "user" | "model";
    content: string;
}

/*
interface SuggestedAction {
    label: string;
    mode: string;
    query: string;
}
*/

interface AiAssistantProps {
    reqId: string;
    initialMessages?: ChatMessage[];
    stage: AnalysisStage;
    userType: 'user' | 'expert';
}

const MODES: Record<ChatMode, { label: string; icon: React.ReactNode; color: string }> = {
    forensic_analyst: { label: "Forensic Analyst", icon: <Search className="w-4 h-4" />, color: "text-blue-600" },
    contract_guardian: { label: "Contract Guardian", icon: <ShieldAlert className="w-4 h-4" />, color: "text-amber-600" },
    policy_advisor: { label: "Policy Advisor", icon: <Scale className="w-4 h-4" />, color: "text-green-600" },
    rejection_letter: { label: "Rejection Letter", icon: <FileX className="w-4 h-4" />, color: "text-red-600" },
};

//** reqId: Collection id from the analysis_result */
const AiAssistant = ({ reqId, initialMessages = [], stage, userType }: AiAssistantProps) => {
    // --- STATE ---
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages);
    const [message, setMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [currentMode, setCurrentMode] = useState<ChatMode>("forensic_analyst");
    const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
    const [showModeMenu, setShowModeMenu] = useState(false);

    // --- REFS ---
    const inputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const liveConnectionRef = useRef<LiveClient | null>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);

    const user = auth.currentUser
    const backendURL = import.meta.env.VITE_BACKEND_URL
    // Global language — forwarded to /chat so responses are in the correct language
    const { language } = useLanguage();
    // --- EFFECT: Close mode menu on click outside ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
                setShowModeMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- EFFECT: FETCH HISTORY ---
    useEffect(() => {
        const fetchHistory = async () => {
            if (!reqId) return;

            try {
                const msgsRef = collection(db, "analysis_results", reqId, "messages");
                const q = query(
                    msgsRef,
                    where("userType", "==", userType), // Filter by userType 
                    orderBy("timestamp", "asc"));

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const history: ChatMessage[] = snapshot.docs.map(doc => ({
                        role: doc.data().role === "user" ? "user" : "model",
                        content: doc.data().content
                    }));
                    setChatMessages(history);
                }
            } catch (error) {
                console.error("Error fetching chat history:", error);
            }
        };

        if (stage === "complete") {
            fetchHistory();
        }
    }, [reqId, stage]);

    // --- EFFECT: Smart Scroll ---
    useEffect(() => {
        if (chatContainerRef.current) {
            const { scrollHeight, clientHeight } = chatContainerRef.current;
            chatContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [chatMessages, isThinking]);


    // --- CORE: Send Message Logic ---
    const handleSendMessage = async (overrideQuery?: string, overrideMode?: string) => {
        const queryText = overrideQuery || message;
        const activeMode = overrideMode || currentMode;

        if (!queryText.trim() || stage !== "complete") return;

        // 1. Optimistic Update
        const newUserMsg: ChatMessage = { role: "user", content: queryText };
        setChatMessages(prev => [...prev, newUserMsg]);
        setMessage("");
        setSuggestedActions([]);
        setIsThinking(true);

        try {
            // const token = localStorage.getItem("token") || localStorage.getItem("access_token");
            const token = user ? await user.getIdToken() : null;
            if (!token) throw new Error("Unauthorized: Please log in to continue.");
            // 2. Call Backend
            // console.log("JSON send to backend: ", {
            //     req_id: reqId,
            //     user_query: queryText,
            //     mode: activeMode
            // });
            const response = await fetch(`${backendURL}/chat/message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    req_id: reqId,
                    user_query: queryText,
                    mode: activeMode,
                    user_type: userType,
                    language: language   // tells backend to respond in the selected language
                })
            });

            if (response.status === 401) throw new Error("Unauthorized: Please log in again.");
            if (!response.ok) throw new Error(`Server Error: ${response.status}`);

            const data = await response.json();

            // 3. Update Chat with AI Response
            const newAiMsg: ChatMessage = { role: "model", content: data.response };
            setChatMessages(prev => [...prev, newAiMsg]);

            if (data.suggested_actions) {
                setSuggestedActions(data.suggested_actions);
            }

            if (overrideMode) {
                setCurrentMode(overrideMode as ChatMode);
            }

        } catch (error: any) {
            console.error("Chat Error:", error);
            toast.error(error.message || "Failed to connect to TrustLens AI.");
            setChatMessages(prev => [...prev, {
                role: "model",
                content: "⚠️ Connection Error: " + (error.message || "I couldn't reach the server.")
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSuggestionClick = (suggestionText: string) => {
        let nextMode = currentMode;

        if (suggestionText.includes("Forensic Analyst")) {
            nextMode = "forensic_analyst";
        } else if (suggestionText.includes("Rejection Letter")) {
            nextMode = "rejection_letter";
        } else if (suggestionText.includes("Contract Guardian")) {
            nextMode = "contract_guardian";
        } else if (suggestionText.includes("Policy Advisor")) {
            nextMode = "policy_advisor";
        }

        setCurrentMode(nextMode as ChatMode);

        // Clear the input and suggestions
        setSuggestedActions([]);

        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    // --- AUDIO LOGIC (UPDATED WITH FIX) ---
    const startRecording = async () => {
        try {
            console.log("🎤 Requesting Microphone...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Added cross-browser support for Safari
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            console.log("🔑 Connecting to Backend...");
            const response = await fetch(`${backendURL}/api/deepgram`);
            const data = await response.json();

            if (!data.key) throw new Error("No key from backend");

            const deepgram = createClient(data.key);

            const connection = deepgram.listen.live({
                model: "nova-2",
                language: "en-US",
                punctuate: true,
            });

            // Set up recorder before Open event so it can be used inside
            const mediaRecorder = new MediaRecorder(stream, { mimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && connection.getReadyState() === 1) {
                    connection.send(event.data);
                }
            };

            // 1. Connection Open Listener
            connection.on(LiveTranscriptionEvents.Open, () => {
                console.log("🟢 Deepgram Connection OPEN");
                // ✅ Start recording ONLY when the connection is fully open
                mediaRecorder.start(1000);
            });

            // 2. Transcript Listener
            connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                // Extract the transcript and the is_final flag
                const transcript = data.channel.alternatives[0]?.transcript;
                const isFinal = data.is_final; // <--- CHECK THIS FLAG

                if (transcript && transcript.trim().length > 0 && isFinal) {
                    console.log("📝 FINAL TEXT RECEIVED:", transcript);

                    setMessage((prev) => {
                        // Avoid adding the exact same string if it was just added 
                        // (Double-check for rapid-fire final events)
                        if (prev.endsWith(transcript.trim())) return prev;

                        return prev + (prev.length > 0 ? " " : "") + transcript;
                    });
                }
            });

            // 3. Error Listener
            connection.on(LiveTranscriptionEvents.Error, (err) => {
                console.error("❌ Deepgram Error:", err);
            });

            liveConnectionRef.current = connection;
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
            toast.info("Listening...");

        } catch (error) {
            console.error("Recording Error:", error);
            toast.error("Mic Error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }

        toast.info("Finalizing speech...");

        // Wait 3 seconds to catch final words
        setTimeout(() => {
            if (liveConnectionRef.current) {
                liveConnectionRef.current.finish();
                liveConnectionRef.current = null;
            }
            setIsRecording(false);
        }, 3000);
    };

    return (
        <div>
            <div className="lg:sticky lg:top-32">
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg flex flex-col h-[600px] lg:h-[calc(100vh-140px)]">

                    {/* --- HEADER --- */}
                    <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                TrustLens Assistant
                                <span className={`text-xs px-2 py-0.5 rounded-full border bg-white ${MODES[currentMode].color} border-current`}>
                                    {MODES[currentMode].label}
                                </span>
                            </h3>
                            <p className="text-xs text-gray-600">
                                {stage === "complete" ? "Ready to analyze." : "Analyzing document..."}
                            </p>
                        </div>
                    </div>

                    {/* --- MESSAGES AREA --- */}
                    <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 bg-gray-50 dark:bg-slate-900/50 scroll-smooth"
                    >
                        {chatMessages.length === 0 && stage === "complete" && (
                            <div className="text-center text-gray-400 mt-10">
                                <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Analysis complete. Ask me anything about the document.</p>
                            </div>
                        )}

                        {stage !== "complete" && chatMessages.length === 0 && (
                            <div className="text-center text-gray-400 mt-10 animate-pulse">
                                <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Scanning document layers...</p>
                            </div>
                        )}

                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 shadow-sm text-sm whitespace-pre-wrap leading-relaxed 
                                    ${msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none"
                                    }`}>
                                        <ReactMarkdown>
                                            {msg.content}
                                        </ReactMarkdown>
                                </div>
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-white border rounded-lg p-3 rounded-bl-none shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75" />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* --- SUGGESTED ACTIONS --- */}
                    {suggestedActions.length > 0 && !isThinking && (
                        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto no-scrollbar border-t border-gray-100">
                            {suggestedActions.map((actionText, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSuggestionClick(actionText)}
                                    className="flex-shrink-0 text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-1"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {actionText}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* --- INPUT AREA --- */}
                    <div className="p-3 md:p-4 border-t border-gray-200 bg-white dark:bg-slate-800 rounded-b-xl relative">

                        {/* Mode Selection Popover */}
                        {showModeMenu && (
                            <div ref={modeMenuRef} className="absolute bottom-full left-4 mb-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg shadow-xl overflow-hidden z-20">
                                <div className="p-2 bg-gray-50 border-b text-xs font-semibold text-gray-500">
                                    Select Persona
                                </div>
                                {(Object.keys(MODES) as ChatMode[]).map((modeKey) => (
                                    <button
                                        key={modeKey}
                                        onClick={() => { setCurrentMode(modeKey); setShowModeMenu(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors
                                            ${currentMode === modeKey ? "bg-blue-50 text-blue-700" : "text-gray-700"}
                                        `}
                                    >
                                        <span className={MODES[modeKey].color}>{MODES[modeKey].icon}</span>
                                        {MODES[modeKey].label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            {/* Mode Button */}
                            {/* <Button
                                onClick={() => setShowModeMenu(!showModeMenu)}
                                variant="outline"
                                className="h-10 px-3 gap-2 border-dashed border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300"
                                disabled={stage !== "complete"}
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden md:inline text-xs font-medium">Modes</span>
                                <ChevronUp className={`w-3 h-3 transition-transform ${showModeMenu ? "rotate-180" : ""}`} />
                            </Button> */}

                            {/* Input */}
                            <Input
                                ref={inputRef}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                                placeholder={stage === "complete" ? `Ask ${MODES[currentMode].label}...` : "Analyzing document..."}
                                disabled={stage !== "complete" || isThinking}
                                className="flex-1"
                            />

                            {/* Mic Button */}
                            <Button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={stage !== "complete"}
                                variant="outline"
                                size="icon"
                                className={isRecording ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : ""}
                            >
                                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </Button>

                            {/* Send Button */}
                            <Button
                                onClick={() => handleSendMessage()}
                                disabled={stage !== "complete" || (!message.trim() && !isRecording) || isThinking}
                                size="icon"
                                className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AiAssistant