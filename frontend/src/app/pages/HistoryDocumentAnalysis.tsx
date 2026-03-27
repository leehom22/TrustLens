import { AlertTriangle, CheckCircle, Loader2, Badge, FileText, Download, AlertCircle, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useEffect, useState } from "react";
import axios from 'axios';
import { toast } from "react-toastify";
import { DocumentAnalysisResult, FileHeader, RiskLevelColor } from "@/app/types/db-ai-analysis-type";
import Metadata from "../components/expert/expertDocumentAnalysis/analysisTab/Metadata";
import { VisualManipulation } from "../components/analysis/HeatmapVisualization";
import ContentAnalysis from "../components/expert/expertDocumentAnalysis/analysisTab/ContentAnalysis";
import LogicalConsistency from "../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings";
import AiAssistant from "../components/analysis/AiAssistant";
import DocumentViewer from "../components/analysis/DocumentViewer";
import { useNavigate, useParams } from "react-router-dom";
import { handleConfirmSpam, handlePdfDownload, setFileAsFlagged } from "@/api/document";
import { Button } from "../components/ui/button";
import { statusStyles } from "@/lib/utils";
import { getAccessibleDocumentUrl } from "@/lib/encrypt";
import { useLanguage } from "../components/LanguageProvider";
import { LanguageToggleButton } from "../components/LanguageToggleButton";
import RequestReview from "../components/modal/RequestReview";
import { SpamReviewInterface } from "../types/type";
import ConfirmSpam from "../components/modal/ConfirmSpam";

type AnalysisStage = "idle" | "analyzing" | "complete" | "error";

