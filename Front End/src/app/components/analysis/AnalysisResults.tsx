import { AlertTriangle, CheckCircle, Info, FileText, Globe, Wand2, Shield, Loader2 } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { motion } from "motion/react";
import { useState } from "react";
import { contentAnalysis, findings, metadata } from "../../data/dummy";
import axios from 'axios'
import { toast } from "react-toastify";
import { getAuth} from 'firebase/auth'
import { VisualManipulation } from "./HeatmapVisualization";
import { ai_analysis_format } from "@/app/data/db-ai-analysis";

export function AnalysisResults() {
  // Mock data for demonstration
  const riskLevel = "medium"; // low, medium, high
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
      <div className={`rounded-xl border-2 p-6 shadow-lg ${riskLevel === "high"
        ? "bg-red-50 dark:bg-red-600/10 border-red-500 dark:border-red-600/50"
        : riskLevel === "medium"
          ? "bg-yellow-50 dark:bg-yellow-600/10 border-yellow-500 dark:border-yellow-600/50"
          : "bg-green-50 dark:bg-green-600/10 border-green-500 dark:border-green-600/50"
        }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {riskLevel === "high" ? (
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            ) : riskLevel === "medium" ? (
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskLevel === "high" ? "High Risk Detected" : riskLevel === "medium" ? "Medium Risk - Review Required" : "Low Risk"}
              </h2>
              <p className="text-gray-700 dark:text-slate-300">Forensic analysis completed successfully</p>
            </div>
          </div>
          <Badge variant={riskLevel === "high" ? "destructive" : "default"} className="text-sm">
            Risk Level: {riskLevel.toUpperCase()}
          </Badge>
        </div>
        <p className="text-gray-800 dark:text-slate-200">
          Our analysis has identified several concerning patterns in this document. We recommend careful review
          of the highlighted sections before proceeding. This document shows signs of multiple edits and contains
          suspicious clauses.
        </p>
      </div>

      {/* Tabs for Different Analysis Views */}
      <Tabs defaultValue="metadata" className="space-y-4">
        <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-12 py-4 px-3">
          <TabsTrigger value="metadata" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Metadata</TabsTrigger>
          <TabsTrigger value="heatmap" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Heatmap</TabsTrigger>
          <TabsTrigger value="content" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Content Analysis</TabsTrigger>
          <TabsTrigger value="findings" className="p-4 rounded-sm data-[state=active]:text-blue-600 data-[state=active]:font-bold dark:text-slate-400 dark:data-[state=active]:text-blue-400">Key Findings</TabsTrigger>
        </TabsList>

        {/* Metadata Tab */}

        <TabsContent value="metadata" className="main-card-container">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex justify-between gap-2 mb-4 ">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document Metadata</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">File Name</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.fileName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">File Size</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.fileSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Created Date</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.createdDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Last Modified</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.modifiedDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Author</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.author}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Last Modified By</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm flex items-center gap-2">
                  {metadata.lastModifiedBy}
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Total Edits</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.totalEdits} modifications</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Suspicious Activity</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">
                  {metadata.suspiciousActivity ? "⚠️ Yes" : "✓ No"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700  p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Network Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Origin IP Address</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.ipAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Location</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{metadata.location}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Editing Software Detected</h3>
            </div>
            <div className="space-y-2">
              {metadata.editingSoftware.map((software, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
                  <Shield className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-gray-900 dark:text-white font-mono text-sm">{software}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Multiple editing software usage detected - unusual for authentic documents
            </p>
          </div>
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
                onSubmit={(e) => submitFeedback("metadata", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Metadata</b> analysis?</p>

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
        <TabsContent value="heatmap">
          <VisualManipulation layer={ai_analysis_format[0].layer_results[1]} />
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
                onSubmit={(e) => submitFeedback("heatmap", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Heatmap</b> analysis?</p>

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
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Section-by-Section Analysis</h3>
            </div>
            <div className="space-y-3">
              {contentAnalysis.map((section, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border shadow-sm ${section.status === "danger"
                    ? "bg-red-50 dark:bg-red-600/10 border-red-300 dark:border-red-600/50"
                    : section.status === "warning"
                      ? "bg-yellow-50 dark:bg-yellow-600/10 border-yellow-300 dark:border-yellow-600/50"
                      : "bg-green-50 dark:bg-green-600/10 border-green-300 dark:border-green-600/50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {section.status === "danger" ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    ) : section.status === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{section.section}</h4>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{section.details}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-400 dark:border-red-600/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ⚠️ Critical Recommendation
            </h3>
            <p className="text-gray-800 dark:text-white mb-3">
              <strong>DO NOT SIGN</strong> this contract without legal review. We've identified multiple red flags
              that are commonly associated with fraudulent contracts:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-slate-100 text-sm">
              <li>One-sided liability terms that waive your rights</li>
              <li>Unusually high termination penalties</li>
              <li>Foreign jurisdiction for disputes</li>
              <li>Hidden text layers in the PDF</li>
            </ul>
          </div>
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
                onSubmit={(e) => submitFeedback("contentAnalysis", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Content Analysis</b> analysis?</p>

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
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700  p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Findings Summary</h3>
            <div className="space-y-3">
              {findings.map((finding, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border shadow-sm ${finding.severity === "high"
                    ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-600/50"
                    : finding.severity === "medium"
                      ? "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-600/50"
                      : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-600/50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {finding.type === "alert" ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    ) : finding.type === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{finding.title}</h4>
                        <Badge
                          variant={finding.severity === "high" ? "destructive" : "default"}
                          className={`${finding.severity === "medium"
                            ? "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                            : finding.severity === "low"
                              ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                              : ""
                            }`}
                        >
                          {finding.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-200">{finding.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700  p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recommended Actions</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-slate-300">
              <li>Have this document reviewed by a qualified legal professional</li>
              <li>Request the original, unedited version from the sender</li>
              <li>Verify the identity of the document author through alternative channels</li>
              <li>Do not proceed with any transaction until concerns are addressed</li>
              <li>Consider reporting suspicious activity to relevant authorities</li>
            </ol>
          </div>
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
                onSubmit={(e) => submitFeedback("findings", e)}
              >
                <p className="text-gray-900 dark:text-white">What do you think about the <b>Key Findings</b> analysis?</p>

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