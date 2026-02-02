import { AlertCircle, CheckCircle, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import React, { useState } from 'react'

const ExpertReview = () => {
    const [reviewDecision, setReviewDecision] = useState<String | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    const handleReviewSubmit = () => {
        if (!reviewDecision) {
            alert('Please select a decision before submitting');
            return;
        }
        // In real app, submit review to backend
        alert(`Review submitted: ${reviewDecision}\nNotes: ${reviewNotes}`);
        setReviewDecision(null);
        setReviewNotes('');
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 transition-colors shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Expert Review Decision</h3>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Your Decision</label>
                <div className="grid grid-cols-3 gap-3">
                    {/* Authentic Button */}
                    <button
                        onClick={() => setReviewDecision('authentic')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'authentic'
                            ? 'border-green-600 bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-green-300 dark:hover:border-emerald-700'
                            }`}
                    >
                        <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'authentic' ? 'text-green-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'authentic' ? 'text-green-900 dark:text-emerald-100' : 'text-gray-900 dark:text-slate-400'}`}>Authentic</p>
                    </button>

                    {/* Suspicious Button */}
                    <button
                        onClick={() => setReviewDecision('suspicious')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'suspicious'
                            ? 'border-yellow-600 bg-yellow-50 dark:bg-amber-900/20 dark:border-amber-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-yellow-300 dark:hover:border-amber-700'
                            }`}
                    >
                        <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'suspicious' ? 'text-yellow-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'suspicious' ? 'text-yellow-900 dark:text-amber-100' : 'text-gray-900 dark:text-slate-400'}`}>Suspicious</p>
                    </button>

                    {/* Forgery Button */}
                    <button
                        onClick={() => setReviewDecision('forgery')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'forgery'
                            ? 'border-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700'
                            }`}
                    >
                        <XCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'forgery' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'forgery' ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-slate-400'}`}>Forgery</p>
                    </button>
                </div>
            </div>

            {/* Notes Section */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Review Notes</label>
                <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Provide detailed reasoning for your decision..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-600 resize-none outline-none transition-colors"
                />
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                        Agree
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <ThumbsDown className="w-4 h-4" />
                        Disagree
                    </button>
                </div>
                <button
                    onClick={handleReviewSubmit}
                    className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                >
                    Submit Review
                </button>
            </div>
        </div>
    )
}

export default ExpertReview