export function HistoryDocumentAnalysis() {
    const { docId, masterDocId } = useParams();
    const navigate = useNavigate();
    const { language } = useLanguage();

    const [ai_analysis_format, setAi_analysis_format] = useState<DocumentAnalysisResult | null>(null);
    const [fileUrl, setFileUrl] = useState<string>('');
    const [fileType, setFileType] = useState<string>('');
    const [doc_type, setDoc_type] = useState<string>('');
    const [fileHeader, setFileHeader] = useState<FileHeader | null>(null);
    const [requestReview, setRequestReview] = useState<boolean>(false);
    const [flaggedReason, setflaggedReason] = useState<string>("");
    const [raw_analysis_id, setRaw_analysis_id] = useState('');
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [stage, setStage] = useState<AnalysisStage>("idle");
    const [confirmSpamReview, setConfirmSpamReview] = useState<SpamReviewInterface>({
        comment: '',
        state: null,
        phone: null
    });
    const [confirmSpam, setConfirmSpam] = useState<boolean>(false);

    // --- LANGUAGE CONTEXT ---
    const t = {
        en: {
            loading: "Loading document...",
            corruptedTitle: "Analysis Data Corrupted",
            corruptedDesc: "This document's analysis format is incompatible.",
            returnBtn: "Return to History",
            back: "← Back",
            document: "Document",
            riskLevel: "Risk Level",
            metadata: "Metadata",
            visuals: "Visuals",
            semantics: "Semantics",
            consistency: "Consistency",
            reviewInProgress: "Review In Progress",
            review: "Review",
            spam: "Report",
            download: "Download",
            noMetadata: "No metadata information available.",
            noVisuals: "No visual analysis available.",
            noSemantics: "No semantic content data available.",
            noLogic: "No logic checks available.",
            aiAssistant: "AI Assistant",
            reqReviewSuccess: "Successfully requested for review",
            reqReviewFail: "Failed to request for review. Please try again later",
            errIncomplete: "Document analysis data is incomplete or uses an outdated format.",
            errCors: "Firebase CORS error: Cannot download file for decryption.",
            errDecrypt: "Failed to decrypt the document. It might be corrupted."
        },
        ms: {
            loading: "Memuatkan dokumen...",
            corruptedTitle: "Data Analisis Rosak",
            corruptedDesc: "Format analisis dokumen ini tidak serasi.",
            returnBtn: "Kembali ke Sejarah",
            back: "← Kembali",
            document: "Dokumen",
            riskLevel: "Tahap Risiko",
            metadata: "Metadata",
            visuals: "Visual",
            semantics: "Semantik",
            consistency: "Konsistensi",
            reviewInProgress: "Sedang Disemak",
            review: "Semak",
            spam: "Lapor",
            download: "Muat Turun",
            noMetadata: "Tiada maklumat metadata tersedia.",
            noVisuals: "Tiada analisis visual tersedia.",
            noSemantics: "Tiada data kandungan semantik tersedia.",
            noLogic: "Tiada semakan logik tersedia.",
            aiAssistant: "Pembantu AI",
            reqReviewSuccess: "Berjaya memohon semakan",
            reqReviewFail: "Gagal memohon semakan. Sila cuba lagi nanti",
            errIncomplete: "Data analisis dokumen tidak lengkap atau menggunakan format lapuk.",
            errCors: "Ralat CORS Firebase: Tidak dapat memuat turun fail untuk penyahsulitan.",
            errDecrypt: "Gagal menyahsulit dokumen. Ia mungkin rosak."
        }
    }[language];

    useEffect(() => {
        const fetchAnalysis = async () => {
            setStage("analyzing");
            try {
                const formData = new FormData();
                formData.append("docId", docId!);
                formData.append("language", language);
                formData.append("masterDocId", masterDocId!);
                const res = await axios.post(`${backendUrl}/analysis/get-doc-analysis`, formData);
                const fileReqRes = await axios.get(`${backendUrl}/files/get_selected_files/${docId}`);

                if (res.status === 200 && fileReqRes.status === 200) {

                    const rawData = res.data?.data || res.data;
                    let content = null;

                    if (rawData?.i18n_content) {
                        content = rawData.i18n_content[language] || rawData.i18n_content['en'];
                    }
                    else if (rawData?.analysis_content) {
                        content = rawData.analysis_content;
                    }
                    else {
                        content = rawData;
                    }

                    if (typeof content === 'string') {
                        try {
                            content = JSON.parse(content);
                        } catch (e) {
                            console.error("Failed to parse analysis_content", e);
                        }
                    }

                    if (!content || !content.dashboard_header) {
                        setStage("error");
                        toast.error(t.errIncomplete);
                        return;
                    }

                    setStage("complete");
                    setAi_analysis_format(content);
                    setDoc_type(rawData?.doc_type || content?.doc_type || 'Unknown');
                    setRaw_analysis_id(rawData?.id || content?.id || '');
                    
                    // 🚀 FIX: Correctly extract the inner 'data' object from the backend response!
                    const documentData = fileReqRes.data.data || fileReqRes.data;
                    
                    setFileHeader(documentData);

                    const url = documentData.fileUrl;
                    const encryptedKey = documentData.encryptedKey;
                    const iv = documentData.iv;
                    const mimeType = documentData.mimeType;

                    try {
                        if (!url) {
                            console.warn("Document URL is missing in the database.");
                            setFileUrl("missing");
                            setFileType(mimeType || "");
                        }
                        else if (!encryptedKey || !iv) {
                            console.log("No encryption keys found. Loading as standard document.");
                            setFileUrl(url);
                            setFileType(mimeType);
                        } 
                        else {
                            const accessibleUrl = await getAccessibleDocumentUrl(url, encryptedKey, iv, mimeType);
                            setFileUrl(accessibleUrl || url);
                            setFileType(mimeType);
                        }
                    } catch (decryptionError: any) {
                        console.error("Decryption/Fetch Error:", decryptionError);

                        if (decryptionError.message === "Failed to fetch" || decryptionError.name === "TypeError") {
                            toast.error(t.errCors);
                        } else {
                            toast.error(t.errDecrypt);
                        }

                        setFileUrl(url || "missing");
                        setFileType(mimeType);
                    }
                } else {
                    setStage("error");
                }
            } catch (error) {
                setStage("error");
                console.log(error);
                toast.error("Failed to load document analysis");
            }
        };

        if (docId) fetchAnalysis();
    }, [docId, backendUrl, language]);

    const handleConfirmReview = async () => {
        try {
            const res = await setFileAsFlagged(docId!, flaggedReason);
            if (res.success) {
                toast.success(t.reqReviewSuccess);
                setRequestReview(false);
                if (fileHeader) setFileHeader({ ...fileHeader, flagged: true });
            } else {
                toast.error(t.reqReviewFail);
            }
        } catch (error) {
            console.log("Error request for a review: ", error);
        }
    };

    const riskLevelColor: RiskLevelColor = ai_analysis_format?.dashboard_header?.risk_level_color || 'gray';

    return (
        <>
            {stage === 'analyzing' && (
                <div className="flex h-screen items-center justify-center dark:bg-slate-900">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            )}
            {stage === 'error' && (
                <div className="flex flex-col h-screen items-center justify-center dark:bg-slate-900 gap-4">
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                    <h2 className="text-xl font-bold dark:text-white">{t.corruptedTitle}</h2>
                    <p className="text-slate-500">{t.corruptedDesc}</p>
                    <Button onClick={() => navigate('/history')}>{t.returnBtn}</Button>
                </div>
            )}
            {stage === 'complete' && ai_analysis_format && (
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 w-full pb-10">
                    <div className="fixed left-0 right-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm top-0">
                        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-700 dark:text-gray-200">
                                    {t.back}
                                </Button>
                                <div className="hidden sm:flex items-center gap-2 border-l pl-4 dark:border-slate-700">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-sm max-w-[200px] truncate dark:text-white">
                                        {fileHeader?.fileName || t.document}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <LanguageToggleButton variant="default" />
                            </div>
                        </div>
                    </div>

                    <div className="w-full mx-auto px-4 py-6 pt-20">
                        <div className="max-w-7xl mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
                                    <div className={`rounded-xl border-2 p-6 shadow-lg ${statusStyles[riskLevelColor]}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                                            <div className="flex items-start gap-3">
                                                {ai_analysis_format?.dashboard_header?.risk_level === "CRITICAL" ? (
                                                    <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mt-0.5" />
                                                ) : ai_analysis_format?.dashboard_header?.risk_level === "SUSPICIOUS" ? (
                                                    <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400 mt-0.5" />
                                                ) : ai_analysis_format?.dashboard_header?.risk_level === "CAUTION" ? (
                                                    <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                                ) : (
                                                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mt-0.5" />
                                                )}
                                                <h2 className="text-2xl font-bold dark:text-white">
                                                    {ai_analysis_format?.dashboard_header?.verdict_title}
                                                </h2>
                                            </div>

                                            <Badge variant="outline" className={`self-start text-sm font-semibold border-2 whitespace-nowrap 
                                                ${ai_analysis_format?.dashboard_header?.risk_level === "CRITICAL" ? "border-red-600 text-red-600 bg-red-50"
                                                    : ai_analysis_format?.dashboard_header?.risk_level === "SUSPICIOUS" ? "border-orange-500 text-orange-600 bg-orange-50"
                                                        : ai_analysis_format?.dashboard_header?.risk_level === "CAUTION" ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                                                            : "border-green-600 text-green-600 bg-green-50"}`}>
                                                {t.riskLevel}: {ai_analysis_format?.dashboard_header?.risk_level} ({ai_analysis_format?.dashboard_header?.overall_score})
                                            </Badge>
                                        </div>
                                        <p className="text-gray-800 dark:text-slate-200">
                                            {ai_analysis_format?.dashboard_header?.ai_executive_summary}
                                        </p>
                                    </div>

                                    <Tabs defaultValue="metadata" className="space-y-4 w-full">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="overflow-x-auto pb-1">
                                                <TabsList className="bg-white dark:bg-slate-800 border dark:border-slate-700 h-11">
                                                    <TabsTrigger value="metadata">{t.metadata}</TabsTrigger>
                                                    <TabsTrigger value="heatmap">{t.visuals}</TabsTrigger>
                                                    <TabsTrigger value="content">{t.semantics}</TabsTrigger>
                                                    <TabsTrigger value="findings">{t.consistency}</TabsTrigger>
                                                </TabsList>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    className="self-start sm:self-auto flex-shrink-0 py-1.5 px-4 border rounded-lg border-red-500 text-red-500 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    onClick={() => setRequestReview(true)}
                                                    disabled={fileHeader?.flagged}
                                                >
                                                    {fileHeader?.flagged ? t.reviewInProgress : t.review}
                                                </button>
                                                <button
                                                    className="self-start sm:self-auto flex-shrink-0 py-1.5 px-4 border rounded-lg border-red-500 text-red-500 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    onClick={() => setConfirmSpam(true)}
                                                >
                                                    {t.spam}
                                                </button>
                                                <Button
                                                    variant="outline"
                                                    className="flex items-center gap-2 bg-white dark:bg-slate-800 dark:border-slate-700"
                                                    onClick={() => handlePdfDownload(fileHeader?.fileName!, docId!, raw_analysis_id, "user")}
                                                >
                                                    <Download className="w-4 h-4" /> {t.download}
                                                </Button>
                                            </div>
                                        </div>

                                        <TabsContent value="metadata">
                                            {ai_analysis_format?.layer_results?.[0] ? (
                                                <Metadata layer={ai_analysis_format.layer_results[0]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">{t.noMetadata}</div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="heatmap">
                                            {ai_analysis_format?.layer_results?.[1] ? (
                                                <VisualManipulation layer={ai_analysis_format.layer_results[1]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">{t.noVisuals}</div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="content">
                                            {ai_analysis_format?.layer_results?.[2] ? (
                                                <ContentAnalysis layer={ai_analysis_format.layer_results[2]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">{t.noSemantics}</div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="findings">
                                            {ai_analysis_format?.layer_results?.[3] ? (
                                                <LogicalConsistency
                                                    layer={ai_analysis_format.layer_results[3]}
                                                    nextStepRecommendation={ai_analysis_format?.dashboard_header?.next_step_recommendation}
                                                    sources={ai_analysis_format?.dashboard_header?.sources}
                                                />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">{t.noLogic}</div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                <Tabs className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-3" defaultValue="document">
                                    <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1">
                                        <TabsTrigger value="document">{t.document}</TabsTrigger>
                                        <TabsTrigger value="ai-assistant">{t.aiAssistant}</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="document">
                                        <DocumentViewer fileType={fileType} fileUrl={fileUrl} />
                                    </TabsContent>
                                    <TabsContent value="ai-assistant">
                                        <AiAssistant reqId={raw_analysis_id} stage="complete" userType="user" />
                                    </TabsContent>
                                </Tabs>

                            </div>
                        </div>
                    </div>

                    {requestReview && (
                        <RequestReview
                            handleConfirmReview={() => handleConfirmReview()}
                            setRequestReview={setRequestReview}
                            setflaggedReason={setflaggedReason}
                        />
                    )}
                    {confirmSpam && (
                        <ConfirmSpam
                            confirmSpamReview={confirmSpamReview}
                            handleConfirmSpam={() => handleConfirmSpam(confirmSpamReview, setConfirmSpam, docId!)}
                            setConfirmSpam={setConfirmSpam}
                            setConfirmSpamReview={setConfirmSpamReview}
                        />
                    )}
                </div>
            )}
        </>
    );
}