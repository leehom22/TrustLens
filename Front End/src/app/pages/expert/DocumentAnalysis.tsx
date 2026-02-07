import React, { useState } from 'react'
import { DocumentAnalysisResult } from '../../types/type'
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { contentAnalysis, findings, metadata } from '../../data/dummy';
import { HeatmapVisualization } from '../../components/analysis/HeatmapVisualization';
import { AlertCircle, CheckCircle, XCircle, Eye, FileText, Download, Flag, ThumbsUp, ThumbsDown, AlertTriangle, Globe, Wand2, Shield, Info } from 'lucide-react';
import Header from '../../components/expert/expertDocumentAnalysis/Header';
import AnalysisSummary from '../../components/expert/expertDocumentAnalysis/AnalysisSummary';
import NoSelected from '../../components/expert/expertDocumentAnalysis/NoSelected';
import Metadata from '../../components/expert/expertDocumentAnalysis/analysisTab/Metadata';
import ContentAnalysis from '../../components/expert/expertDocumentAnalysis/analysisTab/ContentAnalysis';
import KeyFindings from '../../components/expert/expertDocumentAnalysis/analysisTab/KeyFindings';
import ExpertReview from '../../components/expert/expertDocumentAnalysis/ExpertReview';
import { documents } from '../../data/documentReview';
import samplePdf from '../../images/dummy.pdf'
import DocumentPreview from '../../components/expert/expertDocumentAnalysis/DocumentPreview';
import DocumentVercel from '../../components/expert/expertDocumentAnalysis/DocumentVercel';

const DocumentAnalysis = () => {
    // {selectedDocument}:{selectedDocument: DocumentAnalysisResult | null}
    const selectedDocument = documents[1]
    
    return (
        <div className="flex-1 overflow-y-auto w-385">
            {
                selectedDocument ? (
                    <div className='grid grid-cols-2'>
                        {/* Document Preview */}
                        {/* <DocumentVercel/> */}
                        <DocumentPreview/>
                        <div className="p-6 max-w-5xl mx-auto ">

                            {/* Document Header */}
                            <Header selectedDocument={selectedDocument} />

                            {/* AI Analysis Summary */}
                            <AnalysisSummary selectedDocument={selectedDocument} />

                            {/* Findings */}
                            <Tabs defaultValue="metadata" className="space-y-4">
                                <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3">
                                    <TabsTrigger value="metadata" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Metadata</TabsTrigger>
                                    <TabsTrigger value="heatmap" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Heatmap</TabsTrigger>
                                    <TabsTrigger value="content" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Content Analysis</TabsTrigger>
                                    <TabsTrigger value="findings" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Key Findings</TabsTrigger>
                                </TabsList>

                                {/* Metadata Tab */}

                                <TabsContent value="metadata" className="main-card-container">
                                    <Metadata metadata={metadata} />
                                </TabsContent>

                                {/* Heatmap Tab */}
                                <TabsContent value="heatmap">
                                    <HeatmapVisualization />
                                </TabsContent>

                                {/* Content Analysis Tab */}
                                <TabsContent value="content" className="main-card-container">
                                    <ContentAnalysis contentAnalysis={contentAnalysis} />
                                </TabsContent>

                                {/* Findings Tab */}
                                <TabsContent value="findings" className="main-card-container">
                                    <KeyFindings findings={findings} />
                                </TabsContent>
                            </Tabs>

                            {/* Expert Review Section */}
                            {selectedDocument.status === 'Pending' && (
                                <ExpertReview />
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