import React from 'react'
import { DocumentAnalysisResult } from '../../../types/type'
import { Download, Flag } from 'lucide-react'

const Header = ({ selectedDocument }: { selectedDocument: DocumentAnalysisResult | null }) => {
    const getRiskBadge = (level: string) => {
        const styles = {
            high: 'bg-red-100 text-red-800 border-red-200',
            medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            low: 'bg-green-100 text-green-800 border-green-200'
        };
        return styles[level] || styles.medium;
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 mb-6 transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                        {selectedDocument!.name}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                        <span>
                            Submitted by: <span className="font-medium text-gray-800 dark:text-slate-200">{selectedDocument!.submittedBy}</span>
                        </span>
                        <span>•</span>
                        <span>{selectedDocument!.submissionDate}</span>
                        <span>•</span>
                        <span>
                            Flagged by: <span className="font-medium text-gray-800 dark:text-slate-200">{selectedDocument!.flaggedBy}</span>
                        </span>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                    <Download className="w-4 h-4" />
                    Download
                </button>
            </div>

            <div className="flex items-center gap-4">
                {/* Risk Badge - Assuming getRiskBadge returns classes like 'bg-red-50 text-red-700 border-red-200' */}
                <span className={`px-3 py-1.5 rounded-full border font-medium text-sm ${getRiskBadge(selectedDocument!.riskLevel)}`}>
                    {selectedDocument!.riskLevel.toUpperCase()} RISK
                </span>

                <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                        AI Verdict: <span className="font-medium text-gray-800 dark:text-slate-200">{selectedDocument!.aiVerdict}</span>
                    </span>
                </div>

                <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-800 pl-4">
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                        Confidence: <span className="font-medium text-gray-800 dark:text-slate-200">{selectedDocument!.aiConfidence}%</span>
                    </span>
                </div>
            </div>
        </div>
    )
}

export default Header