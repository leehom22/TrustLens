import React from 'react'

interface RequestReviewModalProps {
    setRequestReview:React.Dispatch<React.SetStateAction<boolean>>,
    setflaggedReason: React.Dispatch<React.SetStateAction<string>>,
    handleConfirmReview:(documentId: string, flaggedReason: string, setRequestReview: React.Dispatch<React.SetStateAction<boolean>>) => Promise<void>
}

const RequestReview = ({setRequestReview,setflaggedReason,handleConfirmReview}:RequestReviewModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRequestReview(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Request Forensic Review
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                This document will be prioritized for manual verification by our forensic team.
              </p>
            </div>

            {/* Textarea */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="review-reason"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Reason for manual review
              </label>
              <textarea
                id="review-reason"
                rows={4}
                placeholder="Briefly describe why this document requires human oversight..."
                onChange={(e) => setflaggedReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-600 p-2 rounded-lg"
                onClick={() => setRequestReview(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 p-2 rounded-lg"
                onClick={handleConfirmReview}
              >
                Confirm Request
              </button>
            </div>
          </div>
        </div>
  )
}

export default RequestReview