import { AlertTriangle, CheckCircle, Info, FileText, Globe, Wand2, Shield, Loader2, CircleAlert } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { motion } from "motion/react";
import { useState } from "react";
import axios from 'axios'
import { toast } from "react-toastify";
import { getAuth} from 'firebase/auth'
import { VisualManipulation } from "./HeatmapVisualization";
// import { ai_analysis_format } from "@/app/data/db-ai-analysis";
import Metadata from "../expert/expertDocumentAnalysis/analysisTab/Metadata";
import ContentAnalysis from "../expert/expertDocumentAnalysis/analysisTab/ContentAnalysis";
import LogicalConsistency from "../expert/expertDocumentAnalysis/analysisTab/KeyFindings";
import { DocumentAnalysisResult } from "@/app/types/db-ai-analysis-type";

interface AnalysisResultProps {
  setRequestReview: React.Dispatch<React.SetStateAction<boolean>> 
  ai_analysis_format: DocumentAnalysisResult 
}
export function AnalysisResults({setRequestReview,ai_analysis_format}: AnalysisResultProps) {
  //** User side - Document Analysis Result page */
  const riskLevel = ai_analysis_format?.dashboard_header?.risk_level; // low, medium, high
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [openFeedback, setOpenFeedback] = useState({
    metadata: false,
    heatmap: false,
    contentAnalysis: false,
    findings: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [userToken, setUserToken] = useState('')
  const auth = getAuth();
  const user = auth.currentUser;
  
  const submitFeedback = async (type: string, event: React.FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault()
      setIsLoading(true)
      const formData = new FormData(event.currentTarget);
      const feedbackText = formData.get("feedback")
      
      console.log("Submitting feedback: ", type, feedbackText)
      
      // get user id token from firebase auth
      const token = user ? await user.getIdToken() : null ;
      token && setUserToken(token)

      const result = await axios.post(`${backendUrl}/feedback/submit_feedback`,{
        "analysis_id": "test_123",
        "analysis_type": type,
        "feedback_text": feedbackText,
        "document_class": "test_document",
        "weight": 0.8,
        "label": "incorrect",
        "ai_lessons": "Dates must be validated against jurisdiction"
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Risk Overview Card */}
      <div className={`rounded-xl border-2 p-6 shadow-lg ${riskLevel === "CRITICAL"
        ? "bg-red-50 dark:bg-red-600/10 border-red-500 dark:border-red-600/50"
        : riskLevel === "SUSPICIOUS"
          ? "bg-yellow-50 dark:bg-yellow-600/10 border-yellow-500 dark:border-yellow-600/50"
          : "bg-green-50 dark:bg-green-600/10 border-green-500 dark:border-green-600/50"
        }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {riskLevel === "CRITICAL" ? (
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            ) : riskLevel === "SUSPICIOUS" ? (
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskLevel === "CRITICAL" ? "High Risk Detected" : riskLevel === "SUSPICIOUS" ? "Medium Risk - Review Required" : "Low Risk"}
              </h2>
              <p className="text-gray-700 dark:text-slate-300">{ai_analysis_format?.dashboard_header?.verdict_title}</p>
            </div>
          </div>
          <Badge variant={riskLevel === "CRITICAL" ? "destructive" : "default"} className="text-sm">
            Risk Level: {ai_analysis_format?.dashboard_header?.risk_level}
          </Badge>
        </div>
        <p className="text-gray-800 dark:text-slate-200">
          {ai_analysis_format?.dashboard_header?.ai_executive_summary}
        </p>
      </div>

      {/* Tabs for Different Analysis Views */}
      <Tabs defaultValue="metadata" className="space-y-4">
        <div className="w-full flex justify-between">
          <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3">
              <TabsTrigger value="metadata" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Metadata & Source</TabsTrigger>
              <TabsTrigger value="heatmap" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Visual Manipulation</TabsTrigger>
              <TabsTrigger value="content" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Content Semantics</TabsTrigger>
              <TabsTrigger value="findings" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Logical Consistency</TabsTrigger>
          </TabsList>
          <button className="py-1 px-4 border rounded-lg border-red-500 text-red-500 cursor-pointer" onClick={()=> setRequestReview(true)}>
            <p>Request for a review</p> 
          </button>
        </div>
        {/* Metadata Tab */}

        <TabsContent value="metadata" className="main-card-container">
          <Metadata layer={ai_analysis_format?.layer_results[0]} />
          {
            !openFeedback.metadata &&
            <div className="flex justify-end">
              <button className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer" onClick={() => setOpenFeedback(prev => ({
                ...prev,
                metadata: !prev.metadata
              }))}>Give Feedback
              </button>
            </div>
          }
          {openFeedback.metadata && (
            <div className="relative"> {/* Added relative wrapper */}
              <form
                className={`flex flex-col gap-5 mb-6 border rounded-2xl p-5 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 transition-opacity ${isLoading ? 'opacity-80 pointer-events-none' : ''}`}
                onSubmit={(e) => submitFeedback("layer1", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Metadata & Source</b> analysis?</p>

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
                      onClick={() => setOpenFeedback(prev => ({ ...prev, metadata: false }))}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap" className="main-card-container">
          <VisualManipulation layer={ai_analysis_format?.layer_results[1]} />
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
            <div className="relative"> {/* Added relative wrapper */}
              <form
                className={`flex flex-col gap-5 mb-6 border rounded-2xl p-5 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 transition-opacity ${isLoading ? 'opacity-80 pointer-events-none' : ''}`}
                onSubmit={(e) => submitFeedback("layer2", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Visual Manipulation</b> analysis?</p>

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
                      onClick={() => setOpenFeedback(prev => ({ ...prev, heatmap: false }))}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </TabsContent>

        {/* Content Analysis Tab */}
        <TabsContent value="content" className="main-card-container">
          <ContentAnalysis layer={ai_analysis_format?.layer_results[2]} />
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
            <div className="relative"> {/* Added relative wrapper */}
              <form
                className={`flex flex-col gap-5 mb-6 border rounded-2xl p-5 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 transition-opacity ${isLoading ? 'opacity-80 pointer-events-none' : ''}`}
                onSubmit={(e) => submitFeedback("layer3", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Content Semantics</b> analysis?</p>

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
                      onClick={() => setOpenFeedback(prev => ({ ...prev, contentAnalysis: false }))}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings" className="main-card-container">
          <LogicalConsistency layer={ai_analysis_format?.layer_results[3]} />
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
            <div className="relative"> {/* Added relative wrapper */}
              <form
                className={`flex flex-col gap-5 mb-6 border rounded-2xl p-5 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 transition-opacity ${isLoading ? 'opacity-80 pointer-events-none' : ''}`}
                onSubmit={(e) => submitFeedback("layer4", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Logical Consistency</b> analysis?</p>

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
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}