import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { motion } from "motion/react";
import { useState } from "react";
import { VisualManipulation } from "./HeatmapVisualization";
// import { ai_analysis_format } from "@/app/data/db-ai-analysis";
import Metadata from "../expert/expertDocumentAnalysis/analysisTab/Metadata";
import ContentAnalysis from "../expert/expertDocumentAnalysis/analysisTab/ContentAnalysis";
import LogicalConsistency from "../expert/expertDocumentAnalysis/analysisTab/KeyFindings";
import { DocumentAnalysisResult, RiskLevelColor } from "@/app/types/db-ai-analysis-type";
import DocumentFeedback from "./DocumentFeedback";
import { statusStyles } from "@/lib/utils";

interface AnalysisResultProps {
  setRequestReview: React.Dispatch<React.SetStateAction<boolean>>
  ai_analysis_format: DocumentAnalysisResult,
  raw_analysis_id: string
  doc_type: string
}
export function AnalysisResults({ setRequestReview, ai_analysis_format, doc_type, raw_analysis_id }: AnalysisResultProps) {
  //** User side - Document Analysis Result page */
  const riskLevel = ai_analysis_format?.dashboard_header?.risk_level; // low, medium, high
  const riskLevelColor: RiskLevelColor = ai_analysis_format?.dashboard_header?.risk_level_color || 'gray'

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
      className="space-y-4 md:space-y-6"
    >
      {/* Risk Overview Card */}
      <div className={`rounded-xl border-2 p-4 md:p-6 shadow-lg ${statusStyles[riskLevelColor]}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Icon + Title */}
          <div className="flex items-start gap-3">
            {riskLevel === "CRITICAL" ? (
              <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            ) : riskLevel === "SUSPICIOUS" ? (
              <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            ) : riskLevel === "CAUTION" ? (
              <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-7 h-7 md:w-8 md:h-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            )}
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white leading-snug">
              {ai_analysis_format?.dashboard_header?.verdict_title}
            </h2>
          </div>

          {/* Risk Badge — sits below title on very small screens */}
          <Badge
            variant="outline"
            className={`self-start sm:self-auto text-xs sm:text-sm font-semibold border-2 whitespace-nowrap ${riskLevel === "CRITICAL"
                ? "border-red-600 text-red-600 bg-red-50"
                : riskLevel === "SUSPICIOUS"
                  ? "border-orange-500 text-orange-600 bg-orange-50"
                  : riskLevel === "CAUTION"
                    ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                    : "border-green-600 text-green-600 bg-green-50"
              }`}
          >
            Risk Level: {ai_analysis_format?.dashboard_header?.risk_level}
          </Badge>
        </div>

        <p className="text-sm md:text-base text-gray-800 dark:text-slate-200">
          {ai_analysis_format?.dashboard_header?.ai_executive_summary}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="metadata" className="space-y-4">

        {/* Tab header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Scrollable tab list — scrolls horizontally on mobile */}
          <div className="overflow-x-auto pb-1 -mb-1">
            <TabsList className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 h-11 px-2 flex w-max min-w-full sm:min-w-0">
              {[
                { value: "metadata", label: "Metadata & Source" },
                { value: "heatmap", label: "Visual Manipulation" },
                { value: "content", label: "Content Semantics" },
                { value: "findings", label: "Logical Consistency" },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="px-3 sm:px-4 py-2 rounded-sm text-xs sm:text-sm whitespace-nowrap
                data-[state=active]:text-blue-600 data-[state=active]:font-bold
                dark:text-slate-400 dark:data-[state=active]:text-blue-400"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Request Review button */}
          <button
            className="self-start sm:self-auto flex-shrink-0 py-1.5 px-4 border rounded-lg border-red-500 text-red-500 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            onClick={() => setRequestReview(true)}
          >
            Request for a review
          </button>
        </div>

        {/* Helper to render a tab content + feedback */}
        {/* Metadata Tab */}
        <TabsContent value="metadata" className="main-card-container">
          {/* Layer 1 */}
          <Metadata layer={ai_analysis_format?.layer_results[0]} />
          {!openFeedback.metadata && (
            <div className="flex justify-end mt-4">
              <button
                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                onClick={() => setOpenFeedback(prev => ({ ...prev, metadata: true }))}
              >
                Give Feedback
              </button>
            </div>
          )}
          {openFeedback.metadata && (
            <DocumentFeedback
              layerType="layer1"
              setOpenFeedback={setOpenFeedback}
              section="Metadata & Source"
              analysis_id={raw_analysis_id}
              document_class={doc_type}
            />
          )}
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap" className="main-card-container">
          {/* Layer 2 */}
          <VisualManipulation layer={ai_analysis_format?.layer_results[1]} />
          {!openFeedback.heatmap && (
            <div className="flex justify-end mt-4">
              <button
                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                onClick={() => setOpenFeedback(prev => ({ ...prev, heatmap: true }))}
              >
                Give Feedback
              </button>
            </div>
          )}
          {openFeedback.heatmap && (
            <DocumentFeedback
              layerType="layer2"
              setOpenFeedback={setOpenFeedback}
              section="Visual Manipulation"
              analysis_id={raw_analysis_id}
              document_class={doc_type}
            />
          )}
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="main-card-container">
          <ContentAnalysis layer={ai_analysis_format?.layer_results[2]} />
          {!openFeedback.contentAnalysis && (
            <div className="flex justify-end mt-4">
              <button
                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                onClick={() => setOpenFeedback(prev => ({ ...prev, contentAnalysis: true }))}
              >
                Give Feedback
              </button>
            </div>
          )}
          {openFeedback.contentAnalysis && (
            <DocumentFeedback
              layerType="layer3"
              setOpenFeedback={setOpenFeedback}
              section="Content Semantics"
              analysis_id={raw_analysis_id}
              document_class={doc_type}
            />
          )}
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings" className="main-card-container">
          <LogicalConsistency
            layer={ai_analysis_format?.layer_results[3]}
            nextStepRecommendation={ai_analysis_format?.dashboard_header?.next_step_recommendation}
          />
          {!openFeedback.findings && (
            <div className="flex justify-end mt-4">
              <button
                className="text-red-600 border rounded-lg border-red-600 p-2 px-4 cursor-pointer text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                onClick={() => setOpenFeedback(prev => ({ ...prev, findings: true }))}
              >
                Give Feedback
              </button>
            </div>
          )}
          {openFeedback.findings && (
            <DocumentFeedback
              layerType="layer4"
              setOpenFeedback={setOpenFeedback}
              section="Logical Consistency"
              analysis_id={raw_analysis_id}
              document_class={doc_type}
            />
          )}
        </TabsContent>

      </Tabs>
    </motion.div>
  );
}