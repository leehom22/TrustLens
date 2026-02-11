import React, { useMemo, useState } from 'react';
import { FileText, Clock, RotateCcw, Search, X } from 'lucide-react';
import { documents } from '../../data/documentReview';
import { DocumentAnalysisResult } from '../../types/type';
import DocumentAnalysis from '../../components/expert/documentAnalysis';
// Admin Dashboard
const DocumentReviewPage = () => {
    const [selectedDocument, setSelectedDocument] = useState<DocumentAnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [filter, setFilter] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState({ key: 'submissionDate', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState("");

    const filteredDocuments = documents.filter(doc =>
        activeTab === 'all' ? true : doc.status === activeTab
    );

    const processedDocs = useMemo(() => {
        // First, filter by search term
        let filteredItems = documents.filter((doc) =>
            doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.aiVerdict.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Then, sort the filtered results
        filteredItems.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filteredItems;
    }, [documents, searchTerm, sortConfig]);

    const handleReset = () => {
        setSearchTerm(""); // Clear search
        setSortConfig({ key: 'submissionDate', direction: 'desc' }); // Reset sort to newest
    };

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    return (
       <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 w-385">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expert Review Dashboard</h1>
                            <p className="text-sm text-gray-600 dark:text-white mt-1">Document Fraud Analysis System</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-6 p-6 bg-gray-50 dark:bg-transparent">
                {/* Left Section: Stats Grid (4 cards in a 2x2 layout) */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card 1 */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Meetings</p>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">+20%</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">12 <span className="text-lg font-normal text-gray-400">meet</span></p>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-1">Meeting volume increased compared to last week.</p>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Avg. Duration</p>
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">-5%</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">42 <span className="text-lg font-normal text-gray-400">min</span></p>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-1">Average meeting duration decreased from previous month.</p>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Attendance</p>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">+3%</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">87%</p>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-1">Meetings attendance improved compared to last month.</p>
                    </div>

                    {/* Card 4 */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Participant Engagement</p>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">+5%</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">85%</p>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-1">Engagement increased, showing improved collaboration.</p>
                    </div>
                </div>

                {/* Right Section: Large Chart Card */}
                <div className="flex-[1.5] bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Frequency</h3>
                            <p className="text-sm text-gray-500">Track your meeting and identify trends.</p>
                        </div>
                        <select className="text-sm border rounded-lg p-1 dark:bg-slate-900 dark:border-slate-700">
                            <option>This Month</option>
                        </select>
                    </div>

                    <div className="h-48 flex items-center justify-center border-t border-gray-100 dark:border-slate-700 pt-4">
                        {/* Your Chart Component (Recharts/Chart.js) would go here */}
                        <p className="text-gray-400 italic">Chart Visualization Area</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex flex-col h-[calc(100vh-89px)] bg-white dark:bg-slate-950">
                {/* Header Actions */}
                <div className="w-full flex flex-col md:flex-row items-center justify-between p-4 gap-4 border-b dark:border-slate-800">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white whitespace-nowrap">Flagged Documents</h2>

                        {/* Search Bar Implementation */}
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
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border rounded-lg hover:bg-gray-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors w-full md:w-auto justify-center"
                    >
                        <RotateCcw size={16} /> Reset
                    </button>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto flex-1">
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
                                                        <span className="text-[10px]">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-800">
                                {processedDocs.map((doc, index) => (
                                    <tr
                                        key={doc.id || index}
                                        className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                                    <FileText size={18} />
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-slate-200">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                                            {doc.aiVerdict}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full  font-medium border text-sm
                                ${doc.riskLevel === 'High' ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30' :
                                                    doc.riskLevel === 'Medium' ? 'bg-yellow-50 border-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-900/30' :
                                                        'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-900/30'}`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${doc.riskLevel === 'High' ? 'bg-red-500' : doc.riskLevel === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                                {doc.riskLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                                            {doc.submissionDate}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-md text-xs font-semibold text-sm
                                ${doc.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                    doc.status === 'Pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                                        'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400'}`}
                                            >
                                                {doc.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* Empty Search State */
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-slate-400">
                            <Search className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No documents match your search</p>
                            <p className="text-sm">Try adjusting your filters or search terms</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocumentReviewPage

