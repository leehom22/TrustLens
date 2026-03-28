import { AlertTriangle, Loader2, X } from 'lucide-react'
import React from 'react'
import { useLanguage } from '../LanguageProvider'

interface DisputeModalProps {
    setShowDisputeModal:React.Dispatch<React.SetStateAction<boolean>>
    setDisputeReason:React.Dispatch<React.SetStateAction<string>>
    setDisputeFile: React.Dispatch<React.SetStateAction<File | null>>
    setIsDisputing: React.Dispatch<React.SetStateAction<boolean>>
    disputeReason:string 
    isDisputing:boolean 
    handleDisputeSubmit: () => Promise<void>
}
    
const DisputeModal = ({setDisputeFile,setDisputeReason,setIsDisputing,setShowDisputeModal,disputeReason,isDisputing,handleDisputeSubmit}:DisputeModalProps) => {
    const {language} = useLanguage()

    const t = {
        en: {
            errFetch: "Could not load community reports.",
            errLogin: "Please log in to post a comment.",
            successPost: "Comment shared!",
            errPost: "Failed to post comment.",
            errHelpful: "Failed to mark comment as helpful.",
            errReason: "Please provide a reason for the dispute.",
            successDispute: "Dispute submitted successfully for review.",
            errDispute: "Failed to submit dispute. Please try again.",
            you: "YOU",
            placeholder: "Write a report...",
            post: "Post",
            noReports: "No reports yet.",
            helpful: "Helpful",
            commReports: "Community Reports",
            disputeAlert: "Dispute Alert",
            disputeThis: "Dispute this Alert",
            disputeDesc: "If you believe this alert is inaccurate or violates PDPA guidelines, please provide details below.",
            reasonLabel: "Reason for Dispute *",
            reasonPlaceholder: "Please explain why this alert should be reviewed...",
            evidenceLabel: "Evidence File (Optional)",
            cancel: "Cancel",
            submitDispute: "Submit Dispute"
        },
        ms: {
            errFetch: "Tidak dapat memuatkan laporan komuniti.",
            errLogin: "Sila log masuk untuk menghantar komen.",
            successPost: "Komen dikongsi!",
            errPost: "Gagal menghantar komen.",
            errHelpful: "Gagal menanda komen sebagai berguna.",
            errReason: "Sila berikan sebab untuk pertikaian ini.",
            successDispute: "Pertikaian berjaya dihantar untuk semakan.",
            errDispute: "Gagal menghantar pertikaian. Sila cuba lagi.",
            you: "ANDA",
            placeholder: "Tulis laporan...",
            post: "Hantar",
            noReports: "Tiada laporan lagi.",
            helpful: "Berguna",
            commReports: "Laporan Komuniti",
            disputeAlert: "Pertikai Amaran",
            disputeThis: "Pertikai Amaran ini",
            disputeDesc: "Jika anda percaya amaran ini tidak tepat atau melanggar garis panduan PDPA, sila berikan butiran di bawah.",
            reasonLabel: "Sebab Pertikaian *",
            reasonPlaceholder: "Sila terangkan mengapa amaran ini perlu disemak...",
            evidenceLabel: "Fail Bukti (Pilihan)",
            cancel: "Batal",
            submitDispute: "Hantar Pertikaian"
        }
    }[language];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-transparent dark:border-slate-700">
                <button
                    onClick={() => setShowDisputeModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    {t.disputeThis}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                    {t.disputeDesc}
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.reasonLabel}</label>
                        <textarea
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            placeholder={t.reasonPlaceholder}
                            className="w-full text-sm border border-gray-300 dark:border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 focus:border-red-400 dark:focus:border-red-500 outline-none min-h-[100px] bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.evidenceLabel}</label>
                        <input
                            type="file"
                            onChange={(e) => setDisputeFile(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 dark:file:bg-red-900/20 file:text-red-700 dark:file:text-red-400 hover:file:bg-red-100 dark:hover:file:bg-red-900/30 cursor-pointer"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setShowDisputeModal(false)}
                            className="flex-1 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleDisputeSubmit}
                            disabled={isDisputing || !disputeReason.trim()}
                            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-red-700 transition-colors flex justify-center items-center"
                        >
                            {isDisputing ? <Loader2 className="w-4 h-4 animate-spin" /> : t.submitDispute}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DisputeModal