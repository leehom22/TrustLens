import React from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';

// --- 1. Mock Data (Updated Values) ---
const KPI_DATA = [
  { 
    title: "Total Documents", 
    value: "28", // Changed to 28
    icon: FileText, 
    color: "bg-blue-100 text-blue-600" 
  },
  { 
    title: "High/Med Risk Flagged", 
    value: "4", // Changed to 4
    icon: ShieldAlert, 
    color: "bg-red-100 text-red-600" 
  },
  { 
    title: "Model Accuracy", 
    value: "94.2%", // Kept as requested
    icon: CheckCircle, 
    color: "bg-green-100 text-green-600" 
  },
  { 
    title: "Pending Review", 
    value: "2", // Changed to 2
    icon: Clock, 
    color: "bg-orange-100 text-orange-600" 
  }
];

const RISK_DISTRIBUTION = [
  { name: 'Low Risk (Safe)', value: 24, color: '#10B981' }, 
  { name: 'Medium Risk (Suspicious)', value: 2, color: '#F59E0B' }, 
  { name: 'High Risk (Fraud)', value: 2, color: '#EF4444' }, 
];

const RECENT_ALERTS = [
  {
    id: "DOC-2024-001",
    name: "Invoice_QTX_882.pdf",
    date: "2026-02-05",
    risk: "High",
    issue: "Metadata Erasure & Canva Editing Traces Detected",
    status: "Review Needed"
  },
  {
    id: "DOC-2024-004",
    name: "Uber_Receipt_992.png",
    date: "2026-02-04",
    risk: "High",
    issue: "Arithmetic Mismatch (Total sum incorrect)",
    status: "Pending"
  },
  {
    id: "DOC-2024-009",
    name: "Salary_Slip_Jan.pdf",
    date: "2026-02-03",
    risk: "Medium",
    issue: "Font inconsistency detected in salary figures",
    status: "Investigating"
  },
  {
    id: "DOC-2024-012",
    name: "Contract_Vendor_V2.pdf",
    date: "2026-02-02",
    risk: "Medium",
    issue: "Digital signature invalid / Copy-paste detected",
    status: "Pending"
  }
];

const DashboardPage: React.FC = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      {/* --- Header --- */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm">TrustLens Document Fraud Analysis System</p>
        </div>
      </div>

      {/* --- Top Section: KPIs & Chart --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left: 4 KPI Cards (Spanning 2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {KPI_DATA.map((kpi, index) => (
            <div key={index} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-lg ${kpi.color}`}>
                  <kpi.icon size={24} />
                </div>
                {/* REMOVED: Percentage Badge was here */}
              </div>
              <div className="mt-4">
                <h3 className="text-gray-500 text-sm font-medium">{kpi.title}</h3>
                <h2 className="text-3xl font-bold text-gray-800">{kpi.value}</h2>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Risk Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-start h-auto">
          <h3 className="text-gray-700 font-bold mb-4 self-start w-full">Risk Distribution</h3>
          
          {/* Container Height */}
          <div className="w-full h-72"> 
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={RISK_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {RISK_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={80} 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px", paddingBottom: "5px", fontSize: "12px" }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- Bottom Section: Flagged Documents Table --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Flagged Documents (Medium/High Risk)</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search alerts..." 
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-medium">Document Name</th>
                <th className="p-4 font-medium">Detected Issue</th>
                <th className="p-4 font-medium">Risk Level</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                {/* REMOVED: Action Column Header */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {RECENT_ALERTS.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    {doc.name}
                  </td>
                  <td className="p-4 text-gray-600">{doc.issue}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      doc.risk === 'High' 
                        ? 'bg-red-50 text-red-600 border-red-100' 
                        : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                    }`}>
                      {doc.risk}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{doc.date}</td>
                  <td className="p-4">
                     <span className="text-gray-500">{doc.status}</span>
                  </td>
                  {/* REMOVED: Action Column Button */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;