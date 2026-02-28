import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { CheckCircle, Loader2 } from 'lucide-react';
import Header from '../../components/expert/expertDocumentAnalysis/Header';
import AnalysisSummary from '../../components/expert/expertDocumentAnalysis/AnalysisSummary';
import NoSelected from '../../components/expert/expertDocumentAnalysis/NoSelected';
import Metadata from '../../components/expert/expertDocumentAnalysis/analysisTab/Metadata';
import ContentAnalysis from '../../components/expert/expertDocumentAnalysis/analysisTab/ContentAnalysis';
import ExpertReview from '../../components/expert/expertDocumentAnalysis/ExpertReview';
import DocumentVercel from '../../components/expert/expertDocumentAnalysis/DocumentVercel';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { VisualManipulation } from '@/app/components/analysis/HeatmapVisualization';
import LogicalConsistency from '../../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings';
import { DocumentAnalysisResult, FileHeader } from '@/app/types/db-ai-analysis-type';
import DocumentImages from '@/app/components/expert/expertDocumentAnalysis/DocumentImages';
import AiAssistant from '@/app/components/analysis/AiAssistant';
import { Annotation, Note } from '@/app/types/document-highlight-type';
import { getAccessibleDocumentUrl } from '@/lib/encrypt';

type AnalysisStage = "idle" | "analyzing" | "complete";

