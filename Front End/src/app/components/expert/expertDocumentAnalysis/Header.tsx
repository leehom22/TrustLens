import { handlePdfDownload, sendReviewEmailToUser } from "@/api/document";
import { FileHeader } from "@/app/types/db-ai-analysis-type";
import { Annotation, Note } from "@/app/types/document-highlight-type";
import { Calendar, CheckCircle, Download, ExternalLink, FileText, FileType, HardDrive, Loader2, SendIcon, Shield, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ImageSize {
    height: number,
    width: number
} 
interface HeaderProps {
    selectedDocument: FileHeader | null;
    structure_ai_analysis_id: string;
    imageSize: ImageSize,
    downloadNotes?: Note[]
    downloadAnnotations?: Annotation[]
}
const Header = ({ selectedDocument, structure_ai_analysis_id, downloadAnnotations, downloadNotes, imageSize }: HeaderProps) => {

    const [sendingReportLoading, setSendingReportLoading] = useState<boolean>(false)

    const handleSendReportRequest = async (userEmail: string, docName: string, docId: string, analysisId: string, role: string, documentURL: string, notesType: "image" | "pdf", notes?: Note[] | undefined, annotations?: Annotation[]) => {
        try {
            setSendingReportLoading(true)

            const res = await sendReviewEmailToUser(
                userEmail,
                docName,
                docId,
                analysisId,
                role,
                documentURL,
                notesType,
                imageSize.width,
                imageSize.height,
                notes,
                annotations,
            )

            if (res!.success) {
                toast.success("Review email sent to user successfully.");
            } else {
                toast.error("Error sending review email to user.");
            }
        } catch (error) {
            console.log("Eror sending review email:", error);
        } finally {
            setSendingReportLoading(false)
        }
    }

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

    if (!selectedDocument) return null;

    return (
        <div className="
    bg-white dark:bg-slate-900 
    rounded-lg border border-gray-200 dark:border-slate-800 
    p-4 sm:p-6 mb-6 
    transition-colors shadow-sm 
    w-full overflow-hidden
">

            {/* ================= HEADER ================= */}
            <div className="
        flex flex-col 
        gap-4 mb-4 w-full
    ">

                {/* ---------- LEFT INFO ---------- */}
                <div className="flex flex-col min-w-0">

                    {/* File Name */}
                    <div className="flex items-start sm:items-center gap-3 mb-2 min-w-0">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />

                        <h2 className="
                    text-lg sm:text-xl lg:text-2xl
                    font-bold text-gray-900 dark:text-slate-100
                    break-words leading-tight">
                            {selectedDocument.fileName}
                        </h2>
                    </div>

                    {/* Metadata Row */}
                    <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                        {/* Uploaded */}
                        <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span>
                                Uploaded:
                                <span className="ml-1 font-medium text-gray-800 dark:text-slate-200">
                                    {formatDate(selectedDocument.created_at)}
                                </span>
                            </span>
                        </div>

                        {/* Size */}
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 flex-shrink-0" />
                            <span>
                                Size:
                                <span className="ml-1 font-medium text-gray-800 dark:text-slate-200">
                                    {formatFileSize(selectedDocument.fileSize)}
                                </span>
                            </span>
                        </div>

                        {/* Type */}
                        <div className="flex items-center gap-2">
                            <FileType className="w-4 h-4 flex-shrink-0" />
                            <span>
                                Type:
                                <span className="ml-1 font-medium text-gray-800 dark:text-slate-200">
                                    {selectedDocument.mimeType.split('/')[1].toUpperCase()}
                                </span>
                            </span>
                        </div>

                    </div>
                </div>

                {/* ---------- ACTION BUTTONS ---------- */}
                <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-2">

                    {/* Send */}
                    <button
                        onClick={() =>
                            handleSendReportRequest(
                                selectedDocument.user.email,
                                selectedDocument.fileName,
                                selectedDocument.id,
                                structure_ai_analysis_id,
                                'expert',
                                selectedDocument.fileUrl,
                                selectedDocument.mimeType === 'application/pdf' ? 'pdf' : 'image',
                                selectedDocument.mimeType === 'application/pdf'
                                    ? downloadNotes
                                    : undefined,
                                selectedDocument.mimeType === 'application/pdf'
                                    ? undefined
                                    : downloadAnnotations
                            )
                        }
                        className="
                    flex items-center justify-center gap-2
                    w-full sm:w-auto
                    px-4 py-2 text-sm font-medium
                    text-gray-700 dark:text-slate-300
                    bg-gray-100 dark:bg-slate-800
                    rounded-lg
                    hover:bg-gray-200 dark:hover:bg-slate-700
                    transition-colors
                    whitespace-nowrap
                "
                    >
                        {sendingReportLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Sending
                            </>
                        ) : (
                            <>
                                <SendIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">
                                    Send PDF to user
                                </span>
                                <span className="sm:hidden">
                                    Send
                                </span>
                            </>
                        )}
                    </button>

                    {/* Download */}
                    <button
                        onClick={() =>
                            handlePdfDownload(
                                selectedDocument.id,
                                structure_ai_analysis_id,
                                selectedDocument.fileName,
                                'expert'
                            )
                        }
                        className="
                    flex items-center justify-center gap-2
                    w-full sm:w-auto
                    px-4 py-2 text-sm font-medium
                    text-gray-700 dark:text-slate-300
                    bg-gray-100 dark:bg-slate-800
                    rounded-lg
                    hover:bg-gray-200 dark:hover:bg-slate-700
                    transition-colors
                    whitespace-nowrap
                "
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>

                </div>
            </div>

            {/* ================= METADATA GRID ================= */}
            <div className="
        grid grid-cols-1
        sm:grid-cols-2
        xl:grid-cols-3
        gap-4 pt-4
        border-t border-gray-200 dark:border-slate-800
    ">

                {/* User */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg min-w-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                            User name
                        </p>
                        <p className="text-sm font-mono font-medium truncate">
                            {selectedDocument.user.username}
                        </p>
                    </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                            Status
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            Analysis Complete
                        </p>
                    </div>
                </div>

                {/* Document ID */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg min-w-0">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                            Document ID
                        </p>
                        <p className="text-sm font-mono font-medium truncate">
                            {selectedDocument.id || 'N/A'}
                        </p>
                    </div>
                </div>

            </div>

            {/* ================= BADGES ================= */}
            <div className="mt-4 flex flex-wrap items-center gap-2">

                {/* MIME */}
                <span className="
            inline-flex items-center px-3 py-1.5
            rounded-full border
            border-blue-200 dark:border-blue-800
            bg-blue-50 dark:bg-blue-900/20
            text-blue-700 dark:text-blue-300
            text-xs font-medium
        ">
                    <FileText className="w-3 h-3 mr-1.5" />
                    {selectedDocument.mimeType}
                </span>

                {/* Storage */}
                {selectedDocument.fileUrl && (
                    <a
                        href={selectedDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                    inline-flex items-center px-3 py-1.5
                    rounded-full border
                    border-gray-200 dark:border-slate-700
                    bg-gray-50 dark:bg-slate-800
                    text-gray-700 dark:text-slate-300
                    text-xs font-medium
                    hover:bg-gray-100 dark:hover:bg-slate-700
                    transition-colors
                "
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