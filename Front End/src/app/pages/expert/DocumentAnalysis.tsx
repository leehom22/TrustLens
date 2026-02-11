import React, { useEffect, useState } from 'react'
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
import { ai_analysis_format } from '@/app/data/db-ai-analysis';
import { VisualManipulation } from '@/app/components/analysis/HeatmapVisualization';
import LogicalConsistency from '../../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings';
import { FileHeader } from '@/app/types/db-ai-analysis-type';
import DocumentImages from '@/app/components/expert/expertDocumentAnalysis/DocumentImages';
import AiAssistant from '@/app/components/analysis/AiAssistant';
import UserFeedback from '@/app/components/expert/expertDocumentAnalysis/analysisTab/UserFeedback';

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
    // fetch selected file from db 
    const fetchingFile = async () => {
        try {
            if (docId) {
                const response = await axios.get(`${backendUrl}/files/get_selected_files/${docId}`)
                const result = response.data

                if (result.success === true) {
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
                                    <DocumentVercel userId={props.userId} documentUrl={selectedDocument.fileUrl} documentId={selectedDocument.id} documentName={selectedDocument.fileName}/>
                                }
                                {
                                    // IMAGES
                                    selectedDocument.mimeType.startsWith('image/') &&
                                    <DocumentImages userId={props.userId} documentUrl={selectedDocument.fileUrl} documentId={selectedDocument.id} documentName={selectedDocument.fileName}/>
                                }
                            </TabsContent>
                            <TabsContent value='ai-assistant'>
                                <AiAssistant messages={chatMessages} stage={stage} />
                            </TabsContent>
                        </Tabs>

                        <div className="p-6 max-w-5xl mx-auto ">

                            {/* Document Header */}
                            <Header selectedDocument={selectedDocument} />

                            {/* AI Analysis Summary */}
                            <AnalysisSummary selectedDocument={ai_analysis_format[0]} />

                            {/* Findings */}
                            <Tabs defaultValue="metadata" className="space-y-4">
                                <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3 ">
                                    <TabsTrigger value="metadata" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Metadata & Source</TabsTrigger>
                                    <TabsTrigger value="heatmap" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Visual Manipulation</TabsTrigger>
                                    <TabsTrigger value="content" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Content Semantics</TabsTrigger>
                                    <TabsTrigger value="findings" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Logical Consistency</TabsTrigger>
                                </TabsList>

                                {/* Metadata Tab */}

                                <TabsContent value="metadata" className="main-card-container">
                                    <Metadata layer={ai_analysis_format[0].layer_results[0]} />
                                </TabsContent>

                                {/* Heatmap Tab */}
                                <TabsContent value="heatmap">
                                    <VisualManipulation layer={ai_analysis_format[0].layer_results[1]} />
                                </TabsContent>

                                {/* Content Analysis Tab */}
                                <TabsContent value="content" className="main-card-container">
                                    <ContentAnalysis layer={ai_analysis_format[0].layer_results[2]} />
                                </TabsContent>

                                {/* Findings Tab */}
                                <TabsContent value="findings" className="main-card-container">
                                    <LogicalConsistency layer={ai_analysis_format[0].layer_results[3]} />
                                </TabsContent>
                            </Tabs>

                            <UserFeedback/>

                            {/* Expert Review Section */}
                            {ai_analysis_format[0].status === 'Pending' && (
                                <ExpertReview documentId={selectedDocument.id} userId={selectedDocument.user_id}/>
                            )}

                            {selectedDocument.status === 'Reviewed' && (
                                <div className="bg-green-50 dark:bg-emerald-900/20 border border-green-200 dark:border-emerald-800/50 rounded-lg p-6 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        {/* Using emerald for better dark mode aesthetics */}
                                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                                        <h3 className="text-lg font-bold text-green-900 dark:text-emerald-100">
                                            Review Completed
                                        </h3>
                                    </div>
                                    <p className="text-green-700 dark:text-emerald-300/90">
                                        This document has already been reviewed by an expert.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <NoSelected />
                )
            }
        </div>
    )
}

export default DocumentAnalysis