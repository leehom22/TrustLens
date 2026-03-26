import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, FileText, Eye, Calendar, ChevronLeft, ChevronRight, Loader2, RotateCcw, Trash } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { RiskLevel, RiskLevelColor } from '../types/db-ai-analysis-type';
import { useLanguage } from '../components/LanguageProvider';

interface Files {
  id: string,
  fileName: string
  fileUrl: string
  fileSize: number
  created_at: string
  risk_score: number
  risk_level: RiskLevel
  risk_level_color: RiskLevelColor
  analysis_status: string
  flagged: boolean
  master_doc_id: string
}

type RiskLevelFilter = RiskLevel | "All"

const RISK_PRIORITY: Record<string, number> = {
  'CRITICAL': 3,
  'SUSPICIOUS': 2,
  'CAUTION': 1,
  'SAFE': 0,
};

// Internal Helper
const formatDateTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const HistoryPage = ({ userId }: { userId: string }) => {
  const [historyFiles, setHistoryFiles] = useState<Files[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest_risk'>('newest');
  const [riskFilter, setRiskFilter] = useState<RiskLevelFilter>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc' as 'asc' | 'desc'
  });
  const itemsPerPage = 6;
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const { language } = useLanguage();

  const t = {
    en: {
      title: 'Analysis History',
      subtitle: 'View and manage your previously analyzed documents',
      searchPlaceholder: 'Search documents...',
      filterAll: 'All Status',
      filterCritical: 'Critical Risk',
      filterSafe: 'Safe',
      filterSuspicious: 'Suspicious',
      filterPending: 'Pending',
      filterFailed: 'Failed',
      sortNewest: 'Newest First',
      reset: 'reset',
      sortOldest: 'Oldest First',
      sortHighestRisk: 'Highest Risk',
      colDocName: 'Document Name',
      colDate: 'Upload Date',
      colStatus: 'Status / Risk',
      colScore: 'Score',
      colAction: 'Action',
      btnView: 'View Report',
      btnRetry: 'Retry',
      btnDelete: 'Delete',
      noDocs: 'No documents found matching your criteria.'
    },
    ms: {
      title: 'Sejarah Analisis',
      subtitle: 'Lihat dan urus dokumen yang telah dianalisis',
      searchPlaceholder: 'Cari dokumen...',
      filterAll: 'Semua Status',
      filterCritical: 'Risiko Kritikal',
      filterSafe: 'Selamat',
      filterSuspicious: 'Mencurigakan',
      filterPending: 'Menunggu',
      filterFailed: 'Gagal',
      sortNewest: 'Paling Baru',
      sortOldest: 'Paling Lama',
      sortHighestRisk: 'Risiko Tertinggi',
      colDocName: 'Nama Dokumen',
      colDate: 'Tarikh Muat Naik',
      colStatus: 'Status / Risiko',
      colScore: 'Skor',
      colAction: 'Tindakan',
      btnView: 'Lihat Laporan',
      btnRetry: 'Cuba Semula',
      btnDelete: 'Padam',
      noDocs: 'Tiada dokumen yang sepadan ditemui.'
    }
  }[language];

  // Add toggle sort function
  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSortDropdownChange = (value: string) => {
    if (value === 'newest') setSortConfig({ key: 'created_at', direction: 'desc' });
    else if (value === 'oldest') setSortConfig({ key: 'created_at', direction: 'asc' });
    else if (value === 'highest_risk') setSortConfig({ key: 'risk_score', direction: 'desc' });
  };

  const fetchHistoryFiles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${backendUrl}/files/get_history_files/${userId}`);
      // CRASH FIX: Guarantee we only set an array to state
      let validData: Files[] = [];
      if (Array.isArray(res.data)) {
        validData = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        validData = res.data.data;
      }

      setHistoryFiles(validData);
    } catch (error) {
      console.log('Error fetching history: ', error);
      toast.error('Failed to load history data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryFiles();
  }, [userId]);

  // Reset to page 1 whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, riskFilter, sortConfig]);

  const handleDelete = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const formData = new FormData();
      formData.append("doc_id", docId);
      const res = await axios.post(`${backendUrl}/files/delete_selected_files`, formData);
      if (res.data.success) {
        toast.success("Document deleted successfully");
        fetchHistoryFiles();
      }
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const handleRetry = async (docId: string) => {
    toast.info("Retrying analysis...");
    try {
      await axios.post(`${backendUrl}/analysis/trigger/${docId}`);
      toast.success("Analysis triggered. Check back later.");
      fetchHistoryFiles();
    } catch (error) {
      toast.error("Failed to trigger analysis.");
    }
  };

  // Add reset function
  const handleReset = () => {
    setSearchQuery("");
    setRiskFilter("All");
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };

  const filteredAndSortedFiles = useMemo(() => {
    // First, filter by search term and risk level
    let filtered = historyFiles.filter((doc) => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = riskFilter === "All" || doc.risk_level === riskFilter;
      return matchesSearch && matchesRisk;
    });

    // Then, sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Files];
      let bValue: any = b[sortConfig.key as keyof Files];

      if (sortConfig.key === 'risk_level') {
        // We compare the numeric weights instead of the strings
        aValue = RISK_PRIORITY[aValue as string] ?? -1;
        bValue = RISK_PRIORITY[bValue as string] ?? -1;
      }
      // -------------------------------------

      // Handle date sorting
      else if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle numeric sorting
      else if (sortConfig.key === 'overall_score' || sortConfig.key === 'fileSize') {
        aValue = Number(aValue || 0);
        bValue = Number(bValue || 0);
      }

      // Standard comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [historyFiles, searchQuery, riskFilter, sortConfig]);


  const totalPages = Math.ceil(filteredAndSortedFiles.length / itemsPerPage);
  const currentData = filteredAndSortedFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (file: Files) => {
    if (file.analysis_status === "FAILED") {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Failed</span>;
    }
    if (file.analysis_status === "PENDING" || file.analysis_status === "PROCESSING") {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</span>;
    }

    let colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    if (file.risk_level === 'CRITICAL') colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    if (file.risk_level === 'SUSPICIOUS') colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
    if (file.risk_level === 'CAUTION') colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";

    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>{file.risk_level || 'SAFE'}</span>;
  };

  return (
    <>
      {loading ? (
        <div className="w-full h-[60vh] flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading history...</p>
        </div>
      ) : (
        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans transition-colors duration-300">
          <div className="max-w-7xl mx-auto space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t.title}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 transition-colors">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={handleReset} className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors">
                  {t.reset}
                </button>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                >
                  <option value="ALL">{t.filterAll}</option>
                  <option value="CRITICAL">{t.filterCritical}</option>
                  <option value="SUSPICIOUS">{t.filterSuspicious}</option>
                  <option value="SAFE">{t.filterSafe}</option>
                  <option value="PENDING">{t.filterPending}</option>
                  <option value="FAILED">{t.filterFailed}</option>
                </select>

                <select
                  // Determine dropdown value based on sortConfig
                  value={sortConfig.key === 'risk_score' ? 'highest_risk' : sortConfig.direction === 'desc' ? 'newest' : 'oldest'}
                  onChange={(e) => handleSortDropdownChange(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                >
                  <option value="newest">{t.sortNewest}</option>
                  <option value="oldest">{t.sortOldest}</option>
                  <option value="highest_risk">{t.sortHighestRisk}</option>
                </select>
              </div>

            </div>

            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {[
                        { label: t.colDocName, key: 'fileName' },
                        { label: t.colDate, key: 'created_at' },
                        { label: t.colStatus, key: 'risk_level' },
                        // { label: t.colScore, key: 'overall_score' },
                        { label: t.colScore, key: 'fileSize' },
                      ].map(({ label, key }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            {label}
                            {sortConfig.key === key && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {currentData.length > 0 ? (
                      currentData.map((file) => {
                        const isProcessed = file.analysis_status !== "FAILED" && file.analysis_status !== "PENDING" && file.analysis_status !== "PROCESSING";

                        return (
                          <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group">
                            <td className="p-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-800/50">
                                  <FileText size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">{file.fileName || 'Untitled Document'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{((file.fileSize || 0) / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Calendar size={14} className="opacity-70" />
                                {formatDateTime(file.created_at)}
                              </div>
                            </td>
                            <td className="p-5">
                              {getStatusBadge(file)}
                            </td>
                            <td className="p-5">
                              {isProcessed ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-6">{file.risk_score || 0}</span>
                                  <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${(file.risk_score || 0) > 70 ? 'bg-red-500' : (file.risk_score || 0) > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                                      style={{ width: `${file.risk_score || 0}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-5 text-right">
                              <div className="flex justify-end gap-2">
                                {isProcessed && (
                                  <button
                                    onClick={() => navigate(`/review-document-analysis/${file.id}/${file.master_doc_id}`)}
                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                                    title={t.btnView}
                                  >
                                    <Eye size={18} />
                                  </button>
                                )}
                                {file.analysis_status === "FAILED" && (
                                  <button
                                    onClick={() => handleRetry(file.id)}
                                    className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                    title={t.btnRetry}
                                  >
                                    <RotateCcw size={18} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(file.id)}
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                  title={t.btnDelete}
                                >
                                  <Trash size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-16 text-center text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Search className="w-10 h-10 opacity-20" />
                            <p className="text-sm">{t.noDocs}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                <span>Showing {currentData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedFiles.length)} of {filteredAndSortedFiles.length}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={18} />
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

export default HistoryPage;