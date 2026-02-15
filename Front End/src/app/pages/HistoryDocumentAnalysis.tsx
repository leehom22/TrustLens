import { AlertTriangle, CheckCircle, Loader2, Badge, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useEffect, useState } from "react";
import axios from 'axios'
import { toast } from "react-toastify";
import { DocumentAnalysisResult, FileHeader } from "@/app/types/db-ai-analysis-type";
import Metadata from "../components/expert/expertDocumentAnalysis/analysisTab/Metadata";
import { VisualManipulation } from "../components/analysis/HeatmapVisualization";
import ContentAnalysis from "../components/expert/expertDocumentAnalysis/analysisTab/ContentAnalysis";
import LogicalConsistency from "../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings";
import AiAssistant from "../components/analysis/AiAssistant";
import DocumentViewer from "../components/analysis/DocumentViewer";
import { useNavigate, useParams } from "react-router-dom";
import { setFileAsFlagged } from "@/api/document";
import { Button } from "../components/ui/button";
import DocumentFeedback from "../components/analysis/DocumentFeedback";

type AnalysisStage = "idle" | "analyzing" | "complete";

export function HistoryDocumentAnalysis() {
    //** User side - Document Analysis Result page */
    const [ai_analysis_format, setAi_analysis] = useState<DocumentAnalysisResult | null>(null)
    const riskLevel = ai_analysis_format?.dashboard_header?.risk_level; // low, medium, high
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
    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
    
    const fetchingDocucmentAnalysis = async (docId: string) => {
        try {
            const formData = new FormData()
            formData.append('docId', docId)
            console.log("Fetching structure analysis data")
            const res = await axios.post(`${backendUrl}/analysis/get-doc-analysis`, formData)
            const result = res.data

            if (result.success === true) {
                setAi_analysis(result.data?.analysis_content)
                setRaw_analysis_id(result.data?.raw_analysis_id)
                setDoc_type(result.data?.doc_type)
                console.log("The structure data is: ", result.data)
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
            setLoadingData(true)
            if (docId) {
                const response = await axios.get(`${backendUrl}/files/get_selected_files/${docId}`)
                const result = response.data

                if (result.success === true) {
                    setSelectedDocument(result.data)
                    await fetchingDocucmentAnalysis(docId)
                }
            } else {
                toast.error("Document Id not found!")
                return
            }
        } catch (error) {
            toast.error("Failed to laod document")
            console.log("Error loading document: ", error)
        } finally {
            setLoadingData(false)
        }
    }

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
        console.log("the Document Id is :", docId)
        // fetch document from backend
        fetchingFile()
    }, [docId])
    return (
        <>
            {
                loadingData === true ?
                    <div className="w-full flex items-center justify-center inset-0 fixed z-50">
                        <Loader2 className="relative animate-spin mx-auto" size={50} />
                    </div> :
                    <div className="flex flex-col w-385">
                        <div className={` border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 left-0 right-0 z-10`}>
                            <div className="w-full mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                    <Button variant="ghost"  className="text-gray-700 dark:text-slate-300" onClick={() => navigate('/history')}>← Back</Button>
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <h2 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base truncate">{selectedDocument?.fileName}</h2>
                                            <p className="text-xs text-gray-600 dark:text-slate-400 hidden sm:block">Forensic Analysis</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {stage === "analyzing" && (
                                        <span className="text-xs md:text-sm text-gray-700 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin text-blue-600" /> Analyzing...</span>
                                    )}
                                    {stage === "complete" && (
                                        <span className="text-xs md:text-sm text-green-600 flex items-center gap-1"><span className="w-2 h-2 bg-green-600 rounded-full"></span> Complete</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-6 p-4 lg:p-8 min-h-screen bg-slate-50 dark:bg-slate-950">

                            {/* LEFT COLUMN: Interaction & Preview (Col span 5) */}
                            <div className="lg:col-span-5 flex flex-col gap-6">
                                <Tabs defaultValue="document" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <TabsTrigger value="document" className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                                        data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                                        dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                                        text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                            Document
                                        </TabsTrigger>
                                        <TabsTrigger value="ai-assistant" className="rounded-lg px-4 py-2 text-sm font-medium transition-all
                                            data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
                                            dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
                                            text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                            AI Assistant
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="document" className="h-full m-0">
                                        <DocumentViewer
                                            fileType={selectedDocument?.mimeType!}
                                            fileUrl={selectedDocument?.fileUrl!}
                                        />
                                    </TabsContent>
                                    <TabsContent value="ai-assistant" className="h-full ">
                                        <AiAssistant messages={chatMessages} stage={stage} />
                                    </TabsContent>
                                    {/* </div> */}
                                </Tabs>
                            </div>

                            {/* RIGHT COLUMN: Analysis Results (Col span 7) */}
                            <div className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto w-full">

                                {/* Executive Summary Header */}
                                <div className={`rounded-2xl border-2 p-6 transition-colors shadow-sm ${riskLevel === "CRITICAL" ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50" :
                                    riskLevel === "SUSPICIOUS" ? "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50" :
                                        "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50"
                                    }`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${riskLevel === "CRITICAL" ? "bg-red-100 text-red-600" :
                                                riskLevel === "SUSPICIOUS" ? "bg-yellow-100 text-yellow-600" :
                                                    "bg-green-100 text-green-600"
                                                }`}>
                                                {riskLevel === "CRITICAL" || riskLevel === "SUSPICIOUS" ? <AlertTriangle className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold dark:text-white">
                                                    {riskLevel === "CRITICAL" ? "High Risk Detected" : riskLevel === "SUSPICIOUS" ? "Medium Risk Found" : "Legitimacy Verified"}
                                                </h2>
                                                <p className="text-sm font-medium opacity-70">{ai_analysis_format?.dashboard_header?.verdict_title}</p>
                                            </div>
                                        </div>
                                        <Badge variant={riskLevel === "CRITICAL" ? "destructive" : "secondary"} className="uppercase tracking-wider">
                                            {ai_analysis_format?.dashboard_header?.risk_level}
                                        </Badge>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                        {ai_analysis_format?.dashboard_header?.ai_executive_summary}
                                    </p>
                                </div>

                                {/* Detailed Findings Tabs */}
                                <Tabs defaultValue="metadata" className="w-full">
                                    <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3 w-full">
                                        {['metadata', 'heatmap', 'content', 'findings'].map((tab) => (
                                            <TabsTrigger
                                                key={tab}
                                                value={tab}
                                                className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400"
                                            >
                                                {tab === 'metadata' ? 'Metadata' : tab === 'heatmap' ? 'Visuals' : tab === 'content' ? 'Semantics' : 'Consistency'}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    
                                    <div className="w-full flex justify-end my-3">
                                        <button className={`py-2 px-4 border rounded-lg  max-w-2xl ${                                        selectedDocument?.flagged === false ? 'border-red-500 text-red-500 cursor-pointer' : 'border-gray-500 text-gray-500' }`} onClick={() => setRequestReview(true)}
                                        disabled={selectedDocument?.flagged!}    
                                        >
                                            <p>Request for a review</p>
                                        </button>
                                    </div>
                                    

                                    <div >
                                        <TabsContent value="metadata" className="main-card-container">
                                            <Metadata layer={ai_analysis_format?.layer_results[0]!} />
                                            {!openFeedback.metadata ? (
                                                <div className="flex justify-end mt-4">
                                                    <button
                                                        className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer"
                                                        onClick={() => setOpenFeedback(prev => ({ ...prev, metadata: true }))}
                                                    >
                                                        Give Feedback
                                                    </button>
                                                </div>
                                            ) : (
                                                <DocumentFeedback layerType="layer1" setOpenFeedback={setOpenFeedback} section="Metadata & Source" analysis_id={raw_analysis_id!} document_class={doc_type}/>
                                            )}
                                        </TabsContent>

                                        {/* Heatmap Tab Content (Repeat structure for other tabs if needed) */}
                                        <TabsContent value="heatmap">
                                            <VisualManipulation layer={ai_analysis_format?.layer_results[1]!} />
                                            {
                                                !openFeedback.heatmap &&
                                                <div className="flex justify-end mt-4">
                                                    <button className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer" onClick={() => setOpenFeedback(prev => ({
                                                        ...prev,
                                                        heatmap: !prev.heatmap
                                                    }))}>Give Feedback
                                                    </button>
                                                </div>
                                            }
                                            {openFeedback.heatmap && (
                                                <DocumentFeedback layerType="layer2" setOpenFeedback={setOpenFeedback} section="Visual Manipulation" analysis_id={raw_analysis_id!} document_class={doc_type}/>
                                            )}
                                        </TabsContent>

                                        {/* Content Tab Content */}
                                        <TabsContent value="content">
                                            <ContentAnalysis layer={ai_analysis_format?.layer_results[2]!} />
                                            {
                                                !openFeedback.contentAnalysis &&
                                                <div className="flex justify-end">
                                                    <button className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer" onClick={() => setOpenFeedback(prev => ({
                                                        ...prev,
                                                        contentAnalysis: !prev.contentAnalysis
                                                    }))}>Give Feedback
                                                    </button>
                                                </div>
                                            }
                                            {openFeedback.contentAnalysis && (
                                                <DocumentFeedback layerType="layer3" setOpenFeedback={setOpenFeedback} section="Content Semantics" analysis_id={raw_analysis_id!} document_class={doc_type}/>
                                            )}
                                        </TabsContent>

                                        {/* Findings Tab Content */}
                                        <TabsContent value="findings">
                                            <LogicalConsistency layer={ai_analysis_format?.layer_results[3]!} />
                                            {
                                                !openFeedback.findings &&
                                                <div className="flex justify-end">
                                                    <button className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer" onClick={() => setOpenFeedback(prev => ({
                                                        ...prev,
                                                        findings: !prev.findings
                                                    }))}>Give Feedback
                                                    </button>
                                                </div>
                                            }
                                            {openFeedback.findings && (
                                               <DocumentFeedback layerType="layer4 " setOpenFeedback={setOpenFeedback} section="Logical Consistency" analysis_id={raw_analysis_id!} document_class={doc_type}/>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </div>
                            {/* Modal Content */}
                            {
                                requestReview && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                        {/* Backdrop */}
                                        <div
                                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                            onClick={() => setRequestReview(false)}
                                        />

                                        {/* Modal Content */}
                                        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                                            {/* Header Section */}
                                            <div className="flex items-start gap-4 mb-6">
                                                <div className="space-y-1">
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Request Forensic Review</h3>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                                        This document will be prioritized for manual verification by our forensic team.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Form Section */}
                                            <div className="flex flex-col gap-3">
                                                <label
                                                    htmlFor="review-reason"
                                                    className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1"
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

                                            {/* Actions */}
                                            <div className="flex gap-3 mt-8">
                                                <Button
                                                    variant="ghost"
                                                    className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-gray-500"
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
                                )
                            }
                        </div>
                    </div>
            }
        </>

    );
}