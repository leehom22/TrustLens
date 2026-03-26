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
import {  handleConfirmSpam, handlePdfDownload, setFileAsFlagged } from "@/api/document";
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
    })
    const [confirmSpam, setConfirmSpam] = useState<boolean>(false)

    useEffect(() => {
        const fetchAnalysis = async () => {
            setStage("analyzing");
            try {
                const formData = new FormData();
                formData.append("docId", docId!);
                formData.append("language", language);
                formData.append("masterDocId",masterDocId!)
                const res = await axios.post(`${backendUrl}/analysis/get-doc-analysis`, formData);
                const fileReqRes = await axios.get(`${backendUrl}/files/get_selected_files/${docId}`);

                if (res.status === 200 && fileReqRes.status === 200) {

                    // CRASH FIX: Safely extract content based on the exact DB structure
                    const rawData = res.data?.data || res.data;
                    let content = null;

                    // 1. Newest Format (Bilingual Support via i18n_content)
                    if (rawData?.i18n_content) {
                        content = rawData.i18n_content[language] || rawData.i18n_content['en'];
                    }
                    // 2. Older Format (Nested in analysis_content)
                    else if (rawData?.analysis_content) {
                        content = rawData.analysis_content;
                    }
                    // 3. Oldest Format (Root level properties)
                    else {
                        content = rawData;
                    }

                    // If the data was stringified in the DB, parse it back to JSON
                    if (typeof content === 'string') {
                        try {
                            content = JSON.parse(content);
                        } catch (e) {
                            console.error("Failed to parse analysis_content", e);
                        }
                    }

                    // Guard against completely broken documents
                    if (!content || !content.dashboard_header) {
                        setStage("error");
                        toast.error("Document analysis data is incomplete or uses an outdated format.");
                        return;
                    }

                    setStage("complete");
                    setAi_analysis_format(content);
                    setDoc_type(rawData?.doc_type || content?.doc_type || 'Unknown');
                    setRaw_analysis_id(rawData?.id || content?.id || '');
                    setFileHeader(fileReqRes.data);

                    const url = fileReqRes.data.fileUrl;
                    const encryptedKey = fileReqRes.data.encryptedKey;
                    const iv = fileReqRes.data.iv;

                    try {
                        const accessibleUrl = await getAccessibleDocumentUrl(url, encryptedKey, iv);
                        setFileUrl(accessibleUrl);
                        setFileType(fileReqRes.data.mimeType);
                    } catch (decryptionError) {
                        toast.error("Failed to decrypt the document. It might be corrupted.");
                        console.error(decryptionError);
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
                toast.success("Successfully request for review");
                setRequestReview(false);
                if (fileHeader) setFileHeader({ ...fileHeader, flagged: true });
            } else {
                toast.error("Failed to request for review. Please try again later");
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
                    <h2 className="text-xl font-bold dark:text-white">Analysis Data Corrupted</h2>
                    <p className="text-slate-500">This document's analysis format is incompatible.</p>
                    <Button onClick={() => navigate('/history')}>Return to History</Button>
                </div>
            )}
            {stage === 'complete' && ai_analysis_format && (
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 w-full pb-10">
                    <div className="fixed left-0 right-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm top-0">
                        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-700 dark:text-gray-200">
                                    ← Back
                                </Button>
                                <div className="hidden sm:flex items-center gap-2 border-l pl-4 dark:border-slate-700">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-sm max-w-[200px] truncate dark:text-white">
                                        {fileHeader?.fileName || "Document"}
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
                                                Risk Level: {ai_analysis_format?.dashboard_header?.risk_level} ({ai_analysis_format?.dashboard_header?.overall_score})
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
                                                    <TabsTrigger value="metadata">{language === 'ms' ? 'Metadata' : 'Metadata'}</TabsTrigger>
                                                    <TabsTrigger value="heatmap">{language === 'ms' ? 'Visual' : 'Visuals'}</TabsTrigger>
                                                    <TabsTrigger value="content">{language === 'ms' ? 'Semantik' : 'Semantics'}</TabsTrigger>
                                                    <TabsTrigger value="findings">{language === 'ms' ? 'Konsistensi' : 'Consistency'}</TabsTrigger>
                                                </TabsList>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    className="self-start sm:self-auto flex-shrink-0 py-1.5 px-4 border rounded-lg border-red-500 text-red-500 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    onClick={() => setRequestReview(true)}
                                                    disabled={fileHeader?.flagged}
                                                >
                                                    {fileHeader?.flagged ? (language === 'ms' ? "Sedang Disemak" : "Review In Progress") : (language === 'ms' ? " Semak" : " Review")}
                                                </button>
                                                <button
                                                    className="self-start sm:self-auto flex-shrink-0 py-1.5 px-4 border rounded-lg border-red-500 text-red-500 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    onClick={() => setConfirmSpam(true)}
                                                >
                                                    Spam
                                                </button>
                                                <Button
                                                    variant="outline"
                                                    className="flex items-center gap-2 bg-white dark:bg-slate-800 dark:border-slate-700"
                                                    onClick={() => handlePdfDownload(fileHeader?.fileName!, docId!, raw_analysis_id, "user")}
                                                >
                                                    <Download className="w-4 h-4" /> Download
                                                </Button>
                                            </div>
                                        </div>

                                        <TabsContent value="metadata">
                                            {ai_analysis_format?.layer_results?.[0] ? (
                                                <Metadata layer={ai_analysis_format.layer_results[0]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">No metadata information available.</div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="heatmap">
                                            {ai_analysis_format?.layer_results?.[1] ? (
                                                <VisualManipulation layer={ai_analysis_format.layer_results[1]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">No visual analysis available.</div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="content">
                                            {ai_analysis_format?.layer_results?.[2] ? (
                                                <ContentAnalysis layer={ai_analysis_format.layer_results[2]} />
                                            ) : (
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">No semantic content data available.</div>
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
                                                <div className="p-6 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">No logic checks available.</div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                <Tabs className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-3" defaultValue="document">
                                    <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1">
                                        <TabsTrigger value="document">{language === 'ms' ? 'Dokumen' : 'Document'}</TabsTrigger>
                                        <TabsTrigger value="ai-assistant">{language === 'ms' ? 'Pembantu AI' : 'AI Assistant'}</TabsTrigger>
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
                    {
                        confirmSpam && (
                            <ConfirmSpam
                                confirmSpamReview={confirmSpamReview}
                                handleConfirmSpam={() => handleConfirmSpam(confirmSpamReview, setConfirmSpam,docId!)}
                                setConfirmSpam={setConfirmSpam}
                                setConfirmSpamReview={setConfirmSpamReview}
                            />
                        )
                    }
                </div>
            )}
        </>
    );
}