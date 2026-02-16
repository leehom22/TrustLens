import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  FileText,
  ShieldAlert,
  Clock,
  Search,
  Loader2,
  Calendar,
  Eye
} from 'lucide-react';
import axios from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

// --- Helper Functions ---
const formatDateTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getDisplayRisk = (risk?: string) => {
  if (!risk) return 'Low'; 
  switch (risk.toUpperCase()) {
    case 'CRITICAL': return 'High';
    case 'SUSPICIOUS': return 'Medium';
    case 'SAFE': return 'Low';
    case 'CAUTION': return 'Low'; 
    default: return 'Low';
  }
};

const getRiskColor = (risk?: string) => {
  if (!risk) return 'bg-green-100 text-green-700 border-green-200';
  switch (risk.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
    case 'SUSPICIOUS': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'SAFE': 
    case 'CAUTION': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

// --- Types ---
interface FileData {
  id: string;
  fileName: string;
  created_at: any; 
  fileSize: number;
  risk_level?: string; // snake_case from backend
  risk_score?: number; // snake_case from backend
}

interface DashboardStats {
  total_documents: number;
  high_risk_count: number;
  pending_review_count: number;
  risk_breakdown: {
    SAFE: number;
    SUSPICIOUS: number;
    CRITICAL: number;
    CAUTION: number;
  };
}

const COLORS = {
  SAFE: '#10B981',      
  SUSPICIOUS: '#F59E0B', 
  CRITICAL: '#EF4444',   
  UNKNOWN: '#94a3b8'     
};

const DashboardPage: React.FC = () => {
  const [documents, setDocuments] = useState<FileData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_documents: 0,
    high_risk_count: 0,
    pending_review_count: 0,
    risk_breakdown: { SAFE: 0, SUSPICIOUS: 0, CRITICAL: 0, CAUTION: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- 1. Get Current User ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        const API_BASE_URL = "http://localhost:8000"; 
        
        // Fetch BOTH file list (with merged risk data) AND stats
        const [filesRes, statsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/files/get_history_files/${userId}`),
          axios.get(`${API_BASE_URL}/files/dashboard_stats/${userId}`)
        ]);
        
        if (filesRes.data.success) {
          setDocuments(filesRes.data.data);
        }
        if (statsRes.data.success) {
          setStats(statsRes.data.data);
        }

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // --- 3. Filter for Flagged Documents Only ---
  const flaggedDocs = documents.filter(doc => {
    const level = doc.risk_level || 'SAFE';
    return level === 'CRITICAL' || level === 'SUSPICIOUS';
  });

  const riskDistribution = [
    { name: 'Low Risk', value: stats.risk_breakdown.SAFE, color: COLORS.SAFE },
    { name: 'Medium Risk', value: stats.risk_breakdown.SUSPICIOUS, color: COLORS.SUSPICIOUS },
    { name: 'High Risk', value: stats.risk_breakdown.CRITICAL, color: COLORS.CRITICAL },
  ].filter(item => item.value > 0); 

  const handleViewReport = (docId: string) => {
    navigate(`/review-document-analysis/${docId}`);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans transition-colors duration-200">
      <div className="max-w-7xl mx-auto">

        {/* --- Header --- */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">TrustLens Document Fraud Analysis System</p>
          </div>
        </div>

        {/* --- Top Section: KPIs & Chart --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column: KPI Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Box 1: Total */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/20"><FileText size={24} /></div>
              </div>
              <div className="mt-4">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Documents</h3>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.total_documents}</h2>
              </div>
            </div>

            {/* Box 2: High/Med Risk */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/20"><ShieldAlert size={24} /></div>
              </div>
              <div className="mt-4">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">High/Med Risk Flagged</h3>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.high_risk_count}</h2>
              </div>
            </div>

            {/* Box 3: Pending Review */}
            <div className="sm:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Pending Review</h3>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">{stats.pending_review_count}</h2>
                <p className="text-xs text-slate-400 mt-1">Flagged docs awaiting expert approval</p>
              </div>
              <div className="p-4 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/20"><Clock size={32} /></div>
            </div>
          </div>

          {/* Right Column: Pie Chart */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-start h-auto">
            <h3 className="text-slate-700 dark:text-slate-200 font-bold mb-4 self-start w-full">Risk Distribution</h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                    {riskDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              {riskDistribution.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No Data Available</div>
              )}
            </div>
          </div>
        </div>

        {/* --- Bottom Section: Flagged Documents Table --- */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Flagged Documents</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search alerts..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-4">Document Name</th>
                  <th className="p-4">Date Analyzed</th>
                  <th className="p-4">Risk Level</th>
                  <th className="p-4">Risk Score</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {flaggedDocs.length > 0 ? (
                  flaggedDocs.map((doc) => {
                    const score = doc.risk_score || 0; 
                    const level = doc.risk_level || 'SAFE';

                    return (
                      <tr key={doc.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                              <FileText size={18} />
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={doc.fileName}>
                              {doc.fileName}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Calendar size={14} />
                            <span>{formatDateTime(doc.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${getRiskColor(level)}`}>
                            {getDisplayRisk(level)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                              {score}
                            </span>
                            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  score > 70 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleViewReport(doc.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search size={24} />
                        <p>No flagged documents found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;