const DocumentAnalysis = (props: { userId: string, }) => {
    // ** Expert side - Document Analysis with document viewer 
    const params = useParams()
    const docId = params.docId
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [loading, setLoading] = useState(true)
    const [selectedDocument, setSelectedDocument] = useState<FileHeader | null>(null)
    const [stage, setStage] = useState<AnalysisStage>("complete");
    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([{ role: "model", content: `I've received your document . Starting comprehensive forensic analysis...` }]);
    const [ai_analysis_format, setAiAnalysis] = useState<DocumentAnalysisResult | null>(null)
    const [analysisHeader, setAnalysisHeader] = useState({
        analysis_id: '',
        doc_type: '',
        structure_analysis_id: '',
    })
    const [downloadNotes, setDownloadNotes] = useState<Note[]>([]);
    const [downloadAnnotations, setDownloadAnnotations] = useState<Annotation[]>([]);
    const [expertReviewNotes, setExpertReviewNotes] = useState<string[]>([])
    const [selectedTabs, setSelectedTabs] = useState<string>('metadata')
    const [structure_ai_analysis_id, setStructure_ai_analysis_id] = useState<string>('')
    const [rawAnalysisId, setRawAnalysisId] = useState<string>('')
    const [imageSize, setImageSize] = useState({height:0,width:0})
    const [ userFlaggedReason, setUserFlaggedReason] = useState<string>('')


    const fetchingDocucmentAnalysis = async (docId: string) => {
        try {
            const formData = new FormData()
            formData.append('docId', docId)
            console.log("Fetching structure analysis data")
            const res = await axios.post(`${backendUrl}/analysis/get-doc-analysis`, formData)
            const result = res.data

            if (result.success === true) {
                setAiAnalysis(result.data?.analysis_content)
                // console.log("Data for analysis: ",result.data)
                setAnalysisHeader({
                    analysis_id: result.data?.raw_analysis_id,
                    doc_type: result.data?.doc_type,
                    structure_analysis_id: result.data?.id,
                })
                setRawAnalysisId(result.data?.raw_analysis_id)
                setStructure_ai_analysis_id(result.data?.id)

            } else {
                toast.error("Failed to fetch document analysis")
                return
            }
        } catch (error) {
            toast.error("Failed to fetch document analysis")
            console.log("Error fetching document analysis: ", error)
        }
    }

    const fetchingExpertDocumentReview = async (docId: string) => {
        // document_review
        try {

            const res = await axios.get(`${backendUrl}/feedback/get_document_review?docId=${docId}`);
            const result = res.data

            if (result.success) {
                // console.log("Expert review data: ", result)
                setExpertReviewNotes(result.review)
            }
        } catch (error) {
            toast.error("Failed to fetch document expert review")
            console.log("Error fetching document expert review: ", error)
        }
    }

    //** fetch selected file from db 
    const fetchingFile = async () => {
        try {
            if (docId) {
                const response = await axios.get(`${backendUrl}/files/get_selected_files/${docId}`)
                const result = response.data

                if (result.success === true) {
                    await fetchingDocucmentAnalysis(docId)
                    await fetchingExpertDocumentReview(docId)
                    setUserFlaggedReason(result.data.flaggedReason)

                    const documentData = result.data 

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
        }
            } else {
                toast.error("Document Id not found!")
                return
            }
        } catch (error) {
            toast.error("Failed to laod document")
            console.log("Error loading document: ", error)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        // console.log("the Document Id is :", docId)
        // fetch document from backend
        fetchingFile()
    }, [docId])

    return (
        <>
            {
                loading === true ? (
                    <div className="w-full flex flex-col gap-3 items-center justify-center inset-0 fixed z-50">
                        <Loader2 className="animate-spin" size={50} />
                        <p>Loading Document ...</p>
                    </div>
                ) :
                    (
                        <div className="flex-1 overflow-y-auto">
                            {selectedDocument ? (
                                <div className="grid grid-cols-1 lg:grid-cols-6 gap-0 lg:gap-4">

                                    {/* LEFT: Document Preview + AI Assistant — bottom on mobile, left on desktop */}
                                    <div className="order-2 lg:order-1 p-3 sm:p-4 lg:col-span-3">
                                        <Tabs className="gap-4" defaultValue="document">
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

                                            <TabsContent value="document">
                                                {selectedDocument.mimeType === 'application/pdf' && (
                                                    <DocumentVercel
                                                        userId={props.userId}
                                                        documentUrl={selectedDocument.fileUrl}
                                                        documentId={selectedDocument.id}
                                                        documentName={selectedDocument.fileName}
                                                        setDownloadNotes={setDownloadNotes}
                                                    />
                                                )}
                                                {selectedDocument.mimeType.startsWith('image/') && (
                                                    <DocumentImages
                                                        userId={props.userId}
                                                        documentUrl={selectedDocument.fileUrl}
                                                        documentId={selectedDocument.id}
                                                        documentName={selectedDocument.fileName}
                                                        setDownloadAnnotations={setDownloadAnnotations}
                                                        setParentImageSize={setImageSize}
                                                    />
                                                )}
                                            </TabsContent>

                                            <TabsContent value="ai-assistant">
                                                <AiAssistant reqId={rawAnalysisId} initialMessages={chatMessages} stage={stage} userType='expert'/>
                                            </TabsContent>
                                        </Tabs>
                                    </div>

                                    {/* RIGHT: Analysis — top on mobile, right on desktop */}
                                    <div className="order-1 lg:order-2 p-3 sm:p-4 lg:p-6 max-w-full overflow-y-auto lg:col-span-3">

                                        {/* Document Header */}
                                        <Header
                                            selectedDocument={selectedDocument}
                                            structure_ai_analysis_id={structure_ai_analysis_id}
                                            downloadAnnotations={downloadAnnotations}
                                            downloadNotes={downloadNotes}
                                            imageSize={imageSize}
                                        />

                                        {/* AI Analysis Summary */}
                                        <AnalysisSummary selectedDocument={ai_analysis_format} />

                                        {/* Findings Tabs */}
                                        <Tabs
                                            value={selectedTabs}
                                            onValueChange={setSelectedTabs}
                                            defaultValue="metadata"
                                            className="space-y-4"
                                        >
                                            {/* Horizontally scrollable tab list on mobile */}
                                            <div className="overflow-x-auto pb-1 -mb-1 flex-1">
                                                <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-11 px-2 flex w-max min-w-full ">
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

                                            <TabsContent value="metadata" className="main-card-container">
                                                <Metadata layer={ai_analysis_format!.layer_results[0]} />
                                            </TabsContent>

                                            <TabsContent value="heatmap">
                                                <VisualManipulation layer={ai_analysis_format!.layer_results[1]} />
                                            </TabsContent>

                                            <TabsContent value="content" className="main-card-container">
                                                <ContentAnalysis layer={ai_analysis_format!.layer_results[2]} />
                                            </TabsContent>

                                            <TabsContent value="findings" className="main-card-container">
                                                <LogicalConsistency
                                                    layer={ai_analysis_format!.layer_results[3]}
                                                    nextStepRecommendation={ai_analysis_format?.dashboard_header?.next_step_recommendation}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                        
                                     <div className= "bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 transition-colors shadow-sm mt-6">
                                            <h3 className=" font-bold text-gray-700 dark:text-slate-300 mb-2">
                                                🚩 Document Flagged Reason (User Reported)
                                            </h3>

                                            {userFlaggedReason ? (
                                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-md text-gray-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                                                {userFlaggedReason}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 dark:text-slate-400 italic">
                                                No reason provided.
                                                </div>
                                            )}
                                     </div>
                                                                                {/* Review Status */}
                                        <div className="mt-6">
                                            {selectedDocument.expertReview === true ? (
                                                <div className="bg-green-50/50 dark:bg-emerald-900/10 border border-green-200 dark:border-emerald-800/50 rounded-xl p-4 sm:p-6 transition-all shadow-sm">
                                                    {/* Header */}
                                                    <div className="flex items-start gap-3 mb-4">
                                                        <div className="p-2 bg-green-100 dark:bg-emerald-800/30 rounded-full flex-shrink-0">
                                                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base sm:text-lg font-bold text-green-900 dark:text-emerald-100 leading-none">
                                                                Review Completed
                                                            </h3>
                                                            <p className="text-sm text-green-700/80 dark:text-emerald-400/80 mt-1">
                                                                Expert analysis is now available for this document.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Notes */}
                                                    {expertReviewNotes && expertReviewNotes.length > 0 ? (
                                                        <div className="mt-4 space-y-3">
                                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-green-800/60 dark:text-emerald-500/60 ml-1">
                                                                Expert Notes
                                                            </h4>
                                                            <div className="bg-white/50 dark:bg-emerald-950/20 rounded-lg border border-green-100 dark:border-emerald-800/30 divide-y divide-green-100 dark:divide-emerald-800/30">
                                                                {expertReviewNotes.map((note, index) => (
                                                                    <div key={note.id || index} className="p-3 sm:p-4">
                                                                        <p className="text-green-800 dark:text-emerald-200 text-sm leading-relaxed">
                                                                            {note.review_notes}
                                                                        </p>
                                                                        {note.timestamp && (
                                                                            <span className="text-[10px] text-green-600/50 dark:text-emerald-500/50 mt-2 block">
                                                                                Reviewed on {new Date(note.timestamp).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm italic text-green-600/70 dark:text-emerald-500/70 mt-2">
                                                            No specific notes were provided by the reviewer.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <ExpertReview
                                                    documentId={selectedDocument.id}
                                                    userId={selectedDocument.user_id}
                                                    analysis_id={analysisHeader.analysis_id}
                                                    doc_type={analysisHeader.doc_type}
                                                    structure_analysis_id={analysisHeader.structure_analysis_id}
                                                    target_layer={selectedTabs}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <NoSelected />
                            )}
                        </div>
                    )
            }
        </>

    )
}
// 
export default DocumentAnalysis