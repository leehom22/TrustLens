import React, { useMemo, useState } from 'react';
import { 
    FileText, 
    Clock, 
    CheckCircle, 
    Search, 
    RotateCcw, 
    ChevronDown, 
    ChevronUp,
    AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// --- MOCK DATA ---
// Strictly using "Review Needed" and "Reviewed" for flagged items
const documents = [
    { id: 1, name: "Invoice_QTX_882.pdf", aiVerdict: "Metadata Erasure", riskLevel: "High", submissionDate: "2026-02-05", status: "Review Needed" },
    { id: 2, name: "Uber_Receipt_992.png", aiVerdict: "Arithmetic Mismatch", riskLevel: "High", submissionDate: "2026-02-04", status: "Review Needed" },
    { id: 3, name: "Salary_Slip_Jan.pdf", aiVerdict: "Font Inconsistency", riskLevel: "Medium", submissionDate: "2026-02-03", status: "Review Needed" },
    { id: 4, name: "Contract_Vendor_V2.pdf", aiVerdict: "Invalid Signature", riskLevel: "Medium", submissionDate: "2026-02-02", status: "Reviewed" },
    { id: 5, name: "Safe_Invoice_001.pdf", aiVerdict: "Clear", riskLevel: "Low", submissionDate: "2026-02-01", status: "Reviewed" }, // Low risk (will be hidden)
    { id: 6, name: "Safe_Receipt_002.png", aiVerdict: "Clear", riskLevel: "Low", submissionDate: "2026-02-01", status: "Reviewed" }, // Low risk (will be hidden)
    { id: 7, name: "ID_Card_Scan.jpg", aiVerdict: "Hologram Failed", riskLevel: "High", submissionDate: "2026-01-30", status: "Reviewed" }, 
];

const UserDashboard = () => {
    const [sortConfig, setSortConfig] = useState({ key: 'submissionDate', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState("");

    // --- 1. FILTER & CALCULATE STATS ---
    const { stats, flaggedDocuments } = useMemo(() => {
        // Step A: STRICTLY filter for High/Medium risk only. 
        // These are the only documents this dashboard cares about.
        const flaggedDocs = documents.filter(d => d.riskLevel === 'High' || d.riskLevel === 'Medium');

        // Step B: Calculate counts based ONLY on these flagged docs
        const reviewNeededCount = flaggedDocs.filter(d => d.status === 'Review Needed').length;
        const reviewedCount = flaggedDocs.filter(d => d.status === 'Reviewed').length;
        const totalFlaggedCount = reviewNeededCount + reviewedCount;

        return {
            stats: {
                reviewNeeded: reviewNeededCount,
                reviewed: reviewedCount,
                total: totalFlaggedCount
            },
            flaggedDocuments: flaggedDocs
        };
    }, []);

    // --- 2. TABLE DATA (Sort & Search on the filtered list) ---
    const processedDocs = useMemo(() => {
        // Filter the ALREADY filtered flagged list by search term
        let filtered = flaggedDocuments.filter((doc) =>
            doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.aiVerdict.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort
        filtered.sort((a, b) => {
            // @ts-ignore
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            // @ts-ignore
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [flaggedDocuments, searchTerm, sortConfig]);

    const handleReset = () => {
        setSearchTerm("");
        setSortConfig({ key: 'submissionDate', direction: 'desc' });
    };

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // --- CHART DATA ---
    const chartData = [
        { name: 'Reviewed', value: stats.reviewed, color: '#10B981' }, // Emerald (Green)
        { name: 'Review Needed', value: stats.reviewNeeded, color: '#EF4444' }, // Red
    ];

    return (
       <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expert Review Dashboard</h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Document Fraud Analysis System</p>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-6 p-6">
                
                {/* Left Section: Stats Grid (2x2 Layout) */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Card 1: Review Needed (Red) */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Review Needed</p>
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                                <Clock size={18} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.reviewNeeded}</p>
                        <p className="text-xs text-gray-400 mt-2">Pending expert analysis.</p>
                    </div>

                    {/* Card 2: Reviewed (Green) */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Reviewed</p>
                            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
                                <CheckCircle size={18} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.reviewed}</p>
                        <p className="text-xs text-gray-400 mt-2">Analysis completed.</p>
                    </div>

                    {/* Card 3: Total Flagged (Bottom - Merged/Full Width) */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm md:col-span-2 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Flagged Documents</p>
                                <span className="flex items-center justify-center bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">High Priority</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-gray-400 mt-1">Total Medium & High risk items.</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full">
                            <AlertTriangle size={24} />
                        </div>
                    </div>

                </div>

                {/* Right Section: Chart */}
                <div className="flex-1 lg:max-w-md bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm min-h-[250px] flex flex-col">
                    <div className="mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Flagged Document Status</h3>
                        <p className="text-sm text-gray-500">Progress on {stats.total} flagged items</p>
                    </div>

                    <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex flex-col bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800">
                <div className="w-full flex flex-col md:flex-row items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white whitespace-nowrap">Flagged Documents</h2>
                        <div className="relative w-full md:w-80 group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name or verdict..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-10 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border rounded-lg hover:bg-gray-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
                    >
                        <RotateCcw size={16} /> Reset
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {processedDocs.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                                    {['#', 'Name', 'AI Verdict', 'Risk Level', 'Flag Date', 'Status'].map((header) => {
                                        const keyMap: any = { 'Name': 'name', 'AI Verdict': 'aiVerdict', 'Risk Level': 'riskLevel', 'Flag Date': 'submissionDate', 'Status': 'status' };
                                        return (
                                            <th
                                                key={header}
                                                onClick={() => keyMap[header] && toggleSort(keyMap[header])}
                                                className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 ${keyMap[header] ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {header}
                                                    {sortConfig.key === keyMap[header] && (
                                                        sortConfig.direction === 'desc' ? <ChevronDown size={14}/> : <ChevronUp size={14}/>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-800">
                                {processedDocs.map((doc, index) => (
                                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                                    <FileText size={18} />
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-slate-200">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{doc.aiVerdict}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border text-sm
                                                ${doc.riskLevel === 'High' ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30' :
                                                  'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${doc.riskLevel === 'High' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                {doc.riskLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{doc.submissionDate}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-md text-xs font-semibold text-sm
                                                ${doc.status === 'Reviewed' 
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                                    : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                                                {doc.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Search className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No flagged documents found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UserDashboard;