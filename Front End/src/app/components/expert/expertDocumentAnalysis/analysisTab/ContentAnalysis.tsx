import { AlertTriangle, CheckCircle, FileText } from 'lucide-react'
import React from 'react'
import { DocumentContentAnalysis } from '../../../../types/type'

const ContentAnalysis = ({contentAnalysis} : {contentAnalysis: DocumentContentAnalysis[]}) => {
    return (
        <div className='space-y-4'>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Section-by-Section Analysis</h3>
                </div>
                <div className="space-y-3">
                    {contentAnalysis.map((section, idx) => (
                        <div
                            key={idx}
                            className={`p-4 rounded-lg border shadow-sm ${section.status === "danger"
                                ? "bg-red-50 dark:bg-red-600/10 border-red-300 dark:border-red-600/50"
                                : section.status === "warning"
                                    ? "bg-yellow-50 dark:bg-yellow-600/10 border-yellow-300 dark:border-yellow-600/50"
                                    : "bg-green-50 dark:bg-green-600/10 border-green-300 dark:border-green-600/50"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {section.status === "danger" ? (
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                                ) : section.status === "warning" ? (
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                ) : (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{section.section}</h4>
                                    <p className="text-sm text-gray-700 dark:text-slate-300">{section.details}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-400 dark:border-red-600/50 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ⚠️ Critical Recommendation
                </h3>
                <p className="text-gray-800 dark:text-white mb-3">
                    <strong>DO NOT SIGN</strong> this contract without legal review. We've identified multiple red flags
                    that are commonly associated with fraudulent contracts:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-slate-100 text-sm">
                    <li>One-sided liability terms that waive your rights</li>
                    <li>Unusually high termination penalties</li>
                    <li>Foreign jurisdiction for disputes</li>
                    <li>Hidden text layers in the PDF</li>
                </ul>
            </div>
        </div>
    )
}

export default ContentAnalysis