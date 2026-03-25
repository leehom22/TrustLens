import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, ShieldAlert, Clock, Search, Loader2, Calendar, Eye } from 'lucide-react';
import axios from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageProvider';

const formatDateTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getDisplayRisk = (risk?: string, language: string = "en") => {
  if (!risk) return language === 'ms' ? 'Selamat' : 'Safe';
  switch (risk.toUpperCase()) {
    case 'CRITICAL': return language === 'ms' ? 'Kritikal' : 'Critical';
    case 'SUSPICIOUS': return language === 'ms' ? 'Mencurigakan' : 'Suspicious';
    case 'CAUTION': return language === 'ms' ? 'Awas' : 'Caution';
    case 'SAFE': return language === 'ms' ? 'Selamat' : 'Safe';
    default: return language === 'ms' ? 'Selamat' : 'Safe';
  }
};

const getRiskColor = (risk?: string) => {
  if (!risk) return 'bg-green-100 text-green-700 border-green-200';
  switch (risk.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    case 'SUSPICIOUS': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    case 'SAFE': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    case 'CAUTION': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

// Colors: Green (Safe), Yellow (Caution), Orange (Suspicious), Red (Critical)
const COLORS = ['#10B981', '#FACC15', '#F59E0B', '#EF4444']; 

export default function Dashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [stats, setStats] = useState({ total_documents: 0, pending_review_count: 0 });
  
  const [riskData, setRiskData] = useState([
    { name: 'Safe', value: 0 }, 
    { name: 'Caution', value: 0 }, 
    { name: 'Suspicious', value: 0 }, 
    { name: 'Critical', value: 0 }
  ]);
  
  const [flaggedDocs, setFlaggedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch Stats
          const statsRes = await axios.get(`${backendUrl}/files/dashboard_stats/${user.uid}`);
          if (statsRes.data && statsRes.data.success) {
            setStats({
              total_documents: statsRes.data.data?.total_documents || 0,
              pending_review_count: statsRes.data.data?.pending_review_count || 0
            });
          }

          // Fetch History
          const historyRes = await axios.get(`${backendUrl}/files/get_history_files/${user.uid}`);
          
          let historyData: any[] = [];
          if (Array.isArray(historyRes.data)) {
              historyData = historyRes.data;
          } else if (historyRes.data && Array.isArray(historyRes.data.data)) {
              historyData = historyRes.data.data;
          }

          let safe = 0, caution = 0, suspicious = 0, critical = 0;
          const flagged: any[] = [];

          historyData.forEach((doc: any) => {
            const risk = (doc.risk_level || 'SAFE').toUpperCase();
            
            // Accurately map for the pie chart
            if (risk === 'CRITICAL') critical++;
            else if (risk === 'SUSPICIOUS') suspicious++;
            else if (risk === 'CAUTION') caution++;
            else safe++;

            // STRICT FILTERING: Only flag Suspicious, Critical, or manually flagged documents
            const needsAttention = doc.flagged === true || risk === 'CRITICAL' || risk === 'SUSPICIOUS';
            if (needsAttention) {
              flagged.push(doc);
            }
          });

          setRiskData([
            { name: language === 'ms' ? 'Selamat' : 'Safe', value: safe },
            { name: language === 'ms' ? 'Awas' : 'Caution', value: caution },
            { name: language === 'ms' ? 'Mencurigakan' : 'Suspicious', value: suspicious },
            { name: language === 'ms' ? 'Kritikal' : 'Critical', value: critical }
          ]);
          
          setFlaggedDocs(flagged);

        } catch (error) {
          console.error("Dashboard error:", error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [backendUrl, language]);

  const handleViewReport = (id: string) => navigate(`/review-document-analysis/${id}`);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-slate-900">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {language === 'ms' ? 'Papan Pemuka' : 'Dashboard'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ms' ? 'Sistem Analisis Penipuan Dokumen TrustLens' : 'TrustLens Document Fraud Analysis System'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {language === 'ms' ? 'Jumlah Dokumen' : 'Total Documents'}
                  </p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.total_documents}</h3>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-4">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {language === 'ms' ? 'Dokumen Berisiko Tinggi' : 'High Risk Documents'}
                  </p>
                  {/* KPI ONLY counts Suspicious (index 2) + Critical (index 3) */}
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {riskData[2].value + riskData[3].value}
                  </h3>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {language === 'ms' ? 'Menunggu Semakan' : 'Pending Review'}
                </p>
                <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-1">{stats.pending_review_count}</h3>
                <p className="text-xs text-slate-400 mt-2">
                  {language === 'ms' ? 'Dokumen ditanda menunggu kelulusan pakar' : 'Flagged docs awaiting expert approval'}
                </p>
              </div>
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0">
                <Clock size={32} />
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
              {language === 'ms' ? 'Pengedaran Risiko' : 'Risk Distribution'}
            </h3>
            <div className="flex-1 flex items-center justify-center min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === 'ms' ? 'Dokumen Perhatian' : 'Attention Required'}
            </h3>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 pl-6">{language === 'ms' ? 'Nama Dokumen' : 'Document Name'}</th>
                  <th className="p-4">{language === 'ms' ? 'Tarikh Dianalisis' : 'Date Analyzed'}</th>
                  <th className="p-4">{language === 'ms' ? 'Tahap Risiko' : 'Risk Level'}</th>
                  <th className="p-4">{language === 'ms' ? 'Skor Risiko' : 'Risk Score'}</th>
                  <th className="p-4 text-right pr-6">{language === 'ms' ? 'Tindakan' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {flaggedDocs.length > 0 ? (
                  flaggedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">{doc.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatDateTime(doc.created_at)}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getRiskColor(doc.risk_level)}`}>
                          {getDisplayRisk(doc.risk_level, language)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-8">{doc.risk_score || 0}</span>
                          <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${(doc.risk_score || 0) > 80 ? 'bg-red-500' : (doc.risk_score || 0) > 50 ? 'bg-amber-500' : (doc.risk_score || 0) > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${doc.risk_score || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => handleViewReport(doc.id)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                          <Eye size={16} /> {language === 'ms' ? 'Lihat Laporan' : 'View Report'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Search className="w-8 h-8 opacity-20" />
                        <p>{language === 'ms' ? 'Tiada dokumen ditemui.' : 'No documents requiring attention found.'}</p>
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
}