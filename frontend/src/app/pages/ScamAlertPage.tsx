import { useEffect, useState } from "react";
import AlertCard from "../components/scamAlert/AlertCard";
import { selectClass } from "@/lib/scamAlert";
import { toast } from "sonner";
import axios from "axios";

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ScamAlertPage() {
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("All Levels");
  const [filterType, setFilterType] = useState<string>("All Types");
  const [filterThreat, setFilterThreat] = useState<string>("All Threats");
  const [filterState, setFilterState] = useState<string>("All States");
  const [alertDoc, setAlertDoc] = useState<[ScamAlert] | []>([])
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const fetchAlertDoc = async () => {
    try {
      const res = await axios.get(`${backendUrl}/scam-alert/alerts`)

      if (res.data.success) {
        setAlertDoc(res.data.data)
      }
    } catch (error) {
      toast.error("Error fetching alert document")
      console.log("Error fetching scam alert document: ", error.message)
    }
  }
  const filtered = alertDoc.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.documentType.toLowerCase().includes(search.toLowerCase()) ||
      a.threatCategory.toLowerCase().includes(search.toLowerCase());
    const matchRisk = filterRisk === "All Levels" || a.riskLevel === filterRisk;
    const matchType = filterType === "All Types" || a.documentType === filterType;
    const matchThreat = filterThreat === "All Threats" || a.threatCategory === filterThreat;
    const matchState = filterState === "All States" || a.state === filterState;
    return matchSearch && matchRisk && matchType && matchThreat && matchState;
  });

  const resetFilters = () => {
    setSearch("");
    setFilterRisk("All Levels");
    setFilterType("All Types");
    setFilterThreat("All Threats");
    setFilterState("All States");
  };

  const criticalCount = alertDoc?.filter(a => a.riskLevel === "CRITICAL").length;
  const totalReports = alertDoc?.reduce((s, a) => s + a.reportCount, 0);

  useEffect(() => {
    fetchAlertDoc()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-red-500">⚠</span> Scam Alert
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Community-reported and AI-verified scam documents circulating in Malaysia
            </p>
          </div>
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-gray-400">Critical Alerts</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">{alertDoc.length}</p>
              <p className="text-xs text-gray-400">Active Alerts</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600">{totalReports}</p>
              <p className="text-xs text-gray-400">Total Reports</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="text-blue-500 mt-0.5 flex-shrink-0">ℹ</span>
          <p className="text-xs text-blue-700">
            All alerts are community-reported and AI-assisted. This is not a legal determination. If you believe an alert is incorrect, use the dispute function. PII has been removed from all previews in compliance with PDPA 2010.
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, type, or threat..."
              className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1">▽ Filter by:</span>
            <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className={selectClass}>
              <option>All Levels</option>
              <option>CRITICAL</option>
              <option>HIGH</option>
              <option>CAUTION</option>
              <option>LOW</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClass}>
              <option>All Types</option>
              <option>Invoice</option>
              <option>Offer Letter</option>
              <option>Government Notice</option>
              <option>Bank Statement</option>
              <option>Contract</option>
            </select>
            <select value={filterThreat} onChange={(e) => setFilterThreat(e.target.value)} className={selectClass}>
              <option>All Threats</option>
              <option>Phishing</option>
              <option>Impersonation</option>
              <option>Fake Authority</option>
              <option>Fraud</option>
              <option>Identity Theft</option>
            </select>
            <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={selectClass}>
              <option>All States</option>
              <option>Kuala Lumpur</option>
              <option>Selangor</option>
              <option>Penang</option>
              <option>Johor</option>
              <option>Sabah</option>
              <option>Sarawak</option>
              <option>Perak</option>
              <option>Kedah</option>
            </select>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ↺ Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Showing <span className="text-blue-600 font-bold">{filtered.length}</span> of {alertDoc.length} alerts
          </h2>
          <span className="text-xs text-gray-400">Sorted by: Most Recent</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 font-medium">No alerts found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            <button onClick={resetFilters} className="mt-3 text-sm text-blue-600 hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer notice ── */}
      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-gray-400">
          TrustLens Scam Alert — Malaysia Only · Powered by AI Document Analysis · PDPA 2010 Compliant
        </p>
      </div>
    </div>
  );
}