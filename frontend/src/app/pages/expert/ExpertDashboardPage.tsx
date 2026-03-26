import React, { useMemo, useState, useEffect } from 'react';
import {
    FileText,
    Clock,
    CheckCircle,
    Search,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import axios from 'axios';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { RiskLevel, RiskLevelColor } from '@/app/types/db-ai-analysis-type';
import { statusStyles } from '@/lib/utils';
import { useLanguage } from '../../components/LanguageProvider';

// --- TYPE DEFINITIONS ---
interface FileDoc {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    created_at: string;
    overall_score: number;
    risk_level: string;
    analyzedBy: string;
    expertReview?: boolean | null;
    risk_level_color?: RiskLevelColor;
}

type RiskLevelFilter = RiskLevel | "All"

const ExpertDashboardPage = () => {
    const [dbDocuments, setDbDocuments] = useState<FileDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [riskFilter, setRiskFilter] = useState<RiskLevelFilter>('All');
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState("");

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const { language } = useLanguage();

    const t = {
        en: {
            title: "Expert Review Dashboard",
            subtitle: "Document Fraud Analysis System",
            reviewNeeded: "Review Needed",
            pendingDesc: "Pending expert analysis.",
            reviewed: "Reviewed",
            reviewedDesc: "Analysis completed.",
            totalFlagged: "Total Flagged Documents",
            highPriority: "High Priority",
            totalDesc: "Total items in flagged queue.",
            chartTitle: "Flagged Document Status",
            chartSubtitle: (total: number) => `Progress on ${total} flagged items`,
            tableTitle: "Flagged Documents",
            searchPlaceholder: "Search by name...",
            reset: "Reset",
            colName: "Name",
            colScore: "Risk Score",
            colLevel: "Risk Level",
            colDate: "Flag Date",
            colStatus: "Status",
            noDocs: "No flagged documents found",
            riskScoreLabel: "risk score"
        },
        ms: {
            title: "Papan Pemuka Semakan Pakar",
            subtitle: "Sistem Analisis Penipuan Dokumen",
            reviewNeeded: "Menunggu Semakan",
            pendingDesc: "Menunggu analisis pakar.",
            reviewed: "Telah Disemak",
            reviewedDesc: "Analisis selesai.",
            totalFlagged: "Jumlah Dokumen Ditanda",
            highPriority: "Keutamaan Tinggi",
            totalDesc: "Jumlah item dalam baris gilir.",
            chartTitle: "Status Dokumen Ditanda",
            chartSubtitle: (total: number) => `Perkembangan untuk ${total} item ditanda`,
            tableTitle: "Dokumen Ditanda",
            searchPlaceholder: "Cari mengikut nama...",
            reset: "Tetapkan Semula",
            colName: "Nama",
            colScore: "Skor Risiko",
            colLevel: "Tahap Risiko",
            colDate: "Tarikh Ditanda",
            colStatus: "Status",
            noDocs: "Tiada dokumen ditanda ditemui",
            riskScoreLabel: "skor risiko"
        }
    }[language];

    const translateRisk = (risk: string) => {
        if (!risk) return language === 'ms' ? 'Rendah' : 'Low';
        switch (risk.toUpperCase()) {
            case 'CRITICAL': return language === 'ms' ? 'Kritikal' : 'Critical';
            case 'SUSPICIOUS': return language === 'ms' ? 'Mencurigakan' : 'Suspicious';
            case 'CAUTION': return language === 'ms' ? 'Awas' : 'Caution';
            case 'SAFE': return language === 'ms' ? 'Selamat' : 'Safe';
            default: return risk;
        }
    };

    // --- 1. FETCH DATA ---
    const fetchDocuments = async () => {
        try {
            const res = await axios.get(`${backendUrl}/files/flagged_document`);
            
            let validData: FileDoc[] = [];
            if (Array.isArray(res.data)) {
                validData = res.data;
            } else if (res.data && Array.isArray(res.data.data)) {
                validData = res.data.data;
            } else if (res.data && Array.isArray(res.data.files)) {
                validData = res.data.files;
            }

            setDbDocuments(validData);
        } catch (error) {
            console.error("Failed to fetch files:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    // --- FIREBASE CONNECTION ADDED HERE ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchDocuments();
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [backendUrl]);

    // --- 2. FILTER & CALCULATE STATS ---
    const { stats, filteredDocuments } = useMemo(() => {
        let filtered = dbDocuments.filter((doc) =>
            (doc.fileName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.risk_level || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

        const reviewNeededCount = dbDocuments.filter(d => !d.expertReview).length;
        const reviewedCount = dbDocuments.filter(d => d.expertReview === true).length;
        const totalFlaggedCount = dbDocuments.length;

        filtered.sort((a, b) => {
            // @ts-ignore
            let aValue = a[sortConfig.key];
            // @ts-ignore
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'created_at') {
                aValue = new Date(aValue || 0).getTime();
                bValue = new Date(bValue || 0).getTime();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return {
            stats: {
                reviewNeeded: reviewNeededCount,
                reviewed: reviewedCount,
                total: totalFlaggedCount
            },
            filteredDocuments: filtered
        };
    }, [dbDocuments, searchTerm, sortConfig]);

    // --- UTILS ---
    const handleReset = () => {
        setSearchTerm("");
        setSortConfig({ key: 'created_at', direction: 'desc' });
    };

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // --- CHART DATA ---
    const chartData = [
        { name: t.reviewed, value: stats.reviewed, color: '#10B981' }, 
        { name: t.reviewNeeded, value: stats.reviewNeeded, color: '#EF4444' }, 
    ];

    const tableCols = [
        { label: '#', key: null },
        { label: t.colName, key: 'fileName' },
        { label: t.colScore, key: 'overall_score' },
        { label: t.colLevel, key: 'risk_level' },
        { label: t.colDate, key: 'created_at' },
        { label: t.colStatus, key: 'expertReview' }
    ];

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                <div className="px-4 sm:px-6 py-3 sm:py-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mt-0.5">{t.subtitle}</p>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 p-4 sm:p-6">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">{t.reviewNeeded}</p>
                            <div className="p-1.5 sm:p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                                <Clock size={16} />
                            </div>
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.reviewNeeded}</p>
                        <p className="text-xs text-gray-400 mt-1 sm:mt-2 hidden sm:block">{t.pendingDesc}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">{t.reviewed}</p>
                            <div className="p-1.5 sm:p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
                                <CheckCircle size={16} />
                            </div>
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.reviewed}</p>
                        <p className="text-xs text-gray-400 mt-1 sm:mt-2 hidden sm:block">{t.reviewedDesc}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm col-span-2 flex items-center justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">{t.totalFlagged}</p>
                                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.highPriority}</span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-gray-400 mt-1 hidden sm:block">{t.totalDesc}</p>
                        </div>
                        <div className="p-2.5 sm:p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full flex-shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                    </div>
                </div>

                <div className="lg:max-w-md w-full bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col">
                    <div className="mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{t.chartTitle}</h3>
                        <p className="text-xs sm:text-sm text-gray-500">{t.chartSubtitle(stats.total)}</p>
                    </div>
                    <div className="flex-1 relative min-h-[180px] sm:min-h-[200px]">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="flex flex-col bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800">
                <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                            {t.tableTitle}
                        </h2>
                        <div className="relative w-full sm:w-72 md:w-80 group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder={t.searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border rounded-lg hover:bg-gray-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                    >
                        <RotateCcw size={16} /> {t.reset}
                    </button>
                </div>

                {filteredDocuments.length > 0 ? (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                                        {tableCols.map((col) => (
                                            <th
                                                key={col.label}
                                                onClick={() => col.key && toggleSort(col.key)}
                                                className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 ${col.key ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {col.label}
                                                    {sortConfig.key === col.key && (
                                                        sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {filteredDocuments.map((doc, index) => (
                                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg flex-shrink-0">
                                                        <FileText size={18} />
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-slate-200 truncate max-w-[200px]" title={doc.fileName}>
                                                        {doc.fileName || 'Untitled Document'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{doc.overall_score || 0}</span>
                                                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${(doc.overall_score || 0) > 70 ? 'bg-red-500' : (doc.overall_score || 0) > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                                                            style={{ width: `${doc.overall_score || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusStyles[doc.risk_level_color || 'gray']}`}>
                                                    {translateRisk(doc.risk_level)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{formatDate(doc.created_at)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-md text-xs font-semibold
                      ${doc.expertReview === true
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                                    {doc.expertReview === true ? t.reviewed : t.reviewNeeded}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredDocuments.map((doc, index) => (
                                <div key={doc.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs text-gray-400 flex-shrink-0">#{index + 1}</span>
                                            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg flex-shrink-0">
                                                <FileText size={15} />
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-slate-200 text-sm truncate" title={doc.fileName}>
                                                {doc.fileName || 'Untitled Document'}
                                            </span>
                                        </div>
                                        <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-md text-xs font-semibold
                  ${doc.expertReview === true
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                            {doc.expertReview === true ? t.reviewed : t.reviewNeeded}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium border text-xs
                  ${doc.risk_level === 'CRITICAL' ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30'
                                                : doc.risk_level === 'SUSPICIOUS' ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30'
                                                    : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-900/30'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusStyles[doc.risk_level_color || 'gray']}`} />
                                            {translateRisk(doc.risk_level)}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500">{formatDate(doc.created_at)}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-700 dark:text-slate-300 w-6">{doc.overall_score || 0}</span>
                                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${(doc.overall_score || 0) > 70 ? 'bg-red-500' : (doc.overall_score || 0) > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                                                style={{ width: `${doc.overall_score || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400">{t.riskScoreLabel}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-gray-500 dark:text-slate-400">
                        <Search className="h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 opacity-20" />
                        <p className="text-base sm:text-lg font-medium">{t.noDocs}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExpertDashboardPage;