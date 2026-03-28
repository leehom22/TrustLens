import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackType = 'HIGH' | 'LOW';
type StatusType = 'REVIEW' | 'SCAM' | 'PENDING';
type RiskLevelFilter = 'All' | 'CRITICAL' | 'HIGH' | 'CAUTION' | 'LOW';
type SortKey = 'title' | 'queued_at' | 'ai_confidence' | 'avg_score' | 'report_count';
type SortDir = 'asc' | 'desc';

interface ScamFile {
  queue_id:         string;
  masterDocId:      string;
  title:            string;
  document_type:    string;
  fileUrl:          string;
  threat_category:  string;
  track:            TrackType;
  ai_confidence:    number;
  avg_score:        number;
  report_count:     number;
  states:           string[];
  is_national:      boolean;
  queued_at:        string;
  notes:            string;
  scam_indicators:  string[];
  redacted_preview: string;
  reasoning:        string;
  status:           StatusType;
}

interface SortConfig {
  key:       SortKey;
  direction: SortDir;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;

const RISK_FILTER_OPTIONS: { label: string; value: RiskLevelFilter }[] = [
  { label: 'All Levels',  value: 'All'      },
  { label: 'CRITICAL',    value: 'CRITICAL'  },
  { label: 'HIGH',        value: 'HIGH'      },
  { label: 'CAUTION',     value: 'CAUTION'   },
  { label: 'LOW',         value: 'LOW'       },
];

const SORT_COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Document Name', key: 'title'         },
  { label: 'Queued At',     key: 'queued_at'     },
  { label: 'AI Confidence', key: 'ai_confidence' },
  { label: 'Avg Score',     key: 'avg_score'     },
  { label: 'Reports',       key: 'report_count'  },
];

// ─── Helper: Risk score bar colour ───────────────────────────────────────────

function scoreBarClass(score: number): string {
  if (score > 70) return 'bg-red-500';
  if (score > 40) return 'bg-yellow-500';
  if (score > 0)  return 'bg-green-500';
  return 'bg-slate-400';
}

// ─── Helper: Track badge ──────────────────────────────────────────────────────

