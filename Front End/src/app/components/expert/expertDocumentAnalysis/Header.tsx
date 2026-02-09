import { FileHeader } from "@/app/types/db-ai-analysis-type";
import { Calendar, CheckCircle, Download, ExternalLink, FileText, FileType, HardDrive, Shield, User } from "lucide-react";

const Header = ({ selectedDocument }: { selectedDocument: FileHeader | null }) => {
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        // Handle Firestore Timestamp or Date object
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    };

    const handleDownload = () => {
        if (selectedDocument?.fileUrl) {
            window.open(selectedDocument.fileUrl, '_blank');
        }
    };

    if (!selectedDocument) return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 mb-6 transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                            {selectedDocument.fileName}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                                Uploaded: <span className="font-medium text-gray-800 dark:text-slate-200">
                                    {formatDate(selectedDocument.created_at)}
                                </span>
                            </span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4" />
                            <span>
                                Size: <span className="font-medium text-gray-800 dark:text-slate-200">
                                    {formatFileSize(selectedDocument.fileSize)}
                                </span>
                            </span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-2">
                            <FileType className="w-4 h-4" />
                            <span>
                                Type: <span className="font-medium text-gray-800 dark:text-slate-200">
                                    {selectedDocument.mimeType.split('/')[1].toUpperCase()}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download
                </button>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">User ID</p>
                        <p className="text-sm font-mono font-medium text-gray-900 dark:text-slate-100 truncate max-w-[200px]">
                            {selectedDocument.user.username}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Status</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            Analysis Complete
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Document ID</p>
                        <p className="text-sm font-mono font-medium text-gray-900 dark:text-slate-100 truncate max-w-[200px]">
                            {selectedDocument.id || 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            {/* File Preview Badge */}
            <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    <FileText className="w-3 h-3 mr-1.5" />
                    {selectedDocument.mimeType}
                </span>
                {selectedDocument.fileUrl && (
                    <a 
                        href={selectedDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3 mr-1.5" />
                        View in Storage
                    </a>
                )}
            </div>
        </div>
    );
};

export default Header