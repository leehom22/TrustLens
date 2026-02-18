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
  Trash,
  Check,
  CheckCheck
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime, getRiskColor, statusStyles } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { FileHeader, RiskLevel, RiskLevelColor } from '@/app/types/db-ai-analysis-type';

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

const ReviewDocumentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
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
      const matchesRisk = riskFilter === "All" || doc.riskLevel === riskFilter;
      return matchesSearch && matchesRisk;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key as keyof Files];
      let bValue = b[sortConfig.key as keyof Files];

      if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
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
      console.log("Data from flagged files: ", res.data.files)
      if (res.data.success) setFlaggedFile(res.data.files)

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
      {
        deleteDocLoading === true ?
          <div className="fixed inset-0 z-[100] flex flex-col gap-4 justify-center items-centerbackdrop-blur-[2px] transition-opacity duration-300">
            <div className=" p-6  flex flex-col items-center ">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
              <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Deleting Document...
              </p>
            </div>
          </div>
          :
          <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans  transition-colors duration-200 w-370">
            <div className="max-w-7xl mx-auto">

              {/* --- Page Header --- */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Flagged Document</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Flagged for Manual Review</p>
                </div>
              </div>

              {/* --- Search & Filter Bar --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">

                {/* Search Input */}
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
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
                  <Filter size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Filter by Risk:</span>
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All Levels</option>
                    <option value="High">High Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="Low">Low Risk</option>
                  </select>
                </div>
              </div>

              {/* --- Data Table --- */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        Flagged Document
                      </h1>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Flagged for Manual Review.
                      </p>
                    </div>

                    {/* Reset Button */}
                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <RotateCcw size={16} />
                      Reset Filters
                    </button>
                  </div>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        {/* Document Name Column */}
                        <th
                          onClick={() => toggleSort('fileName')}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            Document Name
                            {sortConfig.key === 'fileName' && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* Date Analyzed Column */}
                        <th
                          onClick={() => toggleSort('created_at')}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            Date Analyzed
                            {sortConfig.key === 'created_at' && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* Risk Level Column */}
                        <th
                          onClick={() => toggleSort('riskLevel')}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            Risk Level
                            {sortConfig.key === 'riskLevel' && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* Risk Score Column */}
                        <th
                          onClick={() => toggleSort('riskScore')}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            Risk Score
                            {sortConfig.key === 'riskScore' && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* File Size Column */}
                        <th
                          onClick={() => toggleSort('fileSize')}
                          className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            File Size
                            {sortConfig.key === 'fileSize' && (
                              <span className="text-xs">
                                {sortConfig.direction === 'desc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* Actions Column */}
                        <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading ? (
                        /* Loading State */
                        [...Array(5)].map((_, i) => (
                          <tr key={`skeleton-${i}`} className="animate-pulse">
                            <td className="p-4">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                            </td>
                            <td className="p-4">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                            </td>
                            <td className="p-4">
                              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
                            </td>
                            <td className="p-4">
                              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                            </td>
                            <td className="p-4">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                            </td>
                            <td className="p-4">
                              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20 ml-auto" />
                            </td>
                          </tr>
                        ))
                      ) : paginatedData.length > 0 ? (
                        /* Data Rows */
                        paginatedData.map((doc) => (
                          <tr
                            key={doc.id}
                            className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                          >
                            {/* Document Name */}
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

                            {/* Date */}
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Calendar size={14} className="flex-shrink-0" />
                                <span>{formatDateTime(doc.created_at)}</span>
                              </div>
                            </td>

                            {/* Risk Level */}
                            <td className="p-4">
                              <span
                                className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusStyles[doc.risk_level_color || 'gray']}}`}
                              >
                                {doc.risk_level || "Low"}
                              </span>
                            </td>

                            {/* Risk Score */}
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="w-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                                  {doc.overall_score}
                                </span>
                                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${doc.overall_score > 70
                                      ? 'bg-red-500'
                                      : doc.overall_score > 40
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                      }`}
                                    style={{ width: `${doc.overall_score}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* File Size */}
                            <td className="p-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                              {(doc.fileSize / 1024).toFixed(1)} KB
                            </td>

                            {/* Actions */}
                            <td className="p-4">
                              <div className='flex items-center justify-end gap-3'>
                                <button
                                  onClick={() => handleViewReport(doc.id)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                                <button className='cursor-pointer'>
                                  {
                                    doc.expertReview === true ? (
                                      <div className='tooltip' data-tip="Waiting for review">
                                        <CheckCheck size={20} color='green' />
                                      </div>

                                    ) : (
                                      <div className='tooltip' data-tip="Already reviewed">
                                        <Check size={20} />
                                      </div>
                                    )
                                  }
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        /* Empty State */
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

                {/* Pagination Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                   Page {currentPage} of {totalPages}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      disabled
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    disabled={currentPage === 1}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

      }
    </>
  )

};

export default ReviewDocumentList;