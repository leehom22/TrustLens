import { DOC_ICONS, RISK_CONFIG, THREAT_ICONS } from '@/lib/scamAlert';
import React, { useState } from 'react'
import CommentSection from './CommentSection';
import ConfidenceBar from './ConfidenceBar';
import { useLanguage } from "@/app/components/LanguageProvider"; // Ensure this path is correct for your structure
import { AlertTriangle } from 'lucide-react';
import DisputeModal from './DisputeModal';
import axios from 'axios';
import { toast } from 'sonner';

const AlertCard = ({ alert }: { alert: ScamAlert }) => {
    const [expanded, setExpanded] = useState(false);
    // Dispute State
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeReason, setDisputeReason] = useState("");
    const [disputeFile, setDisputeFile] = useState<File | null>(null);
    const [isDisputing, setIsDisputing] = useState(false);
    const { language } = useLanguage();
    const risk = RISK_CONFIG[alert.riskLevel];
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // --- LANGUAGE CONTEXT ---
    const t = {
        en: {
            successDispute: "Dispute submitted successfully for review.",
            errReason: "Please provide a reason for the dispute.",
            aiVerified: "AI Verified",
            userReports: "user reports",
            aiConfidence: "AI Confidence Score",
            firstFlagged: "First Flagged",
            lastSeen: "Last Seen Circulating",
            preview: "Redacted Document Preview",
            indicators: "Key Scam Indicators",
            disputeAlert: "Dispute Alert",
            hide: "Hide",
            view: "View",
            commReports: "Community Reports",
            // Dynamic DB value translations
            riskLevels: {
                "CRITICAL": "CRITICAL",
                "HIGH": "HIGH",
                "CAUTION": "CAUTION",
                "LOW": "LOW",
                "SAFE": "SAFE"
            },
            threats: {
                "Phishing": "Phishing",
                "Impersonation": "Impersonation",
                "Fake Authority": "Fake Authority",
                "Fraud": "Fraud",
                "Identity Theft": "Identity Theft"
            }
        },
        ms: {
            errDispute: "Gagal menghantar pertikaian. Sila cuba lagi.",
            errReason: "Sila berikan sebab untuk pertikaian ini.",
            aiVerified: "Disahkan AI",
            disputeAlert: "Pertikai Amaran",
            userReports: "laporan pengguna",
            aiConfidence: "Skor Keyakinan AI",
            firstFlagged: "Mula Dilaporkan",
            lastSeen: "Terakhir Dilihat Beredar",
            preview: "Pratonton Dokumen Disunting",
            indicators: "Petunjuk Penipuan Utama",
            hide: "Sembunyikan",
            view: "Lihat",
            commReports: "Laporan Komuniti",
            // Dynamic DB value translations
            riskLevels: {
                "CRITICAL": "KRITIKAL",
                "HIGH": "TINGGI",
                "CAUTION": "AWAS",
                "LOW": "RENDAH",
                "SAFE": "SELAMAT"
            },
            threats: {
                "Phishing": "Pancingan Data",
                "Impersonation": "Penyamaran",
                "Fake Authority": "Pihak Berkuasa Palsu",
                "Fraud": "Penipuan",
                "Identity Theft": "Kecurian Identiti"
            }
        }
    }[language];

    // --- HANDLE DISPUTE ---
    const handleDisputeSubmit = async () => {
        if (!disputeReason.trim()) {
            toast.error(t.errReason);
            return;
        }

        try {
            setIsDisputing(true);
            const formData = new FormData();
            formData.append("reason", disputeReason);
            if (disputeFile) {
                formData.append("evidence_file", disputeFile);
            }

            await axios.post(`${backendUrl}/scam-alert/${alert?.id}/dispute`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toast.success(t.successDispute);
            setShowDisputeModal(false);
            setDisputeReason("");
            setDisputeFile(null);
        } catch (error) {
            console.error(error);
            toast.error(t.errDispute);
        } finally {
            setIsDisputing(false);
        }
    };

    // Safe fallbacks in case the DB sends a category we haven't mapped
    const displayRisk = t.riskLevels[alert.riskLevel as keyof typeof t.riskLevels] || alert.riskLevel;
    const displayThreat = t.threats[alert.threatCategory as keyof typeof t.threats] || alert.threatCategory;

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl border ${risk?.border} dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden`}>
            {/* Header strip */}
            <div className={`${risk?.bg} dark:bg-opacity-20 px-4 py-2.5 flex items-center justify-between border-b ${risk?.border} dark:border-slate-700`}>
                <div className="flex items-center gap-2">
                    {alert.verified && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                            ✓ {t.aiVerified}
                        </span>
                    )}
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${risk?.text} ${risk?.bg} ${risk?.border} dark:bg-slate-900/40`}>
                    {displayRisk}
                </span>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">
                        {alert?.title}
                    </h3>
                    <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        📍 {alert?.state}
                    </span>
                </div>
                <div className='flex justify-end'>
                    <button
                        onClick={() => setShowDisputeModal(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t.disputeAlert}
                    </button>
                </div>
                {/* Threat + Reports row */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2.5 py-0.5 rounded-full font-medium">
                        {THREAT_ICONS[alert?.threatCategory]} {displayThreat}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                        🚩 <span className="font-semibold text-gray-700 dark:text-slate-200">{alert?.reportCount}</span> {t.userReports}
                    </span>
                </div>

                {/* AI Confidence */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-slate-400">{t.aiConfidence}</span>
                        <span className={`text-xs font-bold ${risk?.text}`}>{alert?.aiConfidence}%</span>
                    </div>
                    <ConfidenceBar value={alert?.aiConfidence} riskLevel={alert?.riskLevel} />
                </div>

                {/* Dates */}
                <div className="flex gap-4 mb-3">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{t.firstFlagged}</p>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{alert?.firstFlagged}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{t.lastSeen}</p>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{alert?.lastSeen}</p>
                    </div>
                </div>

                {/* Redacted Preview */}
                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 mb-3 border border-gray-100 dark:border-slate-700/50">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold mb-1.5 uppercase tracking-wider">
                        {t.preview}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed font-mono">
                        {alert?.redactedPreview}
                    </p>
                </div>

                {/* Scam Indicators */}
                <div className="mb-3">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-1.5">
                        ⚠ {t.indicators}
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
                    💬 {expanded ? t.hide : t.view} {t.commReports} ({alert?.comments?.length})
                    <span className="text-gray-400 dark:text-slate-500">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded && <CommentSection comments={alert?.comments} alertId={alert?.id} />}
            </div>
            {/* --- DISPUTE MODAL --- */}
            {showDisputeModal && (
                <DisputeModal
                    disputeReason={disputeReason}
                    handleDisputeSubmit={handleDisputeSubmit}
                    setDisputeFile={setDisputeFile}
                    isDisputing={isDisputing}
                    setDisputeReason={setDisputeReason}
                    setIsDisputing={setIsDisputing}
                    setShowDisputeModal={setShowDisputeModal}
                />
            )}
        </div>
    );
}

export default AlertCard