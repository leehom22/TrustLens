import { LayerResult } from "@/app/types/db-ai-analysis-type";
import { statusStyles } from "@/lib/utils";
import { AlertCircle, FileImage, Shield, ZoomIn } from "lucide-react";
import { useState } from "react";
import DocumentViewer from "./DocumentViewer";

export function VisualManipulation({ layer }: { layer: LayerResult }) {
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [isZoomed, setIsZoomed] = useState<Record<string, boolean>>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FAIL":
      case "CRITICAL":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-300 dark:border-red-800",
          text: "text-red-700 dark:text-red-400",
          badge: "bg-red-600",
          icon: "text-red-600 dark:text-red-400"
        };
      case "WARNING":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950/30",
          border: "border-yellow-300 dark:border-yellow-800",
          text: "text-yellow-700 dark:text-yellow-400",
          badge: "bg-yellow-600",
          icon: "text-yellow-600 dark:text-yellow-400"
        };
      default:
        return {
          bg: "bg-green-50 dark:bg-green-950/30",
          border: "border-green-300 dark:border-green-800",
          text: "text-green-700 dark:text-green-400",
          badge: "bg-green-600",
          icon: "text-green-600 dark:text-green-400"
        };
    }
  };

  const toggleZoom = (layerId: string) => {
    setIsZoomed(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const handleImageLoad = (layerId: string) => {
    setImageLoaded(prev => ({ ...prev, [layerId]: true }));
  };

  return (
    <div className='space-y-4'>
      <div
        key={layer?.layer_id}
        className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6"
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileImage className={`w-5 h-5 ${getStatusColor(layer?.status)}`} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {layer?.layer_title}
            </h3>
          </div>

          {/* Status Badge */}
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusStyles[layer?.status_color] || statusStyles.gray}`}>
            {layer?.status}
            {layer?.status !== "PASS" && (
              <span className="ml-1">
                - Score: {layer?.score}
              </span>
            )}
          </span>
        </div>

        {/* Visual Evidence Image */}
        {layer?.has_visual_evidence && layer?.evidence_image_url && (
          <div className={`relative bg-gray-100 dark:bg-slate-900 rounded-lg overflow-hidden mb-4 border-2 ${getStatusColor(layer?.status).border}`}>
            {/* Overlay badges */}
            <div className="absolute top-3 left-3 z-10 flex gap-2">
              <span className="px-3 py-1 bg-black/70 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
                FORENSIC EVIDENCE
              </span>
              <span className={`px-3 py-1 ${getStatusColor(layer?.status).badge} text-white text-xs font-semibold rounded-full`}>
                {layer?.status}
              </span>
            </div>

            <div className={`relative transition-all duration-300 ${isZoomed[layer?.layer_id] ? 'cursor-zoom-out' : 'cursor-zoom-in top-10'}`}>
              <DocumentViewer fileType="image" fileUrl={layer?.evidence_image_url} />
              {!layer?.evidence_image_url && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Image overlay annotation */}
            <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm">
              Error Level Analysis
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className={`mb-4 p-4 ${getStatusColor(layer?.status).bg} rounded-lg border ${getStatusColor(layer?.status).border}`}>
          <div className="flex items-start gap-2">
            <Shield className={`w-4 h-4 ${getStatusColor(layer?.status).icon} mt-0.5 flex-shrink-0`} />
            <div>
              <p className={`text-xs font-semibold ${getStatusColor(layer?.status).text} uppercase tracking-wider mb-1`}>
                AI Analysis
              </p>
              <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                {layer?.ai_analysis}
              </p>
            </div>
          </div>
        </div>

        {/* ATS Hacking / Visual Manipulation Detail */}
        {layer?.ATS_hacking && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Visual Manipulation: ATS Hacking
              </p>
            </div>

            <p className="text-sm text-gray-900 dark:text-slate-200 font-medium mb-3">
              {layer?.ATS_hacking}
            </p>

            {layer?.ats_hacking_details && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded border border-amber-100 dark:border-amber-900/30">
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase font-bold">Hidden White Characters</p>
                  <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                    {layer.ats_hacking_details.hidden_white_chars || 0}
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded border border-amber-100 dark:border-amber-900/30">
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase font-bold">Micro-font Characters</p>
                  <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                    {layer.ats_hacking_details.micro_font_chars || 0}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Technical Proofs */}
        {layer?.technical_proofs && layer?.technical_proofs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Technical Evidence
            </p>
            <div className="space-y-2">
              {layer?.technical_proofs.map((proof, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600"
                >
                  <div className={`w-6 h-6 rounded-full ${getStatusColor(layer.status).badge} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                  </div>
                  <span className="text-gray-900 dark:text-white font-mono text-sm">
                    {proof}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}