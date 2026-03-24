import { DOC_ICONS, RISK_CONFIG, THREAT_ICONS } from '@/lib/scamAlert';
import React, { useState } from 'react'
import CommentSection from './CommentSection';
import ConfidenceBar from './ConfidenceBar';

const AlertCard = ({ alert }: { alert: ScamAlert }) => {
    const [expanded, setExpanded] = useState(false);
    const risk = RISK_CONFIG[alert.riskLevel];

    return (
        <div className={`bg-white rounded-xl border ${risk?.border} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
            {/* Header strip */}
            <div className={`${risk?.bg} px-4 py-2.5 flex items-center justify-between border-b ${risk?.border}`}>
                <div className="flex items-center gap-2">
                    {/* <span className="text-base">{DOC_ICONS[alert?.documentType]}</span>
                    <span className="text-xs font-medium text-gray-600">{alert.documentType}</span> */}
                    {alert.verified && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                            ✓ AI Verified
                        </span>
                    )}
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${risk?.text} ${risk?.bg} ${risk?.border}`}>
                    {alert.riskLevel}
                </span>
            </div>

            {/* Body */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{alert?.title}</h3>
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        📍 {alert?.state}
                    </span>
                </div>

                {/* Threat + Reports row */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-medium">
                        {THREAT_ICONS[alert?.threatCategory]} {alert?.threatCategory}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                        🚩 <span className="font-semibold text-gray-700">{alert?.reportCount}</span> user reports
                    </span>
                </div>

                {/* AI Confidence */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">AI Confidence Score</span>
                        <span className={`text-xs font-bold ${risk?.text}`}>{alert?.aiConfidence}%</span>
                    </div>
                    <ConfidenceBar value={alert?.aiConfidence} riskLevel={alert?.riskLevel} />
                </div>

                {/* Dates */}
                <div className="flex gap-4 mb-3">
                    <div>
                        <p className="text-xs text-gray-400">First Flagged</p>
                        <p className="text-xs font-semibold text-gray-700">{alert?.firstFlagged}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Last Seen Circulating</p>
                        <p className="text-xs font-semibold text-gray-700">{alert?.lastSeen}</p>
                    </div>
                </div>

                {/* Redacted Preview */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                    <p className="text-xs text-gray-400 font-semibold mb-1.5 uppercase tracking-wider">Redacted Document Preview</p>
                    <p className="text-xs text-gray-600 leading-relaxed font-mono">{alert?.redactedPreview}</p>
                </div>

                {/* Scam Indicators */}
                <div className="mb-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1.5">⚠ Key Scam Indicators</p>
                    <div className="flex flex-wrap gap-1.5">
                        {alert?.scamIndicators.map((ind, i) => (
                            <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                                {ind}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Toggle Comments */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-semibold py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    💬 {expanded ? "Hide" : "View"} Community Reports ({alert?.comments?.length})
                    <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded && <CommentSection comments={alert?.comments} alertId={alert?.id} />}
            </div>
        </div>
    );
}

export default AlertCard