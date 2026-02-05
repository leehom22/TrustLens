import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Download, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from 'lucide-react';

// --- 1. Mock Data (This simulates your Database) ---
const MOCK_HISTORY = [
  {
    id: "DOC-2025-001",
    fileName: "Q4_Financial_Report.pdf",
    uploadDate: "2025-02-04 14:30",
    riskScore: 12,
    riskLevel: "Low",
    fileSize: "2.4 MB",
    analyzedBy: "John Doe"
  },
  {
    id: "DOC-2025-002",
    fileName: "Vendor_Contract_v2_SIGNED.pdf",
    uploadDate: "2025-02-03 09:15",
    riskScore: 88,
    riskLevel: "High",
    fileSize: "1.1 MB",
    analyzedBy: "System Admin"
  },
  {
    id: "DOC-2025-003",
    fileName: "Invoice_#99281.jpg",
    uploadDate: "2025-02-02 11:45",
    riskScore: 65,
    riskLevel: "Medium",
    fileSize: "450 KB",
    analyzedBy: "Jane Smith"
  },
  {
    id: "DOC-2025-004",
    fileName: "Salary_Slip_Jan_2025.pdf",
    uploadDate: "2025-01-30 16:20",
    riskScore: 45,
    riskLevel: "Medium",
    fileSize: "890 KB",
    analyzedBy: "John Doe"
  },
  {
    id: "DOC-2025-005",
    fileName: "Uber_Receipt_Dec24.png",
    uploadDate: "2025-01-28 10:00",
    riskScore: 5,
    riskLevel: "Low",
    fileSize: "2.1 MB",
    analyzedBy: "Jane Smith"
  },
  {
    id: "DOC-2025-006",
    fileName: "Project_Proposal_Draft.docx",
    uploadDate: "2025-01-25 13:10",
    riskScore: 92,
    riskLevel: "High",
    fileSize: "5.6 MB",
    analyzedBy: "Guest User"
  }
];

const HistoryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  // --- Filter Logic ---
  const filteredData = MOCK_HISTORY.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'All' || doc.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  // --- Helper for Badge Colors ---
  const getRiskColor = (level: string) => {
    switch(level) {
      case 'High': return 'bg-red-50 text-red-600 border-red-100';
      case 'Medium': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'Low': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  // --- Action Handler (Placeholder) ---
  const handleViewReport = (docId: string) => {
    console.log(`Navigating to report for ${docId}`);
    // In the future, you will use: navigate(`/analysis/${docId}`);
    alert(`Opening analysis for document: ${docId}`);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      
      {/* --- Page Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analysis History</h1>
          <p className="text-gray-500 text-sm mt-1">Archive of all documents processed by TrustLens.</p>
        </div>
        
      
        <div className="flex gap-3">
        </div>
      </div>

      {/* --- Search & Filter Bar --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by filename..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">Filter by Risk:</span>
          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* --- Data Table --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold">Document Name</th>
                <th className="p-4 font-semibold">Date Analyzed</th>
                <th className="p-4 font-semibold">Risk Level</th>
                <th className="p-4 font-semibold">Risk Score</th>
                <th className="p-4 font-semibold">File Size</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {filteredData.length > 0 ? (
                filteredData.map((doc) => (
                  <tr key={doc.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-4 font-medium text-gray-800 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <FileText size={18} />
                      </div>
                      <span>{doc.fileName}</span>
                    </td>
                    <td className="p-4 text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {doc.uploadDate}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(doc.riskLevel)}`}>
                        {doc.riskLevel}
                      </span>
                    </td>
                    <td className="p-4">
                      {/* Visual Score Bar */}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 w-6">{doc.riskScore}</span>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              doc.riskScore > 70 ? 'bg-red-500' : 
                              doc.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                            }`} 
                            style={{ width: `${doc.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-xs">{doc.fileSize}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleViewReport(doc.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 hover:border-blue-400 bg-blue-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ml-auto"
                      >
                        <Eye size={14} /> View Report
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No documents found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- Pagination Footer (Visual Only) --- */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <span>Showing {filteredData.length} results</span>
          <div className="flex gap-2">
            <button className="p-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50" disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 border border-gray-200 rounded hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;