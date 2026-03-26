import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  FileText,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Check,
  CheckCheck
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime, statusStyles } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { FileHeader, RiskLevel, RiskLevelColor } from '@/app/types/db-ai-analysis-type';
import { useLanguage } from '@/app/components/LanguageProvider';

interface Files {
  id: string,
  fileName: string,
  fileUrl: string
  fileSize: number
  created_at: string
  overall_score: number
  risk_level: RiskLevel
  risk_level_color: RiskLevelColor
  analyzedBy: string
  expertReview?: boolean | null
}

type RiskLevelFilter = RiskLevel | "All"

const RISK_PRIORITY: Record<string, number> = {
  'CRITICAL': 3,
  'SUSPICIOUS': 2,
  'CAUTION': 1,
  'SAFE': 0,
};

const ReviewDocumentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevelFilter>('All');
  const [loading, setLoading] = useState(true)
  const [flaggedFile, setFlaggedFile] = useState<Files[] | null>(null)
  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc' as 'asc' | 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const navigate = useNavigate()
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const [deleteDocLoading, setDeleteDocLoading] = useState<boolean>(false)

  // --- LANGUAGE CONTEXT ---
  const { language } = useLanguage();
  const t = {
    en: {
      deleting: "Deleting Document...",
      title: "Flagged Documents",
      subtitle: "Flagged for Manual Review",
      searchPlaceholder: "Search by filename...",
      filterByRisk: "Filter by Risk:",
      allLevels: "All Levels",
      resetFilters: "Reset Filters",
      colDocName: "Document Name",
      colDate: "Date Analyzed",
      colRiskLevel: "Risk Level",
      colRiskScore: "Risk Score",
      colFileSize: "File Size",
      colActions: "Actions",
      btnView: "View",
      btnViewReport: "View Report",
      statusReviewed: "Reviewed",
      statusPending: "Pending",
      statusNeeded: "Needed",
      tooltipReviewed: "Already reviewed",
      tooltipPending: "Waiting for review",
      noDocs: "No documents found matching your filters.",
      page: "Page",
      of: "of",
      riskScoreLabel: "risk score"
    },
    ms: {
      deleting: "Memadam Dokumen...",
      title: "Dokumen Ditanda",
      subtitle: "Ditanda untuk Semakan Manual",
      searchPlaceholder: "Cari mengikut nama fail...",
      filterByRisk: "Tapis ikut Risiko:",
      allLevels: "Semua Tahap",
      resetFilters: "Tetapkan Semula",
      colDocName: "Nama Dokumen",
      colDate: "Tarikh Dianalisis",
      colRiskLevel: "Tahap Risiko",
      colRiskScore: "Skor Risiko",
      colFileSize: "Saiz Fail",
      colActions: "Tindakan",
      btnView: "Lihat",
      btnViewReport: "Lihat Laporan",
      statusReviewed: "Telah Disemak",
      statusPending: "Menunggu",
      statusNeeded: "Diperlukan",
      tooltipReviewed: "Telah disemak",
      tooltipPending: "Menunggu semakan",
      noDocs: "Tiada dokumen yang sepadan ditemui.",
      page: "Muka Surat",
      of: "daripada",
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

  // Add toggle sort function
  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Add reset function
  const handleReset = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };

  // Update your filteredData logic to include sorting
  const { totalPages, paginatedData } = useMemo(() => {
    let filtered = flaggedFile ? [...flaggedFile] : [];

    // 1. Filter
    filtered = filtered.filter((doc) => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = riskFilter === "All" || doc.risk_level === riskFilter;
      return matchesSearch && matchesRisk;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key as keyof Files];
      let bValue = b[sortConfig.key as keyof Files];

      if (sortConfig.key === 'risk_level') {
        // We compare the numeric weights instead of the strings
        aValue = RISK_PRIORITY[aValue as string] ?? -1;
        bValue = RISK_PRIORITY[bValue as string] ?? -1;
      }
      else if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      // Handle numeric sorting
      else if (sortConfig.key === 'overall_score' || sortConfig.key === 'fileSize') {
        aValue = Number(aValue || 0);
        bValue = Number(bValue || 0);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    // 3. Paginate
    const total = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const sliced = filtered.slice(start, start + ITEMS_PER_PAGE);

    return { totalPages: total, paginatedData: sliced };
  }, [flaggedFile, searchTerm, riskFilter, sortConfig, currentPage]);

  const fetchingFiles = async () => {
    try {
      const res = await axios.get(`${backendUrl}/files/flagged_document`);
      // console.log("Data from flagged files: ", res.data.files)
      if (res.data.success) {
        setFlaggedFile(res.data.files)
      }

    } catch (error) {
      toast.error("Failed to fetch files")
      console.log("Failed to fetch files: ", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchingFiles()
  }, [])

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter]);

  // --- Action Handler (Placeholder) ---
  const handleViewReport = (docId: string) => {
    // In the future, you will use: navigate(`/analysis/${docId}`);
    navigate(`/review-document/${docId}`)
  };

  return (
    <>
      {deleteDocLoading === true ? (
        <div className="fixed inset-0 z-[100] flex flex-col gap-4 justify-center items-center backdrop-blur-[2px] transition-opacity duration-300">
          <div className="p-6 flex flex-col items-center">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t.deleting}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans transition-colors duration-200 w-full">
          <div className="max-w-7xl mx-auto">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.title}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.subtitle}</p>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.filterByRisk}</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value as RiskLevelFilter)}
                  className="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">{t.allLevels}</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="SUSPICIOUS">SUSPICIOUS</option>
                  <option value="CAUTION">CAUTION</option>
                  <option value="SAFE">SAFE</option>
                </select>
              </div>
            </div>

            {/* Data Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

              {/* Card Header */}
              <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100">{t.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}.</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RotateCcw size={16} />
                    {t.resetFilters}
                  </button>
                </div>
              </div>

              {/* ── DESKTOP TABLE (md+) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {[
                        { label: t.colDocName, key: 'fileName' },
                        { label: t.colDate, key: 'created_at' },
                        { label: t.colRiskLevel, key: 'risk_level' },
                        { label: t.colRiskScore, key: 'overall_score' },
                        { label: t.colFileSize, key: 'fileSize' },
                      ].map(({ label, key }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            {label}
                            {sortConfig.key === key && (
                              <span className="text-xs">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        {t.colActions}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={`skeleton-${i}`} className="animate-pulse">
                          <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" /></td>
                          <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" /></td>
                          <td className="p-4"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" /></td>
                          <td className="p-4"><div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-24" /></td>
                          <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12" /></td>
                          <td className="p-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20 ml-auto" /></td>
                        </tr>
                      ))
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map((doc) => (
                        <tr key={doc.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                <FileText size={18} />
                              </div>
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                {doc.fileName}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                              <Calendar size={14} className="flex-shrink-0" />
                              <span>{formatDateTime(doc.created_at)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusStyles[doc.risk_level_color || 'gray']}`}>
                              {translateRisk(doc.risk_level)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 text-sm font-bold text-slate-700 dark:text-slate-300">{doc.overall_score || 0}</span>
                              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${doc.overall_score > 70 ? 'bg-red-500'
                                      : doc.overall_score > 40 ? 'bg-yellow-500'
                                        : doc.overall_score > 0 ? 'bg-green-500'
                                          : 'bg-slate-400'
                                    }`}
                                  style={{ width: `${doc.overall_score || 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                            {(doc.fileSize / 1024).toFixed(1)} KB
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => handleViewReport(doc.id)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                              >
                                <Eye size={14} />
                                {t.btnView}
                              </button>
                              <div className="tooltip" data-tip={doc.expertReview === true ? t.tooltipReviewed : t.tooltipPending}>
                                {doc.expertReview === true
                                  ? <CheckCheck size={20} color="green" />
                                  : <Check size={20} className="text-slate-400" />
                                }
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-12">
                          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Search size={32} strokeWidth={1.5} />
                            <p className="text-sm font-medium">{t.noDocs}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── MOBILE CARD LIST (< md) ── */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 space-y-3">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={`m-skeleton-${i}`} className="p-4 animate-pulse space-y-3">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                    </div>
                  ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((doc) => (
                    <div key={doc.id} className="p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">

                      {/* Filename + risk badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <FileText size={15} />
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                            {doc.fileName}
                          </span>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusStyles[doc.risk_level_color || 'gray']}`}>
                          {translateRisk(doc.risk_level)}
                        </span>
                      </div>

                      {/* Date + file size */}
                      <div className="flex items-center justify-between gap-2 mb-3 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          <span>{formatDateTime(doc.created_at)}</span>
                        </div>
                        <span className="font-mono">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                      </div>

                      {/* Risk score bar */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-6">{doc.overall_score || 0}</span>
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${doc.overall_score > 70 ? 'bg-red-500'
                                : doc.overall_score > 40 ? 'bg-yellow-500'
                                  : doc.overall_score > 0 ? 'bg-green-500'
                                    : 'bg-slate-400'
                              }`}
                            style={{ width: `${doc.overall_score || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{t.riskScoreLabel}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewReport(doc.id)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                        >
                          <Eye size={14} />
                          {t.btnViewReport}
                        </button>
                        <div
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium border-slate-200 dark:border-slate-700"
                          title={doc.expertReview === true ? t.tooltipReviewed : t.tooltipPending}
                        >
                          {doc.expertReview === true ? (
                            <><CheckCheck size={15} color="green" /><span className="text-green-600">{t.statusReviewed}</span></>
                          ) : (
                            <><Check size={15} className="text-slate-400" /><span className="text-slate-500">{t.statusPending}</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Search size={32} strokeWidth={1.5} />
                    <p className="text-sm font-medium">{t.noDocs}</p>
                  </div>
                )}
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t.page} {currentPage} {t.of} {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

};

export default ReviewDocumentList;