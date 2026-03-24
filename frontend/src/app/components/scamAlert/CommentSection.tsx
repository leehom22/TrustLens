import axios from 'axios';
import { useEffect, useState } from 'react'
import { toast } from 'sonner';

const CommentSection = ({ comments, alertId }: { comments: Comment[]; alertId: string }) => {
    const [localComments, setLocalComments] = useState<Comment[]>(comments);
    const [newComment, setNewComment] = useState("");
    const [helpfulClicked, setHelpfulClicked] = useState<Set<string>>(new Set());

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        const c: Comment = {
            id: `new-${Date.now()}`,
            user: "You",
            avatar: "ME",
            text: newComment.trim(),
            date: "Just now",
            helpful: 0,
        };
        setLocalComments((prev) => [c, ...prev]);
        setNewComment("");
    };

    const toggleHelpful = (id: string) => {
        setHelpfulClicked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setLocalComments((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, helpful: helpfulClicked.has(id) ? c.helpful - 1 : c.helpful + 1 } : c
            )
        );
    };

    return (
        <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Community Reports ({localComments?.length})
            </h4>

            {/* Input */}
            <div className="flex gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                    ME
                </div>
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        placeholder="Share your experience with this document..."
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
                    />
                    <button
                        onClick={handleSubmit}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Post
                    </button>
                </div>
            </div>

            {/* Comments */}
            <div className="space-y-3">
                {localComments?.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No community reports yet. Be the first to comment.</p>
                )}
                {localComments?.map((c) => (
                    <div key={c.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {c.avatar}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-800">{c.user}</span>
                                <span className="text-xs text-gray-400">{c.date}</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{c.text}</p>
                            <button
                                onClick={() => toggleHelpful(c.id)}
                                className={`mt-1 flex items-center gap-1 text-xs transition-colors ${helpfulClicked?.has(c.id) ? "text-blue-600 font-semibold" : "text-gray-400 hover:text-gray-600"
                                    }`}
                            >
                                👍 Helpful ({c.helpful + (helpfulClicked?.has(c.id) ? 1 : 0)})
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CommentSection