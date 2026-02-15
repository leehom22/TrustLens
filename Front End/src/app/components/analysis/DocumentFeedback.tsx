import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner';

interface DocumentFeedbackProps {
    section: string
    layerType: string
    analysis_id: string 
    document_class?: string | null
    setOpenFeedback: React.Dispatch<React.SetStateAction<{
        metadata: boolean;
        heatmap: boolean;
        contentAnalysis: boolean;
        findings: boolean;
    }>>
}

const DocumentFeedback = ({ section, layerType, analysis_id, document_class, setOpenFeedback }: DocumentFeedbackProps) => {
    
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const auth = getAuth();
    const [userToken, setUserToken] = useState('')
    const user = auth.currentUser;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const submitFeedback = async (type: string, event: React.FormEvent<HTMLFormElement>) => {
        try {
            event.preventDefault()
            setIsLoading(true)
            const formData = new FormData(event.currentTarget);
            const feedbackText = formData.get("feedback")

            console.log("Submitting feedback: ", type, feedbackText)

            // get user id token from firebase auth
            const token = user ? await user.getIdToken() : null;
            token && setUserToken(token)

            //! get analysis_id, doc_type, 
            const result = await axios.post(`${backendUrl}/feedback/submit_feedback`, {
                "analysis_id": analysis_id || 'unknown', 
                "analysis_type": type ,
                "feedback_text": feedbackText,
                "doc_type": document_class || 'unkwown',
                // "weight": 0.8,
                // "label": "incorrect",
                // "ai_lessons": "Dates must be validated against jurisdiction"
            },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                })

            if (result.status === 200) {
                toast.success("Feedback submitted successfully!");
                setOpenFeedback(prev => ({
                    ...prev,
                    metadata: false,
                    heatmap: false,
                    contentAnalysis: false,
                    findings: false
                }))
            } else {
                toast.error("Error submitting feedback. Please try again later.");
            }
        } catch (error) {
            console.error("Error submitting feedback: ", error)
            toast.error("Error submitting feedback. Please try again later.");
        } finally {
            setIsLoading(false)
        }
    }
    
    return (
        <div className="relative"> {/* Added relative wrapper */}
            <form
                className={`flex flex-col gap-5 mb-6 border rounded-2xl p-5 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 transition-opacity ${isLoading ? 'opacity-80 pointer-events-none' : ''}`}
                onSubmit={(e) => submitFeedback(layerType, e)}
            >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>{section}</b> analysis?</p>

                <textarea
                    name="feedback"
                    id="feedback"
                    disabled={isLoading}
                    className="p-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                    placeholder="Your feedback..."
                ></textarea>

                <div className="flex gap-3 justify-end">
                    <button
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-2"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? 'Submitting...' : 'Submit'}
                    </button>

                    {!isLoading && (
                        <button
                            type="button"
                            className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                            onClick={() => setOpenFeedback(prev => ({ ...prev, findings: false }))}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}

export default DocumentFeedback