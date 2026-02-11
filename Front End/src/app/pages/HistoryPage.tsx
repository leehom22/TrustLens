import React, { useEffect, useState } from 'react';
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
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime, getRiskColor } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Files {
  id: string,
  fileName: string,
  fileUrl: string
  fileSize: number
  created_at: string
  riskScore: number
  riskLevel: string
  analyzedBy: string
}

const HistoryPage = (props: { userId: string }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [loading, setLoading] = useState(true)
  const [historyFiles, setHistoryFiles] = useState<Files[]>([])
  const userId = props.userId
  const navigate = useNavigate()
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const fetchingFiles = async () => {
    try {
      console.log("the user id is ", userId)
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

  // --- Filter Logic ---
  const filteredData = (historyFiles || []).filter(doc => {
    const matchesSearch = doc.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'All' || doc.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });



  // --- Action Handler (Placeholder) ---
  const handleViewReport = (docId: string) => {
    // In the future, you will use: navigate(`/analysis/${docId}`);
    navigate(`/review-document/${docId}`)
  };

  return (

    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans  transition-colors duration-200 w-370">
      <div className="max-w-7xl mx-auto">

        {/* --- Page Header --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Analysis History</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Archive of all documents processed by TrustLens.</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4 font-semibold">Document Name</th>
                  <th className="p-4 font-semibold">Date Analyzed</th>
                  <th className="p-4 font-semibold">Risk Level</th>
                  <th className="p-4 font-semibold">Risk Score</th>
                  <th className="p-4 font-semibold">File Size</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {loading ? (
                  /* 1. Optimized Loading State: Prevents layout shift */
                  [...Array(5)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div></td>
                      <td className="p-4"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-16"></div></td>
                      <td className="p-4"><div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12"></div></td>
                      <td className="p-4"><div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredData.length > 0 ? (
                  /* 2. Actual Data Rendering */
                  filteredData.map((doc) => (
                    <tr key={doc.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                          <FileText size={18} />
                        </div>
                        <span className="truncate max-w-[200px]">{doc.fileName}</span>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {formatDateTime(doc.created_at)}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(doc.riskLevel)}`}>
                          {doc.riskLevel || "Low"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300 w-6">{doc.riskScore}</span>
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${doc.riskScore > 70 ? 'bg-red-500' : doc.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                              style={{ width: `${doc.riskScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {(doc.fileSize / 1024).toFixed(1)} KB
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleViewReport(doc.id)}
                          className="inline-flex items-center gap-2 ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  /* 3. Empty State: Only shows if NOT loading and data is empty */
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Search size={32} strokeWidth={1} />
                        <p>No documents found matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* --- Pagination Footer --- */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
            <span>Showing {filteredData.length} results</span>
            <div className="flex gap-2">
              <button className="p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

};

export default HistoryPage;