import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export interface Comment {
    id: string;
    user: string;
    avatar: string;
    text: string;
    date: string;
    helpful: number;
}

const CommentSection = ({ alertId }: { alertId: string }) => {
    const [localComments, setLocalComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [helpfulClicked, setHelpfulClicked] = useState<Set<string>>(new Set());

    // Dispute State
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeReason, setDisputeReason] = useState("");
    const [disputeFile, setDisputeFile] = useState<File | null>(null);
    const [isDisputing, setIsDisputing] = useState(false);

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    let uid = '';
    let user_name = '';
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
        uid = user.uid;
        user_name = user.displayName || "Anonymous";
    }

    // --- FETCH COMMENTS ON LOAD ---
    useEffect(() => {
        const fetchComments = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${backendUrl}/scam-alert/${alertId}/comments`);

                const mappedComments: Comment[] = response.data.map((c: any) => ({
                    id: c.comment_id,
                    user: c.user_name,
                    avatar: c.user_name.charAt(0).toUpperCase(),
                    text: c.text,
                    date: c.created_at,
                    helpful: c.helpful,
                }));

                setLocalComments(mappedComments);
            } catch (error) {
                console.error("Failed to fetch comments:", error);
                toast.error("Could not load community reports.");
            } finally {
                setLoading(false);
            }
        };

        if (alertId) fetchComments();
    }, [alertId, backendUrl]);

    // --- POST NEW COMMENT ---
    const handleSubmit = async () => {
        if (!newComment.trim()) return;
        if (!uid) {
            toast.error("Please log in to post a comment.");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await axios.post(`${backendUrl}/scam-alert/${alertId}/comments`, {
                document_id: alertId,
                user_id: uid,
                user_name: user_name,
                text: newComment.trim(),
            });

            const newC = response.data;
            const c: Comment = {
                id: newC.comment_id,
                user: newC.user_name,
                avatar: "Y",
                text: newC.text,
                date: newC.created_at,
                helpful: newC.helpful,
            };

            setLocalComments((prev) => [c, ...prev]);
            setNewComment("");
            toast.success("Comment shared!");
        } catch (error) {
            toast.error("Failed to post comment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- UPVOTE COMMENT ---
    const toggleHelpful = async (id: string) => {
        // Since backend only increments, we prevent multiple clicks per session
        if (helpfulClicked.has(id)) return;

        // Optimistic UI Update
        setHelpfulClicked((prev) => new Set(prev).add(id));
        setLocalComments((prev) =>
            prev.map((c) => (c.id === id ? { ...c, helpful: c.helpful + 1 } : c))
        );

        try {
            await axios.post(`${backendUrl}/scam-alert/comments/${id}/helpful`);
        } catch (error) {
            // Revert optimistic update on failure
            toast.error("Failed to mark comment as helpful.");
            setHelpfulClicked((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setLocalComments((prev) =>
                prev.map((c) => (c.id === id ? { ...c, helpful: c.helpful - 1 } : c))
            );
        }
    };

    // --- HANDLE DISPUTE ---
    const handleDisputeSubmit = async () => {
        if (!disputeReason.trim()) {
            toast.error("Please provide a reason for the dispute.");
            return;
        }

        try {
            setIsDisputing(true);
            const formData = new FormData();
            formData.append("reason", disputeReason);
            if (disputeFile) {
                formData.append("evidence_file", disputeFile);
            }

            await axios.post(`${backendUrl}/scam-alert/${alertId}/dispute`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toast.success("Dispute submitted successfully for review.");
            setShowDisputeModal(false);
            setDisputeReason("");
            setDisputeFile(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit dispute. Please try again.");
        } finally {
            setIsDisputing(false);
        }
    };

    return (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-4 relative">

            {/* Header section with Dispute Button */}
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Community Reports ({localComments.length})
                </h4>
                <button
                    onClick={() => setShowDisputeModal(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Dispute Alert
                </button>
            </div>

            {/* Input Section */}
            <div className="flex gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    YOU
                </div>
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleSubmit()}
                        placeholder="Write a report..."
                        className="flex-1 text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !newComment.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all hover:bg-blue-700"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                    </button>
                </div>
            </div>

            {/* Comments List */}
            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
                </div>
            ) : (
                <div className="space-y-4">
                    {localComments.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic text-center py-4">No reports yet.</p>
                    ) : (
                        localComments.map((c) => (
                            <div key={c.id} className="flex gap-3 group">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                    {c.avatar}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{c.user}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{c.date}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl rounded-tl-none inline-block border border-transparent dark:border-slate-700/50">
                                        {c.text}
                                    </p>
                                    <div className="mt-1 flex items-center gap-4">
                                        <button
                                            onClick={() => toggleHelpful(c.id)}
                                            disabled={helpfulClicked.has(c.id)}
                                            className={`flex items-center gap-1.5 text-[11px] transition-colors ${helpfulClicked.has(c.id)
                                                    ? "text-blue-600 dark:text-blue-400 font-bold cursor-default"
                                                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                                }`}
                                        >
                                            👍 Helpful {c.helpful > 0 ? `(${c.helpful})` : ""}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* --- DISPUTE MODAL --- */}
            {showDisputeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-transparent dark:border-slate-700">
                        <button
                            onClick={() => setShowDisputeModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                            Dispute this Alert
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                            If you believe this alert is inaccurate or violates PDPA guidelines, please provide details below.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Reason for Dispute *</label>
                                <textarea
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    placeholder="Please explain why this alert should be reviewed..."
                                    className="w-full text-sm border border-gray-300 dark:border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 focus:border-red-400 dark:focus:border-red-500 outline-none min-h-[100px] bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Evidence File (Optional)</label>
                                <input
                                    type="file"
                                    onChange={(e) => setDisputeFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 dark:file:bg-red-900/20 file:text-red-700 dark:file:text-red-400 hover:file:bg-red-100 dark:hover:file:bg-red-900/30 cursor-pointer"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowDisputeModal(false)}
                                    className="flex-1 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDisputeSubmit}
                                    disabled={isDisputing || !disputeReason.trim()}
                                    className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-red-700 transition-colors flex justify-center items-center"
                                >
                                    {isDisputing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommentSection;