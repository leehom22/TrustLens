import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  FileText,
  Eye,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Loader2,
  RotateCcw,
  Trash
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime, statusStyles } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { RiskLevel, RiskLevelColor } from '../types/db-ai-analysis-type';

interface Files {
  id: string,
  fileName: string
  fileUrl: string
  fileSize: number
  created_at: string
  overall_score: number
  risk_level: RiskLevel
  risk_level_color: RiskLevelColor
  analyzedBy: string
}

type RiskLevelFilter = RiskLevel | "All"

const RISK_PRIORITY: Record<string, number> = {
  'CRITICAL': 3,
  'SUSPICIOUS': 2,
  'CAUTION': 1,
  'SAFE': 0,
};

const HistoryPage = (props: { userId: string }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevelFilter>('All');
  const [loading, setLoading] = useState(true)
  const [historyFiles, setHistoryFiles] = useState<Files[]>([])
  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc' as 'asc' | 'desc'
  });

  const userId = props.userId
  const navigate = useNavigate()
  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<boolean>(false)
  const [deleteDocLoading, setDeleteDocLoading] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Adjust as needed

  // Reset to page 1 whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter, sortConfig]);

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
  const filteredData = useMemo(() => {
    // First, filter by search term and risk level
    let filtered = historyFiles.filter((doc) => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
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
  }, [historyFiles, searchTerm, riskFilter, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const fetchingFiles = async () => {
    try {
      // console.log("the user id is ", userId)
      const res = await axios.get(`${backendUrl}/files/get_uploaded_files/${userId}`);
      if (res.data.success) setHistoryFiles(res.data.data)

    } catch (error) {
      toast.error("Failed to fetch files")
      console.log("Failed to fetch files: ", error)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchingFiles()
  }, [userId])

  // --- Action Handler (Placeholder) ---
  const handleViewReport = (docId: string) => {
    // In the future, you will use: navigate(`/analysis/${docId}`);
    navigate(`/review-document-analysis/${docId}`)
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    setConfirmDeleteDoc(true)
    if (confirmDeleteDoc) {
      try {
        setDeleteDocLoading(true)
        const formData = new FormData()
        formData.append('doc_id', docId)
        // console.log("The document id is:", docId)
        const res = await axios.post(`${backendUrl}/files/delete_selected_files`, formData)
        const result = res.data

        if (result.success) {
          toast.success("Successfully delete document")
          await fetchingFiles()
        } else {
          toast.error("Failed to delete document")
        }
      } catch (error) {
        console.log("Failed to delete document: ", error)
      } finally {
        setDeleteDocLoading(false)
      }
    }
  }

  return (
    <>
      {deleteDocLoading === true ? (
        <div className="fixed inset-0 z-[100] flex flex-col gap-4 justify-center items-center backdrop-blur-[2px] transition-opacity duration-300 w-full">
          <div className="p-6 flex flex-col items-center">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Deleting Document...
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans transition-colors duration-200 w-full">
          <div className="max-w-7xl mx-auto">

            {/* --- Page Header --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Analysis History</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  Archive of all documents processed by TrustLens.
                </p>
              </div>
            </div>

            {/* --- Search & Filter Bar --- */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
              {/* Search Input */}
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by filename..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Filter by Risk:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Levels</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="SUSPICIOUS">SUSPICIOUS</option>
                  <option value="CAUTION">CAUTION</option>
                  <option value="SAFE">SAFE</option>
                </select>
              </div>
            </div>

            {/* --- Data Table --- */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

              {/* Header Section */}
              <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-100">
                      Analysis History
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Archive of all documents processed by TrustLens.
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors self-start sm:self-auto"
                  >
                    <RotateCcw size={16} />
                    Reset Filters
                  </button>
                </div>
              </div>

              {/* ── DESKTOP TABLE (md+) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {[
                        { label: 'Document Name', key: 'fileName' },
                        { label: 'Date Analyzed', key: 'created_at' },
                        { label: 'Risk Level', key: 'risk_level' },
                        { label: 'Risk Score', key: 'overall_score' },
                        { label: 'File Size', key: 'fileSize' },
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
                        <tr
                          key={doc.id}
                          className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                        >
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
                              {doc.risk_level || "Low"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                                {doc.overall_score || 0}
                              </span>
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
                          <td className="p-4 text-right">
                            <div className="flex justify-end items-center gap-3">
                              <button
                                onClick={() => handleViewReport(doc.id)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                              >
                                <Eye size={14} />
                                View
                              </button>
                              <button
                                className="cursor-pointer p-1 hover:opacity-70 transition-opacity"
                                onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                              >
                                <Trash color="red" size={20} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-12">
                          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Search size={32} strokeWidth={1.5} />
                            <p className="text-sm font-medium">No documents found matching your filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── MOBILE CARD LIST (< md) ── */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
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
                    <div
                      key={doc.id}
                      className="p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                    >
                      {/* Card Top: icon + name + badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <FileText size={16} />
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                            {doc.fileName}
                          </span>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusStyles[doc.risk_level_color || 'gray']}`}>
                          {doc.risk_level || "Low"}
                        </span>
                      </div>

                      {/* Card Meta */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formatDateTime(doc.created_at)}</span>
                        </div>
                        <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                      </div>

                      {/* Risk Score Bar */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-6">
                          {doc.overall_score || 0}
                        </span>
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
                        <span className="text-xs text-slate-400">risk score</span>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewReport(doc.id)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                        >
                          <Eye size={14} />
                          View Report
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                        >
                          <Trash size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Search size={32} strokeWidth={1.5} />
                    <p className="text-sm font-medium">No documents found matching your filters.</p>
                  </div>
                )}
              </div>

              {/* --- Pagination Footer --- */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-4 border-t border-slate-100 dark:border-slate-800 gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  Showing{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(currentPage * itemsPerPage, filteredData.length)}
                  </span>{" "}
                  of <span className="font-semibold">{filteredData.length}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-9 h-9 rounded-lg text-sm transition-all ${currentPage === i + 1
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
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