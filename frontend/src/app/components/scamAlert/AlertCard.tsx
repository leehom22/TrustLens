import { DOC_ICONS, RISK_CONFIG, THREAT_ICONS } from '@/lib/scamAlert';
import React, { useState } from 'react'
import CommentSection from './CommentSection';
import ConfidenceBar from './ConfidenceBar';

const AlertCard = ({ alert }: { alert: ScamAlert }) => {
    const [expanded, setExpanded] = useState(false);
    const risk = RISK_CONFIG[alert.riskLevel];

    return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border ${risk?.border} dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden`}>
        {/* Header strip */}
        <div className={`${risk?.bg} dark:bg-opacity-20 px-4 py-2.5 flex items-center justify-between border-b ${risk?.border} dark:border-slate-700`}>
            <div className="flex items-center gap-2">
                {alert.verified && (
                    <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                        ✓ AI Verified
                    </span>
                )}
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${risk?.text} ${risk?.bg} ${risk?.border} dark:bg-slate-900/40`}>
                {alert.riskLevel}
            </span>
        </div>

        {/* Body */}
        <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    {alert?.title}
                </h3>
                <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                    📍 {alert?.state}
                </span>
            </div>

            {/* Threat + Reports row */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2.5 py-0.5 rounded-full font-medium">
                    {THREAT_ICONS[alert?.threatCategory]} {alert?.threatCategory}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    🚩 <span className="font-semibold text-gray-700 dark:text-slate-200">{alert?.reportCount}</span> user reports
                </span>
            </div>

            {/* AI Confidence */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-slate-400">AI Confidence Score</span>
                    <span className={`text-xs font-bold ${risk?.text}`}>{alert?.aiConfidence}%</span>
                </div>
                <ConfidenceBar value={alert?.aiConfidence} riskLevel={alert?.riskLevel} />
            </div>

            {/* Dates */}
            <div className="flex gap-4 mb-3">
                <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">First Flagged</p>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{alert?.firstFlagged}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Last Seen Circulating</p>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{alert?.lastSeen}</p>
                </div>
            </div>

            {/* Redacted Preview */}
            <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 mb-3 border border-gray-100 dark:border-slate-700/50">
                <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold mb-1.5 uppercase tracking-wider">
                    Redacted Document Preview
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed font-mono">
                    {alert?.redactedPreview}
                </p>
            </div>

            {/* Scam Indicators */}
            <div className="mb-3">
                <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-1.5">
                    ⚠ Key Scam Indicators
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {alert?.scamIndicators.map((ind, i) => (
                        <span key={i} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 px-2 py-0.5 rounded-full">
                            {ind}
                        </span>
                    ))}
                </div>
            </div>

            {/* Toggle Comments */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
                💬 {expanded ? "Hide" : "View"} Community Reports ({alert?.comments?.length})
                <span className="text-gray-400 dark:text-slate-500">{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && <CommentSection comments={alert?.comments} alertId={alert?.id} />}
        </div>
    </div>
);
}

export default AlertCard