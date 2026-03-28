import React from 'react'
import { AlertCircle } from 'lucide-react'
import { DocumentAnalysisResult } from '@/app/types/db-ai-analysis-type'
import { useLanguage } from '@/app/components/LanguageProvider'

const AnalysisSummary = ({ selectedDocument }: { selectedDocument: DocumentAnalysisResult | null }) => {
    const { language } = useLanguage();

    const t = {
        en: { 
            riskScore: "Risk Score",
            recommendedAction: "Recommended Action" 
        },
        ms: { 
            riskScore: "Skor Risiko",
            recommendedAction: "Tindakan Disyorkan" 
        }
    }[language];

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 mb-6 transition-colors shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <AlertCircle
                    className="w-5 h-5"
                    style={{ color: selectedDocument?.dashboard_header?.risk_level_color === 'yellow'? '#D4AC0D': selectedDocument?.dashboard_header?.risk_level_color}}
                />
                {selectedDocument?.dashboard_header?.verdict_title}
            </h3>

            {/* Risk Level Badge */}
            <div className="mb-4">
                <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{
                        backgroundColor: `white`,
                        color: selectedDocument?.dashboard_header?.risk_level_color === 'yellow'? '#D4AC0D': selectedDocument?.dashboard_header?.risk_level_color
                    }}
                >
                    {selectedDocument?.dashboard_header?.risk_level} - {t.riskScore}: {selectedDocument?.dashboard_header?.overall_score}
                </span>
            </div>

            {/* Executive Summary */}
            <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed">
                {selectedDocument?.dashboard_header?.ai_executive_summary}
            </p>

            {/* Grounding Search Reference */}
            {selectedDocument?.dashboard_header?.grounding_search_reference && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{selectedDocument?.dashboard_header?.grounding_search_reference}</span>
                    </p>
                </div>
            )}

            {/* Next Step Recommendation */}
            <div className="bg-gray-50 dark:bg-slate-950/50 rounded-lg p-4 border border-transparent dark:border-slate-800">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 uppercase tracking-wider">
                    {t.recommendedAction}
                </h4>
                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                    {selectedDocument?.dashboard_header?.next_step_recommendation}
                </p>
            </div>
        </div>
    )
}

export default AnalysisSummary