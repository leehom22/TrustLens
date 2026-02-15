import axios from 'axios';
import { AlertCircle, CheckCircle, Loader2, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'react-toastify';

interface ExpertReviewProps {
    userId: string, 
    documentId: string, 
    doc_type: string, 
    structure_analysis_id: string, 
    analysis_id: string, 
    target_layer: string
}

const ExpertReview = ({userId, documentId, doc_type, structure_analysis_id , analysis_id, target_layer } : ExpertReviewProps) => {
    const [reviewDecision, setReviewDecision] = useState<String | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [agreeAnalysis, setAgreeAnalysis] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedTabs, setSelectedTabs] = useState<string>("layer1")
    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const handleReviewSubmit = async () => {
        if (!reviewDecision || agreeAnalysis === null || !reviewNotes) {
            toast.warning("Review Decision or review notes or review acknowledgement is missing")
            return;
        }
        try {
            switch(target_layer){
                case 'metadata':
                    setSelectedTabs('layer1')
                    break
                case 'heatmap':
                    setSelectedTabs('layer2')
                    break
                case 'content':
                    setSelectedTabs('layer3')
                    break
                case 'findings':
                    setSelectedTabs('layer4')
                    break
                default:
                    setSelectedTabs('layer1')
                    break
            }
            
            setIsLoading(true)
            console.log("Layer: ",selectedTabs, analysis_id, structure_analysis_id, doc_type, documentId, userId, )
            const res = await axios.post(`${backendUrl}/feedback/submit_document_review`,  {
                target_layer: selectedTabs,
                analysis_id: analysis_id, // raw analysis id 
                structure_analysis_id : structure_analysis_id,
                doc_type: doc_type,
                docId: documentId,
                user_id: userId, 
                review_decision: reviewDecision,
                review_notes: reviewNotes,
                review_agrees: agreeAnalysis
            })
            const result = res.data

            if(result.success){
                console.log("SelectedTabs: ",selectedTabs)
                toast.success("Review submitted")
                setReviewDecision(null);
                setReviewNotes('');
                setAgreeAnalysis(null)
            } 
        } catch (error) {
            console.log(`Error occur while submiting review: ${error}`)
            toast.error("Error occur while submmiting review. Please try again")
        } finally {
            setIsLoading(false)
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 transition-colors shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Expert Review Decision</h3>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Your Decision</label>
                <div className="grid grid-cols-3 gap-3">
                    {/* Authentic Button */}
                    <button
                        onClick={() => setReviewDecision('authentic')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'authentic'
                            ? 'border-green-600 bg-green-50 dark:bg-emerald-900/20 dark:border-emerald-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-green-300 dark:hover:border-emerald-700'
                            }`}
                    >
                        <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'authentic' ? 'text-green-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'authentic' ? 'text-green-900 dark:text-emerald-100' : 'text-gray-900 dark:text-slate-400'}`}>Authentic</p>
                    </button>

                    {/* Suspicious Button */}
                    <button
                        onClick={() => setReviewDecision('suspicious')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'suspicious'
                            ? 'border-yellow-600 bg-yellow-50 dark:bg-amber-900/20 dark:border-amber-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-yellow-300 dark:hover:border-amber-700'
                            }`}
                    >
                        <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'suspicious' ? 'text-yellow-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'suspicious' ? 'text-yellow-900 dark:text-amber-100' : 'text-gray-900 dark:text-slate-400'}`}>Suspicious</p>
                    </button>

                    {/* Forgery Button */}
                    <button
                        onClick={() => setReviewDecision('forgery')}
                        className={`p-4 rounded-lg border-2 transition-all ${reviewDecision === 'forgery'
                            ? 'border-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-500'
                            : 'border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700'
                            }`}
                    >
                        <XCircle className={`w-8 h-8 mx-auto mb-2 ${reviewDecision === 'forgery' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-600'
                            }`} />
                        <p className={`text-sm font-medium ${reviewDecision === 'forgery' ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-slate-400'}`}>Forgery</p>
                    </button>
                </div>
            </div>

            {/* Notes Section */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Review Notes</label>
                <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Provide detailed reasoning for your decision..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-600 resize-none outline-none transition-colors"
                />
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* AGREE BUTTON */}
                    <button
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-lg
                             ${agreeAnalysis === true
                                ? 'bg-blue-600 text-white shadow-md' // Active State
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' // Inactive State
                            }`}
                        onClick={() => setAgreeAnalysis(true)}
                    >
                        <ThumbsUp className={`w-4 h-4 ${agreeAnalysis === true ? 'fill-current' : ''}`} />
                        Agree
                    </button>

                    {/* DISAGREE BUTTON */}
                    <button
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-lg
                            ${agreeAnalysis === false
                                ? 'bg-red-600 text-white shadow-md' // Active State
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' // Inactive State
                            }`}
                        onClick={() => setAgreeAnalysis(false)}
                    >
                        <ThumbsDown className={`w-4 h-4 ${agreeAnalysis === false ? 'fill-current' : ''}`} />
                        Disagree
                    </button>
                </div>
                <button
                    onClick={handleReviewSubmit}
                    className={`px-6 py-2  font-medium rounded-lg  shadow-lg shadow-blue-500/20 flex gap-3 justify-center items-center ${isLoading === true ? 'bg-gray-400 dark:bg-gray-500 text-white' : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors'}`}
                    disabled={isLoading}
                >
                        <p>Submit Review </p>
                        <div>        
                            {
                                isLoading && <Loader2 className='animate-spin mx-auto'/>
                            }
                        </div>                    
                </button>
            </div>
        </div>
    )
}

export default ExpertReview