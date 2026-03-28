import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useLanguage } from "@/app/components/LanguageProvider"; // Adjust path if necessary
import DisputeModal from './DisputeModal';

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

    const { language } = useLanguage();
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    let uid = '';
    let user_name = '';
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
        uid = user.uid;
        user_name = user.displayName || "Anonymous";
    }

    // --- LANGUAGE CONTEXT ---
    const t = {
        en: {
            errFetch: "Could not load community reports.",
            errLogin: "Please log in to post a comment.",
            successPost: "Comment shared!",
            errPost: "Failed to post comment.",
            errHelpful: "Failed to mark comment as helpful.",
            errReason: "Please provide a reason for the dispute.",
            successDispute: "Dispute submitted successfully for review.",
            errDispute: "Failed to submit dispute. Please try again.",
            you: "YOU",
            placeholder: "Write a report...",
            post: "Post",
            noReports: "No reports yet.",
            helpful: "Helpful",
            commReports: "Community Reports",
            disputeAlert: "Dispute Alert",
            disputeThis: "Dispute this Alert",
            disputeDesc: "If you believe this alert is inaccurate or violates PDPA guidelines, please provide details below.",
            reasonLabel: "Reason for Dispute *",
            reasonPlaceholder: "Please explain why this alert should be reviewed...",
            evidenceLabel: "Evidence File (Optional)",
            cancel: "Cancel",
            submitDispute: "Submit Dispute"
        },
        ms: {
            errFetch: "Tidak dapat memuatkan laporan komuniti.",
            errLogin: "Sila log masuk untuk menghantar komen.",
            successPost: "Komen dikongsi!",
            errPost: "Gagal menghantar komen.",
            errHelpful: "Gagal menanda komen sebagai berguna.",
            errReason: "Sila berikan sebab untuk pertikaian ini.",
            successDispute: "Pertikaian berjaya dihantar untuk semakan.",
            errDispute: "Gagal menghantar pertikaian. Sila cuba lagi.",
            you: "ANDA",
            placeholder: "Tulis laporan...",
            post: "Hantar",
            noReports: "Tiada laporan lagi.",
            helpful: "Berguna",
            commReports: "Laporan Komuniti",
            disputeAlert: "Pertikai Amaran",
            disputeThis: "Pertikai Amaran ini",
            disputeDesc: "Jika anda percaya amaran ini tidak tepat atau melanggar garis panduan PDPA, sila berikan butiran di bawah.",
            reasonLabel: "Sebab Pertikaian *",
            reasonPlaceholder: "Sila terangkan mengapa amaran ini perlu disemak...",
            evidenceLabel: "Fail Bukti (Pilihan)",
            cancel: "Batal",
            submitDispute: "Hantar Pertikaian"
        }
    }[language];

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
                toast.error(t.errFetch);
            } finally {
                setLoading(false);
            }
        };

        if (alertId) fetchComments();
    }, [alertId, backendUrl, t.errFetch]);

    // --- POST NEW COMMENT ---
    const handleSubmit = async () => {
        if (!newComment.trim()) return;
        if (!uid) {
            toast.error(t.errLogin);
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
            toast.success(t.successPost);
        } catch (error) {
            toast.error(t.errPost);
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
            toast.error(t.errHelpful);
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

    return (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-4 relative">

            {/* Header section with Dispute Button */}
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.commReports} ({localComments.length})
                </h4>
            </div>

            {/* Input Section */}
            <div className="flex gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {t.you}
                </div>
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleSubmit()}
                        placeholder={t.placeholder}
                        className="flex-1 text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !newComment.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all hover:bg-blue-700"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t.post}
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
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic text-center py-4">{t.noReports}</p>
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
                                            👍 {t.helpful} {c.helpful > 0 ? `(${c.helpful})` : ""}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default CommentSection;