import { LayerResult } from "@/app/types/db-ai-analysis-type";
import { FileImage, Shield, ZoomIn } from "lucide-react";
import { useState } from "react";

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
            key={layer.layer_id}
            className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6"
          >
            {/* Header */}
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FileImage className={`w-5 h-5 ${getStatusColor(layer.status)}`} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {layer.layer_title}
                </h3>
              </div>
              
              {/* Status Badge */}
              <span 
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  layer.status === 'CRITICAL' || layer.status === 'FAIL'
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : layer.status === 'WARNING'
                    ? 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                }`}
              >
                {layer.status} - Score: {layer.score}
              </span>
            </div>

            {/* Visual Evidence Image */}
            {layer.has_visual_evidence && layer.evidence_image_url && (
              <div className={`relative bg-gray-100 dark:bg-slate-900 rounded-lg overflow-hidden mb-4 border-2 ${getStatusColor(layer.status).border}`}>
                {/* Overlay badges */}
                <div className="absolute top-3 left-3 z-10 flex gap-2">
                  <span className="px-3 py-1 bg-black/70 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
                    FORENSIC EVIDENCE
                  </span>
                  <span className={`px-3 py-1 ${getStatusColor(layer.status).badge} text-white text-xs font-semibold rounded-full`}>
                    {layer.status}
                  </span>
                </div>

                {/* Zoom button */}
                <button
                  onClick={() => toggleZoom(layer.layer_id)}
                  className="absolute top-3 right-3 z-10 p-2 bg-black/70 text-white rounded-lg hover:bg-black/80 transition-colors backdrop-blur-sm"
                  aria-label={isZoomed[layer.layer_id] ? "Reset zoom" : "Zoom in"}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                
                <div className={`relative transition-all duration-300 ${isZoomed[layer.layer_id] ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}>
                  <img
                    src={layer.evidence_image_url}
                    alt={`Visual evidence for ${layer.layer_title}`}
                    className={`w-full transition-all duration-300 ${
                      isZoomed[layer.layer_id] ? 'scale-150' : 'scale-100'
                    } ${!imageLoaded[layer.layer_id] ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => handleImageLoad(layer.layer_id)}
                    onClick={() => toggleZoom(layer.layer_id)}
                  />
                  {!imageLoaded[layer.layer_id] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Image overlay annotation */}
                <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm">
                  Error Level Analysis
                </div>

                {/* Visual Legend */}
                <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs">
                  <div className="px-2 py-1 bg-black/70 text-white rounded backdrop-blur-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded"></div>
                    <span>High</span>
                  </div>
                  <div className="px-2 py-1 bg-black/70 text-white rounded backdrop-blur-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded"></div>
                    <span>Medium</span>
                  </div>
                  <div className="px-2 py-1 bg-black/70 text-white rounded backdrop-blur-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded"></div>
                    <span>Original</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <div className={`mb-4 p-4 ${getStatusColor(layer.status).bg} rounded-lg border ${getStatusColor(layer.status).border}`}>
              <div className="flex items-start gap-2">
                <Shield className={`w-4 h-4 ${getStatusColor(layer.status).icon} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-semibold ${getStatusColor(layer.status).text} uppercase tracking-wider mb-1`}>
                    AI Analysis
                  </p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                    {layer.ai_analysis}
                  </p>
                </div>
              </div>
            </div>

            {/* Technical Proofs */}
            {layer.technical_proofs && layer.technical_proofs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Technical Evidence
                </p>
                <div className="space-y-2">
                  {layer.technical_proofs.map((proof, idx) => (
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