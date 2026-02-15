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
import DocumentFeedback from "./DocumentFeedback";

interface AnalysisResultProps {
  setRequestReview: React.Dispatch<React.SetStateAction<boolean>> 
  ai_analysis_format: DocumentAnalysisResult,
  raw_analysis_id: string 
  doc_type: string
}
export function AnalysisResults({setRequestReview,ai_analysis_format,doc_type,raw_analysis_id}: AnalysisResultProps) {
  //** User side - Document Analysis Result page */
  const riskLevel = ai_analysis_format?.dashboard_header?.risk_level; // low, medium, high

  const [openFeedback, setOpenFeedback] = useState({
    metadata: false,
    heatmap: false,
    contentAnalysis: false,
    findings: false
  })
  
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
            <DocumentFeedback layerType="layer1" setOpenFeedback={setOpenFeedback} section="Metadata & Source" analysis_id={raw_analysis_id} document_class={doc_type}/>
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
            <DocumentFeedback layerType="layer2" setOpenFeedback={setOpenFeedback} section="Visual Manipulation" analysis_id={raw_analysis_id} document_class={doc_type}/>
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
            <DocumentFeedback layerType="layer3" setOpenFeedback={setOpenFeedback} section="Content Semantics" analysis_id={raw_analysis_id} document_class={doc_type}/>
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
            <DocumentFeedback layerType="layer4 " setOpenFeedback={setOpenFeedback} section="Logical Consistency" analysis_id={raw_analysis_id} document_class={doc_type}/>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}