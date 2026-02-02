import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Eye, FileText, Download, Flag, ThumbsUp, ThumbsDown, Clock, User } from 'lucide-react';
import { documents } from '../../data/documentReview';
import { DocumentAnalysisResult } from '../../types/type';

const DocumentReview = () => {
    const [selectedDocument, setSelectedDocument] = useState<DocumentAnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [reviewDecision, setReviewDecision] = useState<String | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    const getRiskBadge = (level) => {
        const styles = {
            high: 'bg-red-100 text-red-800 border-red-200',
            medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            low: 'bg-green-100 text-green-800 border-green-200'
        };
        return styles[level] || styles.medium;
    };

    const getSeverityColor = (severity) => {
        const colors = {
            high: 'text-red-600',
            medium: 'text-yellow-600',
            low: 'text-blue-600'
        };
        return colors[severity] || colors.medium;
    };

    const handleReviewSubmit = () => {
        if (!reviewDecision) {
            alert('Please select a decision before submitting');
            return;
        }
        // In real app, submit review to backend
        alert(`Review submitted: ${reviewDecision}\nNotes: ${reviewNotes}`);
        setReviewDecision(null);
        setReviewNotes('');
        setSelectedDocument(null);
    };

    const filteredDocuments = documents.filter(doc =>
        activeTab === 'all' ? true : doc.status === activeTab
    );

    return (
        <div className="min-h-screen bg-gray-50 w-370">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Expert Review Dashboard</h1>
                            <p className="text-sm text-gray-600 mt-1">Document Fraud Analysis System</p>
                        </div>
                        {/* <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">Dr. Sarah Mitchell</p>
                                <p className="text-xs text-gray-600">Forensic Document Examiner</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                        </div> */}
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(100vh-89px)]">
                {/* Sidebar - Document List */}
                <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Pending ({documents.filter(d => d.status === 'pending').length})
                            </button>
                            <button
                                onClick={() => setActiveTab('reviewed')}
                                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reviewed'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Reviewed
                            </button>
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                All
                            </button>
                        </div>
                    </div>

                    {/* Document List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredDocuments.map((doc) => (
                            <div
                                key={doc.id}
                                onClick={() => setSelectedDocument(doc)}
                                className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${selectedDocument?.id === doc.id
                                        ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                        : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-gray-400" />
                                        <h3 className="font-medium text-gray-900 text-sm">{doc.name}</h3>
                                    </div>
                                    {doc.status === 'pending' && (
                                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                    )}
                                </div>
                                <div className="space-y-1 ml-7">
                                    <p className="text-xs text-gray-600">
                                        <span className="font-medium">Submitted by:</span> {doc.submittedBy}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        {doc.submissionDate}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getRiskBadge(doc.riskLevel)}`}>
                                            {doc.riskLevel.toUpperCase()} RISK
                                        </span>
                                        <span className="text-xs text-gray-600">AI: {doc.aiConfidence}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content - Document Review */}
                <div className="flex-1 overflow-y-auto">
                    {selectedDocument ? (
                        <div className="p-6 max-w-5xl mx-auto">
                            {/* Document Header */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedDocument.name}</h2>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <span>Submitted by: <span className="font-medium">{selectedDocument.submittedBy}</span></span>
                                            <span>•</span>
                                            <span>{selectedDocument.submissionDate}</span>
                                            <span>•</span>
                                            <span>Flagged by: <span className="font-medium">{selectedDocument.flaggedBy}</span></span>
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1.5 rounded-full border font-medium text-sm ${getRiskBadge(selectedDocument.riskLevel)}`}>
                                        {selectedDocument.riskLevel.toUpperCase()} RISK
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Flag className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-600">AI Verdict: <span className="font-medium">{selectedDocument.aiVerdict}</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Confidence: <span className="font-medium">{selectedDocument.aiConfidence}%</span></span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Analysis Summary */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-blue-600" />
                                    AI Analysis Summary
                                </h3>
                                <p className="text-gray-700 mb-4">{selectedDocument.aiAnalysis.summary}</p>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Technical Details</h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-600">File Size:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedDocument.aiAnalysis.technicalDetails.fileSize}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Pages:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedDocument.aiAnalysis.technicalDetails.pages}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Created:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedDocument.aiAnalysis.technicalDetails.created}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Modified:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedDocument.aiAnalysis.technicalDetails.modified}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-gray-600">Software:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedDocument.aiAnalysis.technicalDetails.software}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Findings */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Detailed Findings</h3>
                                <div className="space-y-4">
                                    {selectedDocument.aiAnalysis.findings.map((finding, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-semibold text-gray-900">{finding.type}</h4>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${finding.severity === 'high' ? 'bg-red-100 text-red-800' :
                                                        finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {finding.severity.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">{finding.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Document Preview */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-blue-600" />
                                    Document Preview
                                </h3>
                                <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center border-2 border-dashed border-gray-300">
                                    <div className="text-center">
                                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">Document preview would appear here</p>
                                        <p className="text-sm text-gray-500 mt-1">Interactive viewer with zoom and annotation tools</p>
                                    </div>
                                </div>
                            </div>

                            {/* Expert Review Section */}
                            {selectedDocument.status === 'pending' && (
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Expert Review Decision</h3>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Your Decision</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                onClick={() => setReviewDecision('authentic')}
                                                className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'authentic'
                                                        ? 'border-green-600 bg-green-50'
                                                        : 'border-gray-200 hover:border-green-300'
                                                    }`}
                                            >
                                                <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'authentic' ? 'text-green-600' : 'text-gray-400'
                                                    }`} />
                                                <p className="text-sm font-medium text-gray-900">Authentic</p>
                                            </button>
                                            <button
                                                onClick={() => setReviewDecision('suspicious')}
                                                className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'suspicious'
                                                        ? 'border-yellow-600 bg-yellow-50'
                                                        : 'border-gray-200 hover:border-yellow-300'
                                                    }`}
                                            >
                                                <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'suspicious' ? 'text-yellow-600' : 'text-gray-400'
                                                    }`} />
                                                <p className="text-sm font-medium text-gray-900">Suspicious</p>
                                            </button>
                                            <button
                                                onClick={() => setReviewDecision('forgery')}
                                                className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'forgery'
                                                        ? 'border-red-600 bg-red-50'
                                                        : 'border-gray-200 hover:border-red-300'
                                                    }`}
                                            >
                                                <XCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'forgery' ? 'text-red-600' : 'text-gray-400'
                                                    }`} />
                                                <p className="text-sm font-medium text-gray-900">Forgery</p>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Review Notes</label>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={(e) => setReviewNotes(e.target.value)}
                                            placeholder="Provide detailed reasoning for your decision..."
                                            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                                <ThumbsUp className="w-4 h-4" />
                                                Agree with AI
                                            </button>
                                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                                <ThumbsDown className="w-4 h-4" />
                                                Disagree with AI
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleReviewSubmit}
                                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Submit Review
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedDocument.status === 'reviewed' && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <h3 className="text-lg font-bold text-green-900">Review Completed</h3>
                                    </div>
                                    <p className="text-green-700">This document has already been reviewed by an expert.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Selected</h3>
                                <p className="text-gray-600">Select a document from the list to begin review</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocumentReview