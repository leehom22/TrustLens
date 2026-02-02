import React from 'react'
import { DocumentKeyFindings } from '../../../../types/type'
import { AlertTriangle, Info } from 'lucide-react'
import { Badge } from "@/app/components/ui/badge";

const KeyFindings = ({ findings } : { findings : DocumentKeyFindings[] }) => {
    return (
        <div className='space-y-4'>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700  p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Findings Summary</h3>
                <div className="space-y-3">
                    {findings.map((finding, idx) => (
                        <div
                            key={idx}
                            className={`p-4 rounded-lg border shadow-sm ${finding.severity === "high"
                                ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-600/50"
                                : finding.severity === "medium"
                                    ? "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-600/50"
                                    : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-600/50"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {finding.type === "alert" ? (
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                                ) : finding.type === "warning" ? (
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                ) : (
                                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">{finding.title}</h4>
                                        <Badge
                                            variant={finding.severity === "high" ? "destructive" : "default"}
                                            className={`${finding.severity === "medium"
                                                ? "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                                                : finding.severity === "low"
                                                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                                    : ""
                                                }`}
                                        >
                                            {finding.severity}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-slate-200">{finding.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700  p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recommended Actions</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-slate-300">
                    <li>Have this document reviewed by a qualified legal professional</li>
                    <li>Request the original, unedited version from the sender</li>
                    <li>Verify the identity of the document author through alternative channels</li>
                    <li>Do not proceed with any transaction until concerns are addressed</li>
                    <li>Consider reporting suspicious activity to relevant authorities</li>
                </ol>
            </div>
        </div>
    )
}

export default KeyFindings