function TrackBadge({ track }: { track: TrackType }) {
  const styles = track === 'HIGH'
    ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
    : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border ${styles}`}>
      {track}
    </span>
  );
}

// ─── Helper: Status indicator ────────────────────────────────────────────────

function StatusIndicator({ status }: { status: StatusType }) {
  if (status === 'SCAM') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCheck size={13} />
        <span>Confirmed</span>
      </div>
    );
  }
  if (status === 'REVIEW') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-xs font-medium text-orange-600 dark:text-orange-400">
        <AlertTriangle size={13} />
        <span>In Review</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
      <Check size={13} />
      <span>Pending</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ScamManagementList = () => {
  const navigate    = useNavigate();
  const backendUrl  = import.meta.env.VITE_BACKEND_URL;

  const [searchTerm,   setSearchTerm]   = useState('');
  const [riskFilter,   setRiskFilter]   = useState<RiskLevelFilter>('All');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [flaggedFiles, setFlaggedFiles] = useState<ScamFile[]>([]);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [sortConfig,   setSortConfig]   = useState<SortConfig>({
    key:       'queued_at',   // ✅ Fix 1: was 'queue_at' — field is 'queued_at'
    direction: 'desc',
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${backendUrl}/scam-alert/admin/queue`);
      if (res.data.success) {
        setFlaggedFiles(res.data.queue ?? []);
      } else {
        throw new Error(res.data.message ?? 'Unknown error');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to fetch documents';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Reset to page 1 on filter/search change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, riskFilter, sortConfig]);

  // ── Sort toggle ────────────────────────────────────────────────────────────

  const toggleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setSearchTerm('');
    setRiskFilter('All');
    setSortConfig({ key: 'queued_at', direction: 'desc' });
    setCurrentPage(1);
  }, []);

  // ── Filter + Sort + Paginate ───────────────────────────────────────────────

  const { totalPages, paginatedData, totalFiltered } = useMemo(() => {
    // ✅ Fix 2: filter uses correct field names from ScamFile interface
    let filtered = flaggedFiles.filter((doc) => {
      const matchesSearch = doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.document_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.threat_category?.toLowerCase().includes(searchTerm.toLowerCase());

      // ✅ Fix 3: riskFilter mapped to track field (ScamFile has no risk_level)
      const matchesRisk = riskFilter === 'All' || doc.track === riskFilter;

      return matchesSearch && matchesRisk;
    });

    // ✅ Fix 4: sort uses correct ScamFile field names
    filtered.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortConfig.key) {
        case 'queued_at':
          aVal = new Date(a.queued_at).getTime();
          bVal = new Date(b.queued_at).getTime();
          break;
        case 'ai_confidence':
          aVal = a.ai_confidence ?? 0;
          bVal = b.ai_confidence ?? 0;
          break;
        case 'avg_score':
          aVal = a.avg_score ?? 0;
          bVal = b.avg_score ?? 0;
          break;
        case 'report_count':
          aVal = a.report_count ?? 0;
          bVal = b.report_count ?? 0;
          break;
        case 'title':
          aVal = a.title?.toLowerCase() ?? '';
          bVal = b.title?.toLowerCase() ?? '';
          break;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    const totalFiltered = filtered.length;
    const total   = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));
    const start   = (currentPage - 1) * ITEMS_PER_PAGE;
    const sliced  = filtered.slice(start, start + ITEMS_PER_PAGE);

    return { totalPages: total, paginatedData: sliced, totalFiltered };
  }, [flaggedFiles, searchTerm, riskFilter, sortConfig, currentPage]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewReport = useCallback((docId: string, adminQId: string) => {
    // docId = masterDocId
    navigate(`/scam-alert/${docId}/${adminQId}`);
  }, [navigate]); 

  // ── Sort header cell ───────────────────────────────────────────────────────

  const SortTh = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th
      onClick={() => toggleSort(sortKey)}
      className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none whitespace-nowrap"
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-blue-500">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
        )}
      </div>
    </th>
  );

  // ── Score bar ──────────────────────────────────────────────────────────────

  const ScoreBar = ({ score, label }: { score: number; label?: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-7 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">
        {score ?? 0}
      </span>
      <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${scoreBarClass(score)}`}
          style={{ width: `${Math.min(score ?? 0, 100)}%` }}
        />
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );

  // ── Skeleton row ───────────────────────────────────────────────────────────

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans transition-colors duration-200 w-full">
      <div className="max-w-7xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Scam Alert Documents
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {loading ? 'Loading...' : `${totalFiltered} document${totalFiltered !== 1 ? 's' : ''} flagged for manual review`}
            </p>
          </div>
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, type, or threat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Risk filter */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:block">Track:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskLevelFilter)}  
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RISK_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* ── Error State ── */}
        {error && !loading && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={fetchFiles} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {/* ── Main Table Card ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

          {/* Card header */}
          <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Flagged Documents</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Awaiting admin review before publishing to the public alert page
              </p>
            </div>
            {!loading && flaggedFiles.length > 0 && (
              <div className="flex gap-3 text-center">
                <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                  <p className="text-lg font-bold text-red-600">{flaggedFiles.filter(f => f.track === 'HIGH').length}</p>
                  <p className="text-xs text-red-500">High Track</p>
                </div>
                <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                  <p className="text-lg font-bold text-orange-600">{flaggedFiles.filter(f => f.status === 'REVIEW').length}</p>
                  <p className="text-xs text-orange-500">In Review</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop Table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <SortTh label="Document Name"  sortKey="title"         />
                  <SortTh label="Queued At"       sortKey="queued_at"     />
                  <SortTh label="Track"           sortKey="ai_confidence" />
                  <SortTh label="AI Confidence"   sortKey="ai_confidence" />
                  <SortTh label="Avg Score"       sortKey="avg_score"     />
                  <SortTh label="Reports"         sortKey="report_count"  />
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((doc) => (
                    <tr
                      key={doc.queue_id}
                      className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                    >
                      {/* Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {doc.title}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">
                              {doc.document_type} · {doc.threat_category}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <Calendar size={13} className="flex-shrink-0" />
                          <span>{formatDateTime(doc.queued_at)}</span>
                        </div>
                      </td>

                      {/* Track */}
                      <td className="p-4">
                        <TrackBadge track={doc.track} />
                      </td>

                      {/* AI Confidence */}
                      <td className="p-4">
                        <ScoreBar score={doc.ai_confidence} />
                      </td>

                      {/* Avg Score */}
                      <td className="p-4">
                        <ScoreBar score={doc.avg_score} />
                      </td>

                      {/* Report count */}
                      <td className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {doc.report_count ?? 0}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewReport(doc.masterDocId,doc.queue_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                          >
                            <Eye size={13} />
                            View
                          </button>
                          <StatusIndicator status={doc.status} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Search size={32} strokeWidth={1.5} />
                        <p className="text-sm font-medium">No documents match your filters.</p>
                        <button onClick={handleReset} className="text-xs text-blue-500 hover:underline">
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card List ── */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                </div>
              ))
            ) : paginatedData.length > 0 ? (
              paginatedData.map((doc) => (
                <div
                  key={doc.queue_id}
                  className="p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-shrink-0 p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <FileText size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                          {doc.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {doc.document_type} · {doc.threat_category}
                        </p>
                      </div>
                    </div>
                    <TrackBadge track={doc.track} />
                  </div>

                  {/* Date + reports */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} />
                      <span>{formatDateTime(doc.queued_at)}</span>
                    </div>
                    <span>{doc.report_count ?? 0} report{doc.report_count !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Score bars */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-20">AI Score</span>
                      <ScoreBar score={doc.ai_confidence} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-20">Avg Score</span>
                      <ScoreBar score={doc.avg_score} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewReport(doc.masterDocId)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-all"
                    >
                      <Eye size={13} />
                      View Report
                    </button>
                    <StatusIndicator status={doc.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Search size={32} strokeWidth={1.5} />
                <p className="text-sm font-medium">No documents match your filters.</p>
                <button onClick={handleReset} className="text-xs text-blue-500 hover:underline">Clear filters</button>
              </div>
            )}
          </div>

          {/* ── Pagination ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {totalFiltered === 0
                ? 'No results'
                : `Showing ${Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalFiltered)}–${Math.min(currentPage * ITEMS_PER_PAGE, totalFiltered)} of ${totalFiltered}`
              }
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300 px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScamManagementList;