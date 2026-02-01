import { AlertTriangle, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";

export function HeatmapVisualization() {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Simulated multi-page document data
  const pages = [
    {
      pageNumber: 1,
      regions: [
        { id: "header", label: "Header Section", risk: "low", x: 10, y: 5, width: 80, height: 8 },
        { id: "section1", label: "Section 1: Introduction", risk: "safe", x: 10, y: 15, width: 80, height: 12 },
        { id: "section2", label: "Section 2: Payment Terms", risk: "safe", x: 10, y: 29, width: 80, height: 12 },
        { id: "section3", label: "Section 3: Delivery Schedule", risk: "medium", x: 10, y: 43, width: 80, height: 10 },
        { id: "section4", label: "Section 4.2 - Liability Clause", risk: "high", x: 10, y: 55, width: 80, height: 15 },
        { id: "signature", label: "Signature Area", risk: "medium", x: 10, y: 72, width: 35, height: 8 },
        { id: "footer", label: "Footer", risk: "safe", x: 10, y: 82, width: 80, height: 8 },
      ],
      findings: "Page 1 contains the contract introduction and critical liability clause with significant alterations detected in Section 4.2."
    },
    {
      pageNumber: 2,
      regions: [
        { id: "section5", label: "Section 5: Termination Terms", risk: "medium", x: 10, y: 5, width: 80, height: 15 },
        { id: "section6", label: "Section 6: Dispute Resolution", risk: "high", x: 10, y: 22, width: 80, height: 18 },
        { id: "section7", label: "Section 7: Confidentiality", risk: "safe", x: 10, y: 42, width: 80, height: 12 },
        { id: "section8", label: "Section 8: Warranties", risk: "low", x: 10, y: 56, width: 80, height: 10 },
        { id: "terms", label: "Terms & Conditions", risk: "high", x: 10, y: 68, width: 80, height: 18 },
        { id: "page2-footer", label: "Footer", risk: "safe", x: 10, y: 88, width: 80, height: 6 },
      ],
      findings: "Page 2 shows suspicious dispute resolution terms and heavily edited Terms & Conditions section with foreign jurisdiction clauses."
    },
    {
      pageNumber: 3,
      regions: [
        { id: "appendix", label: "Appendix A: Specifications", risk: "safe", x: 10, y: 5, width: 80, height: 20 },
        { id: "schedule", label: "Schedule of Payments", risk: "medium", x: 10, y: 27, width: 80, height: 15 },
        { id: "addendum", label: "Addendum: Special Provisions", risk: "low", x: 10, y: 44, width: 80, height: 12 },
        { id: "signatures", label: "Signature Block", risk: "safe", x: 10, y: 58, width: 80, height: 15 },
        { id: "witnesses", label: "Witness Section", risk: "safe", x: 10, y: 75, width: 80, height: 10 },
        { id: "page3-footer", label: "Document Footer", risk: "safe", x: 10, y: 87, width: 80, height: 6 },
      ],
      findings: "Page 3 contains appendices and signature blocks with minor modifications detected in the payment schedule section."
    }
  ];

  const totalPages = pages.length;
  const currentPageData = pages[currentPage - 1];
  const regions = currentPageData.regions;

  const getColorByRisk = (risk: string) => {
    switch (risk) {
      case "high": return "rgba(239, 68, 68, 0.6)";
      case "medium": return "rgba(251, 191, 36, 0.5)";
      case "low": return "rgba(96, 165, 250, 0.3)";
      default: return "rgba(34, 197, 94, 0.2)";
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Document Heatmap Analysis
              <ZoomIn className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">Visual representation of altered and suspicious regions</p>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-500/20 border border-green-500 rounded"></div>
              <span className="text-gray-700 dark:text-slate-300">Safe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-500/50 border border-yellow-500 rounded"></div>
              <span className="text-gray-700 dark:text-slate-300">Modified</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 dark:bg-red-500/60 border border-red-500 rounded"></div>
              <span className="text-gray-700 dark:text-slate-300">High Risk</span>
            </div>
          </div>
        </div>

        {/* Heatmap Visualization */}
        <div className="relative bg-white rounded-lg p-8 min-h-[600px] border-2 border-gray-300 dark:border-slate-600">
          <svg width="100%" height="600" viewBox="0 0 100 100" className="border border-gray-300 dark:border-slate-300">
            {/* Background */}
            <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
            
            {/* Document representation with text lines */}
            <g opacity="0.3">
              {Array.from({ length: 40 }).map((_, i) => (
                <line
                  key={i}
                  x1="12"
                  y1={5 + i * 2.3}
                  x2="88"
                  y2={5 + i * 2.3}
                  stroke="#94a3b8"
                  strokeWidth="0.3"
                />
              ))}
            </g>

            {/* Heatmap regions */}
            {regions.map((region) => (
              <g key={region.id}>
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  fill={getColorByRisk(region.risk)}
                  stroke={hoveredRegion === region.id ? "#1e40af" : "transparent"}
                  strokeWidth="0.5"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredRegion(region.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  rx="1"
                />
                {region.risk === "high" && (
                  <g>
                    <circle cx={region.x + region.width - 3} cy={region.y + 3} r="2" fill="#ef4444" />
                    <text
                      x={region.x + region.width - 3}
                      y={region.y + 3.5}
                      fontSize="2"
                      fill="white"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* Labels for critical areas */}
            <text x="50" y="62" fontSize="2.5" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              ⚠️ ALTERED SECTION DETECTED
            </text>
            <text x="50" y="88" fontSize="2.5" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              ⚠️ SUSPICIOUS TERMS
            </text>
          </svg>

          {/* Hover tooltip */}
          {hoveredRegion && (
            <div className="absolute top-4 right-4 bg-gray-900 dark:bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-gray-700 dark:border-slate-700 max-w-xs">
              <p className="font-semibold mb-1">
                {regions.find(r => r.id === hoveredRegion)?.label}
              </p>
              <p className="text-xs text-gray-300 dark:text-slate-300">
                Risk Level: {regions.find(r => r.id === hoveredRegion)?.risk.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-600/10 border border-yellow-400 dark:border-yellow-600/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Page {currentPage} Analysis Findings</h4>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                {currentPageData.findings}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Detection Details</h3>
        <div className="space-y-3">
          {regions
            .filter(r => r.risk === "high" || r.risk === "medium")
            .map((region) => (
              <div
                key={region.id}
                className={`p-3 rounded-lg border shadow-sm ${
                  region.risk === "high"
                    ? "bg-red-50 dark:bg-red-600/10 border-red-300 dark:border-red-600/50"
                    : "bg-yellow-50 dark:bg-yellow-600/10 border-yellow-300 dark:border-yellow-600/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">{region.label}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    region.risk === "high" 
                      ? "bg-red-600 text-white" 
                      : "bg-yellow-600 text-white"
                  }`}>
                    {region.risk === "high" ? "High Risk" : "Modified"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">
                  {region.risk === "high" 
                    ? "Evidence of significant pixel manipulation and content replacement detected"
                    : "Minor edits detected, likely formatting or text changes"}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <Button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          variant="outline"
          className="flex items-center gap-2 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentPage === idx + 1
                    ? "bg-blue-600 dark:bg-blue-400 w-6"
                    : "bg-gray-300 dark:bg-slate-600"
                }`}
                aria-label={`Go to page ${idx + 1}`}
              />
            ))}
          </div>
        </div>
        <Button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          variant="outline"
          className="flex items-center gap-2 disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}