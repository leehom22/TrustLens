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
}

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
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredAndSortedFiles = useMemo(() => {
    // Extra safety guard just in case state gets corrupted
    if (!Array.isArray(historyFiles)) return [];

    let result = [...historyFiles];
    
    if (searchQuery) {
      result = result.filter(file => (file.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') result = result.filter(file => file.analysis_status === 'PENDING' || file.analysis_status === 'PROCESSING');
      else if (statusFilter === 'FAILED') result = result.filter(file => file.analysis_status === 'FAILED');
      else result = result.filter(file => file.risk_level?.toUpperCase() === statusFilter && file.analysis_status !== 'FAILED' && file.analysis_status !== 'PENDING');
    }
    
    result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      if (sortOrder === 'highest_risk') return (b.risk_score || 0) - (a.risk_score || 0);
      return 0;
    });
    
    return result;
  }, [historyFiles, searchQuery, statusFilter, sortOrder]);

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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="ALL">{t.filterAll}</option>
                  <option value="CRITICAL">{t.filterCritical}</option>
                  <option value="SUSPICIOUS">{t.filterSuspicious}</option>
                  <option value="SAFE">{t.filterSafe}</option>
                  <option value="PENDING">{t.filterPending}</option>
                  <option value="FAILED">{t.filterFailed}</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
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
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-5">{t.colDocName}</th>
                      <th className="p-5">{t.colDate}</th>
                      <th className="p-5">{t.colStatus}</th>
                      <th className="p-5">{t.colScore}</th>
                      <th className="p-5 text-right">{t.colAction}</th>
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
                                    onClick={() => navigate(`/review-document-analysis/${file.id}`)}
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