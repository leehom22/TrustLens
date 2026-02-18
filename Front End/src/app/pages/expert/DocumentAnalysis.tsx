import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { CheckCircle } from 'lucide-react';
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

type AnalysisStage = "idle" | "analyzing" | "complete";

const DocumentAnalysis = (props: { userId: string }) => {
    // ** Expert side - Document Analysis with document viewer 
    const params = useParams()
    const docId = params.docId
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [loading, setLoading] = useState(true)
    const [selectedDocument, setSelectedDocument] = useState<FileHeader | null>(null)
    const [stage, setStage] = useState<AnalysisStage>("complete");
    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{ role: "assistant", content: `I've received your document . Starting comprehensive forensic analysis...` }]);
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
                setStructure_ai_analysis_id(result.data?.id)
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

    const fetchingExpertDocumentReview = async (docId: string) => {
        // document_review
        try {

            const res = await axios.get(`${backendUrl}/feedback/get_document_review?docId=${docId}`);
            const result = res.data

            if (result.success) {
                console.log("Expert review data: ", result)
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
                    setSelectedDocument(result.data)
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
        console.log("the Document Id is :", docId)
        // fetch document from backend
        fetchingFile()
    }, [docId])

    return (
        <div className="flex-1 overflow-y-auto w-385">
            {
                selectedDocument ? (
                    <div className='grid grid-cols-2'>
                        {/* Document Preview */}
                        <Tabs className="gap-4" defaultValue='document'>
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                <TabsTrigger value='document' className="rounded-lg px-4 py-2 text-sm font-medium transition-all
               data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
               dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
               text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Document</TabsTrigger>
                                <TabsTrigger value='ai-assistant' className="rounded-lg px-4 py-2 text-sm font-medium transition-all
               data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm
               dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-blue-400
               text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Ai Assistant</TabsTrigger>
                            </TabsList>

                            <TabsContent value='document'>
                                {
                                    // PDF
                                    selectedDocument.mimeType === 'application/pdf' && 
                                    <DocumentVercel userId={props.userId} documentUrl={selectedDocument.fileUrl} documentId={selectedDocument.id} documentName={selectedDocument.fileName} setDownloadNotes={setDownloadNotes} />
                                }
                                {
                                    // IMAGES
                                    selectedDocument.mimeType.startsWith('image/') &&
                                    <DocumentImages userId={props.userId} documentUrl={selectedDocument.fileUrl} documentId={selectedDocument.id} documentName={selectedDocument.fileName} setDownloadAnnotations={setDownloadAnnotations} />
                                }
                            </TabsContent>
                            <TabsContent value='ai-assistant'>
                                <AiAssistant messages={chatMessages} stage={stage} />
                            </TabsContent>
                        </Tabs>

                        <div className="p-6 max-w-5xl mx-auto ">

                            {/* Document Header */}
                            <Header selectedDocument={selectedDocument} structure_ai_analysis_id={structure_ai_analysis_id} downloadAnnotations={downloadAnnotations} downloadNotes={downloadNotes} />

                            {/* AI Analysis Summary */}
                            <AnalysisSummary selectedDocument={ai_analysis_format} />

                            {/* Findings */}
                            <Tabs
                                value={selectedTabs}
                                onValueChange={setSelectedTabs}
                                defaultValue="metadata"
                                className="space-y-4">
                                <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3 " defaultValue="metadata">
                                    <TabsTrigger value="metadata" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Metadata & Source</TabsTrigger>
                                    <TabsTrigger value="heatmap" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Visual Manipulation</TabsTrigger>
                                    <TabsTrigger value="content" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Content Semantics</TabsTrigger>
                                    <TabsTrigger value="findings" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Logical Consistency</TabsTrigger>
                                </TabsList>

                                {/* Metadata Tab */}

                                <TabsContent value="metadata" className="main-card-container">
                                    <Metadata layer={ai_analysis_format!.layer_results[0]} />
                                </TabsContent>

                                {/* Heatmap Tab */}
                                <TabsContent value="heatmap">
                                    <VisualManipulation layer={ai_analysis_format!.layer_results[1]} />
                                </TabsContent>

                                {/* Content Analysis Tab */}
                                <TabsContent value="content" className="main-card-container">
                                    <ContentAnalysis layer={ai_analysis_format!.layer_results[2]} />
                                </TabsContent>

                                {/* Findings Tab */}
                                <TabsContent value="findings" className="main-card-container">
                                    <LogicalConsistency layer={ai_analysis_format!.layer_results[3]} />
                                </TabsContent>
                            </Tabs>

                            {
                                selectedDocument.expertReview === true ? (
                                    <div className="bg-green-50/50 dark:bg-emerald-900/10 border border-green-200 dark:border-emerald-800/50 rounded-xl p-6 transition-all shadow-sm">
                                        {/* Header Section */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-green-100 dark:bg-emerald-800/30 rounded-full">
                                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-green-900 dark:text-emerald-100 leading-none">
                                                    Review Completed
                                                </h3>
                                                <p className="text-sm text-green-700/80 dark:text-emerald-400/80 mt-1">
                                                    Expert analysis is now available for this document.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Notes Section */}
                                        {expertReviewNotes && expertReviewNotes.length > 0 ? (
                                            <div className="mt-4 space-y-3">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-green-800/60 dark:text-emerald-500/60 ml-1">
                                                    Expert Notes
                                                </h4>
                                                <div className="bg-white/50 dark:bg-emerald-950/20 rounded-lg border border-green-100 dark:border-emerald-800/30 divide-y divide-green-100 dark:divide-emerald-800/30">
                                                    {expertReviewNotes.map((note, index) => (
                                                        <div key={note.id || index} className="p-4">
                                                            <p className="text-green-800 dark:text-emerald-200 text-sm leading-relaxed">
                                                                {note.review_notes}
                                                            </p>
                                                            {/* Optional: Add a timestamp if available in your data */}
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
                                    //  Expert Review section 
                                    <ExpertReview
                                        documentId={selectedDocument.id}
                                        userId={selectedDocument.user_id}
                                        analysis_id={analysisHeader.analysis_id}
                                        doc_type={analysisHeader.doc_type}
                                        structure_analysis_id={analysisHeader.structure_analysis_id}
                                        target_layer={selectedTabs}
                                    />
                                )

                            }
                        </div>
                    </div>
                ) : (
                    <NoSelected />
                )
            }
        </div>
    )
}
// 
export default DocumentAnalysis