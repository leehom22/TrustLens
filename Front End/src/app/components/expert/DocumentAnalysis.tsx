import React, { useState } from 'react'
import { DocumentAnalysisResult } from '../../types/type'
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { contentAnalysis, findings, metadata } from '../../data/dummy';
import { HeatmapVisualization } from '../../components/analysis/HeatmapVisualization';
import { AlertCircle, CheckCircle, XCircle, Eye, FileText, Download, Flag, ThumbsUp, ThumbsDown, AlertTriangle, Globe, Wand2, Shield, Info } from 'lucide-react';
import Header from './expertDocumentAnalysis/Header';
import AnalysisSummary from './expertDocumentAnalysis/AnalysisSummary';
import NoSelected from './expertDocumentAnalysis/NoSelected';
import Metadata from './expertDocumentAnalysis/analysisTab/Metadata';
import ContentAnalysis from './expertDocumentAnalysis/analysisTab/ContentAnalysis';
import KeyFindings from './expertDocumentAnalysis/analysisTab/KeyFindings';
import ExpertReview from './expertDocumentAnalysis/ExpertReview';
import { documents } from '../../data/documentReview';

const DocumentAnalysis = () => {
    // {selectedDocument}:{selectedDocument: DocumentAnalysisResult | null}
    const selectedDocument = documents[1]
    return (
        <div className="flex-1 overflow-y-auto w-385">
            {
                selectedDocument ? (
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

                        {/* Document Preview */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 mb-6 transition-colors shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                Document Preview
                            </h3>

                            {/* Preview Placeholder Area */}
                            <div className="bg-gray-100 dark:bg-slate-950 rounded-lg h-96 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-800 transition-colors">
                                <div className="text-center">
                                    {/* Icon color adjusted for dark mode */}
                                    <FileText className="w-16 h-16 text-gray-400 dark:text-slate-600 mx-auto mb-2" />

                                    <p className="text-gray-600 dark:text-slate-400 font-medium">
                                        Document preview would appear here
                                    </p>

                                    <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                                        Interactive viewer with zoom and annotation tools
                                    </p>
                                </div>
                            </div>
                        </div>

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
                ) : (
                    <NoSelected />
                )
            }
        </div>
    )
}

export default DocumentAnalysis