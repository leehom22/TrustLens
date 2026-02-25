import { AlertTriangle, CheckCircle, Loader2, Badge, FileText, Download, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useEffect, useState } from "react";
import axios from 'axios'
import { toast } from "react-toastify";
import { DocumentAnalysisResult, FileHeader, RiskLevel, RiskLevelColor } from "@/app/types/db-ai-analysis-type";
import Metadata from "../components/expert/expertDocumentAnalysis/analysisTab/Metadata";
import { VisualManipulation } from "../components/analysis/HeatmapVisualization";
import ContentAnalysis from "../components/expert/expertDocumentAnalysis/analysisTab/ContentAnalysis";
import LogicalConsistency from "../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings";
import AiAssistant from "../components/analysis/AiAssistant";
import DocumentViewer from "../components/analysis/DocumentViewer";
import { useNavigate, useParams } from "react-router-dom";
import { handlePdfDownload, setFileAsFlagged } from "@/api/document";
import { Button } from "../components/ui/button";
import DocumentFeedback from "../components/analysis/DocumentFeedback";
import { statusStyles } from "@/lib/utils";
import { decryptFile, getAccessibleDocumentUrl } from "@/lib/encrypt";

type AnalysisStage = "idle" | "analyzing" | "complete";

export function HistoryDocumentAnalysis() {
    //** User side - Document Analysis Result page */
    const [ai_analysis_format, setAi_analysis] = useState<DocumentAnalysisResult | null>(null)
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [selectedDocument, setSelectedDocument] = useState<FileHeader | null>(null)
    const [requestReview, setRequestReview] = useState<boolean>(false)
    const [flaggedReason, setflaggedReason] = useState<string>('')
    const params = useParams()
    const docId = params.docId
    const navigate = useNavigate()

    const [openFeedback, setOpenFeedback] = useState({
        metadata: false,
        heatmap: false,
        contentAnalysis: false,
        findings: false
    })
    const [loadingData, setLoadingData] = useState(false)
    const [stage, setStage] = useState<AnalysisStage>("complete");
    const [raw_analysis_id, setRaw_analysis_id] = useState<string | null>(null)
    const [doc_type, setDoc_type] = useState<string | null>(null)
    const [structure_analysis_id, setStructure_analysis_id] = useState<string>('')
    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);
    const [riskLevelColor, setRiskLevelColor] = useState<RiskLevelColor>('gray')
    const [riskLevel, setRiskLevel] = useState<RiskLevel>('SAFE')
    const [overallScore, setOverallScore] = useState<number>(0)

    const fetchingDocucmentAnalysis = async (docId: string) => {
        try {
            const formData = new FormData()
            formData.append('docId', docId)
            // console.log("Fetching structure analysis data")
            const res = await axios.post(`${backendUrl}/analysis/get-doc-analysis`, formData)
            const result = res.data

            if (result.success === true) {
                setAi_analysis(result.data?.analysis_content)
                // console.log("The ai analysis format is: ", result.data?.analysis_content)
                setRiskLevelColor(result.data?.analysis_content?.dashboard_header?.risk_level_color || 'gray')
                setRiskLevel(result.data?.analysis_content?.dashboard_header?.risk_level || 'SAFE')
                setRaw_analysis_id(result.data?.raw_analysis_id)
                setDoc_type(result.data?.doc_type)
                setStructure_analysis_id(result.data?.id)
                setOverallScore(result.data?.analysis_content?.dashboard_header?.overall_score || 0)

                // console.log("The structure data is: ", result.data)
            } else {
                toast.error("Failed to fetch document analysis")
                return
            }
        } catch (error) {
            toast.error("Failed to fetch document analysis")
            console.log("Error fetching document analysis: ", error)
        }
    }
    //** main  */
    const fetchingFile = async () => {
        try {
            setLoadingData(true);

            if (!docId) {
                toast.error("Document Id not found!");
                return;
            }

            const response = await axios.get(
                `${backendUrl}/files/get_selected_files/${docId}`
            );

            const result = response.data;

            if (result.success === true) {
                const documentData = result.data;

                // 🔐 Decrypt using fresh data (NOT state)
                const accessibleUrl = await getAccessibleDocumentUrl(
                    documentData.fileUrl,
                    documentData.encryptedKey!,
                    documentData.iv!
                );

                // console.log("Decrypted key:", accessibleUrl);

                // ✅ Now update state once
                setSelectedDocument({
                    ...documentData,
                    fileUrl: accessibleUrl || documentData.fileUrl,
                });

                await fetchingDocucmentAnalysis(docId);
            }
        } catch (error) {
            toast.error("Failed to load document");
            console.log("Error loading document:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleConfirmReview = async () => {
        try {
            const res = await setFileAsFlagged(docId!, flaggedReason)

            if (res.success) {
                setRequestReview(false)
                toast.success("Successfully request for review")
            } else {
                toast.error("Failed to request for review. Please try again later")
            }
        } catch (error) {
            console.log("Error request for a review: ", error)
        }
    }

    useEffect(() => {
        // console.log("the Document Id is :", docId)
        // fetch document from backend
        fetchingFile()
    }, [docId])
    return (
        <>
            {loadingData === true ? (
                <div className="w-full flex items-center justify-center inset-0 fixed z-50">
                    <Loader2 className="animate-spin" size={50} />
                </div>
            ) : (
                <div className="flex flex-col w-full min-h-screen bg-slate-50 dark:bg-slate-950">

                    {/* Sticky Header */}
                    <div className="border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 left-0 right-0 z-40">
                        <div className="w-full mx-auto px-3 sm:px-4 md:px-6 py-2.5 md:py-3.5 flex items-center justify-between gap-2">
                            {/* Left: back + filename */}
                            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                                <Button
                                    variant="ghost"
                                    className="text-gray-700 dark:text-slate-300 px-2 sm:px-3 text-sm flex-shrink-0"
                                    onClick={() => navigate('/history')}
                                >
                                    ← <span className="hidden sm:inline ml-1">Back</span>
                                </Button>
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[130px] sm:max-w-xs md:max-w-sm lg:max-w-lg">
                                            {selectedDocument?.fileName}
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">Forensic Analysis</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: status */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {stage === "analyzing" && (
                                    <span className="text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                        <span className="hidden sm:inline">Analyzing...</span>
                                    </span>
                                )}
                                {stage === "complete" && (
                                    <span className="text-xs text-green-600 flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span className="hidden sm:inline">Complete</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 p-3 sm:p-4 lg:p-8">

                        {/* LEFT: Document + AI Assistant tabs — below on mobile, left on desktop */}
                        <div className="lg:col-span-5 order-2 lg:order-1 flex flex-col gap-4">
                            <Tabs defaultValue="document" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <TabsTrigger
                                        value="document"
                                        className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                  data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                  dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                  text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                        Document
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="ai-assistant"
                                        className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                  data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                  dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                  text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                        AI Assistant
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="document" className="h-full m-0">
                                    <DocumentViewer fileType={selectedDocument?.mimeType!} fileUrl={selectedDocument?.fileUrl!} />
                                </TabsContent>
                                <TabsContent value="ai-assistant" className="h-full">
                                    <AiAssistant reqId={raw_analysis_id!} initialMessages={chatMessages} stage={stage} userType="user" />
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* RIGHT: Analysis results — top on mobile, right on desktop */}
                        <div className="lg:col-span-7 order-1 lg:order-2 flex flex-col gap-4">

                            {/* Executive Summary Card */}
                            <div className={`rounded-2xl border-2 p-4 md:p-6 transition-colors shadow-sm ${statusStyles[riskLevelColor]}`}>
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                                    {/* Icon + Title */}
                                    <div className="flex items-start gap-3">
                                        {riskLevel === "CRITICAL" ? (
                                            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                        ) : riskLevel === "SUSPICIOUS" ? (
                                            <AlertCircle className="w-7 h-7 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                                        ) : riskLevel === "CAUTION" ? (
                                            <AlertCircle className="w-7 h-7 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <h2 className="text-base md:text-xl font-bold dark:text-white">
                                                {riskLevel === "CRITICAL" && "High Risk Detected"}
                                                {riskLevel === "SUSPICIOUS" && "Significant Risk - Review Required"}
                                                {riskLevel === "CAUTION" && "Minor Inconsistencies Detected"}
                                                {riskLevel === "SAFE" && "Low Risk / Document Verified"}
                                            </h2>
                                            <p className="text-xs sm:text-sm font-medium opacity-70">
                                                {ai_analysis_format?.dashboard_header?.verdict_title}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Badge */}
                                    {/* <Badge
                                        variant="outline"
                                        className={`self-start flex-shrink-0 text-xs sm:text-sm font-semibold ${riskLevel === "CRITICAL" ? "text-red-600 bg-red-50"
                                                : riskLevel === "SUSPICIOUS" ? "text-orange-600 "
                                                    : riskLevel === "CAUTION" ? "text-yellow-700 "
                                                        : "text-green-600 "
                                            }`}
                                    >
                                        {ai_analysis_format?.dashboard_header?.risk_level}
                                    </Badge> */}
                                    <div>Risk Level: {ai_analysis_format?.dashboard_header?.risk_level}(Risk Score: {overallScore})</div>
                                </div>

                                <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {ai_analysis_format?.dashboard_header?.ai_executive_summary}
                                </p>
                            </div>

                            {/* Detailed Findings Tabs */}
                            <Tabs defaultValue="metadata" className="w-full">

                                {/* Action buttons + scrollable tab list */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                    {/* Scrollable tabs */}
                                    <div className="overflow-x-auto pb-1 -mb-1 flex-1">
                                        <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-11 px-2 flex w-max min-w-full sm:min-w-0">
                                            {[
                                                { value: 'metadata', label: 'Metadata' },
                                                { value: 'heatmap', label: 'Visuals' },
                                                { value: 'content', label: 'Semantics' },
                                                { value: 'findings', label: 'Consistency' },
                                            ].map(({ value, label }) => (
                                                <TabsTrigger
                                                    key={value}
                                                    value={value}
                                                    className="px-3 sm:px-4 py-2 rounded-sm text-xs sm:text-sm whitespace-nowrap
                        data-[state=active]:text-blue-600 data-[state=active]:font-bold
                        dark:text-slate-400 dark:data-[state=active]:text-blue-400"
                                                >
                                                    {label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            className={`py-1.5 px-3 border rounded-lg text-xs sm:text-sm whitespace-nowrap ${selectedDocument?.flagged === false
                                                ? 'border-red-500 text-red-500 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20'
                                                : 'border-gray-400 text-gray-400 cursor-not-allowed'
                                                } transition-colors`}
                                            onClick={() => setRequestReview(true)}
                                            disabled={selectedDocument?.flagged!}
                                        >
                                            Request Review
                                        </button>
                                        <button
                                            className="flex items-center gap-1.5 py-1.5 px-3 border rounded-lg border-gray-400 text-gray-600 dark:text-slate-300 text-xs sm:text-sm whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                            onClick={() => handlePdfDownload(selectedDocument?.id!, structure_analysis_id, selectedDocument?.fileName!, 'user')}
                                        >
                                            <Download size={15} />
                                            <span className="hidden sm:inline">Download</span>
                                            <span className="sm:hidden">PDF</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Tab Contents */}
                                <TabsContent value="metadata" className="main-card-container">
                                    <Metadata layer={ai_analysis_format?.layer_results[0]!} />
                                    {!openFeedback.metadata ? (
                                        <div className="flex justify-end mt-4">
                                            <button
                                                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                onClick={() => setOpenFeedback(prev => ({ ...prev, metadata: true }))}
                                            >
                                                Give Feedback
                                            </button>
                                        </div>
                                    ) : (
                                        <DocumentFeedback layerType="layer1" setOpenFeedback={setOpenFeedback} section="Metadata & Source" analysis_id={raw_analysis_id!} document_class={doc_type} />
                                    )}
                                </TabsContent>

                                <TabsContent value="heatmap">
                                    <VisualManipulation layer={ai_analysis_format?.layer_results[1]!} />
                                    {!openFeedback.heatmap ? (
                                        <div className="flex justify-end mt-4">
                                            <button
                                                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                onClick={() => setOpenFeedback(prev => ({ ...prev, heatmap: true }))}
                                            >
                                                Give Feedback
                                            </button>
                                        </div>
                                    ) : (
                                        <DocumentFeedback layerType="layer2" setOpenFeedback={setOpenFeedback} section="Visual Manipulation" analysis_id={raw_analysis_id!} document_class={doc_type} />
                                    )}
                                </TabsContent>

                                <TabsContent value="content">
                                    <ContentAnalysis layer={ai_analysis_format?.layer_results[2]!} />
                                    {!openFeedback.contentAnalysis ? (
                                        <div className="flex justify-end mt-4">
                                            <button
                                                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                onClick={() => setOpenFeedback(prev => ({ ...prev, contentAnalysis: true }))}
                                            >
                                                Give Feedback
                                            </button>
                                        </div>
                                    ) : (
                                        <DocumentFeedback layerType="layer3" setOpenFeedback={setOpenFeedback} section="Content Semantics" analysis_id={raw_analysis_id!} document_class={doc_type} />
                                    )}
                                </TabsContent>

                                <TabsContent value="findings">
                                    <LogicalConsistency
                                        layer={ai_analysis_format?.layer_results[3]!}
                                        nextStepRecommendation={ai_analysis_format?.dashboard_header.next_step_recommendation}
                                        sources={ai_analysis_format?.dashboard_header?.sources}
                                    />
                                    {!openFeedback.findings ? (
                                        <div className="flex justify-end mt-4">
                                            <button
                                                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                onClick={() => setOpenFeedback(prev => ({ ...prev, findings: true }))}
                                            >
                                                Give Feedback
                                            </button>
                                        </div>
                                    ) : (
                                        <DocumentFeedback layerType="layer4" setOpenFeedback={setOpenFeedback} section="Logical Consistency" analysis_id={raw_analysis_id!} document_class={doc_type} />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Request Review Modal */}
                    {requestReview && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                onClick={() => setRequestReview(false)}
                            />
                            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                                <div className="mb-5">
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        Request Forensic Review
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                        This document will be prioritized for manual verification by our forensic team.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label
                                        htmlFor="review-reason"
                                        className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                                    >
                                        Reason for manual review
                                    </label>
                                    <textarea
                                        id="review-reason"
                                        rows={4}
                                        placeholder="Briefly describe why this document requires human oversight..."
                                        onChange={(e) => setflaggedReason(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                    <Button
                                        variant="ghost"
                                        className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-600"
                                        onClick={() => setRequestReview(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
                                        onClick={handleConfirmReview}
                                    >
                                        Confirm Request
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </>

    );
}