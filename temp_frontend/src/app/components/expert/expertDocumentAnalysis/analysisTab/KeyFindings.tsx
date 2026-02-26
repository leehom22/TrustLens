import { AlertTriangle, Calculator, CheckCircle, Info, Shield } from 'lucide-react'
import { Badge } from "@/app/components/ui/badge";
import { LayerResult } from '@/app/types/db-ai-analysis-type';
import { statusStyles } from '@/lib/utils';

interface LogicalConsistencyProps {
    layer: LayerResult
    sources: string[]
    nextStepRecommendation: string | null
}

const LogicalConsistency = ({ layer, nextStepRecommendation, sources }: LogicalConsistencyProps) => {

    return (
        <div className='space-y-4'>
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                {/* Header */}
                <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {layer?.layer_title}
                        </h3>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusStyles[layer?.status_color!] || statusStyles.gray}`}>
                        {layer?.status}
                        {
                            layer?.status !== "PASS" && (
                                <p>
                                    - Score: {layer?.score}
                                </p>
                            )
                        }
                    </span>
                </div>

                {/* AI Analysis */}
                <div className={`mb-4 p-4 rounded-lg border shadow-sm ${layer?.status === 'CRITICAL' || layer?.status === 'FAIL'
                    ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-600/50'
                    : layer.status === 'WARNING'
                        ? 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-600/50'
                        : 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-600/50'
                    }`}>
                    <div className="flex items-start gap-3">
                        {layer?.status === 'CRITICAL' || layer?.status === 'FAIL' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        ) : layer?.status === 'WARNING' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        ) : (
                            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Key Finding</h4>
                                <Badge
                                    variant={layer?.status === 'FAIL' || layer?.status === 'CRITICAL' ? "destructive" : "default"}
                                    className={`${layer?.status === "WARNING"
                                        ? "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                                        : layer?.status === "PASS"
                                            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                            : ""
                                        }`}
                                >
                                    {layer?.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">
                                {layer?.ai_analysis}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Technical Proofs */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Technical Evidence
                    </h4>
                    <div className="space-y-3">
                        {layer?.technical_proofs.map((proof, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border shadow-sm ${layer?.status === 'CRITICAL' || layer?.status === 'FAIL'
                                    ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-600/50"
                                    : layer?.status === 'WARNING'
                                        ? "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-600/50"
                                        : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-600/50"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {layer?.status === 'CRITICAL' || layer?.status === 'FAIL' ? (
                                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                    ) : layer?.status === 'WARNING' ? (
                                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${layer?.status === 'CRITICAL' || layer?.status === 'FAIL'
                                                ? 'bg-red-600'
                                                : layer?.status === 'WARNING'
                                                    ? 'bg-yellow-600'
                                                    : 'bg-blue-600'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <h5 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                Evidence {idx + 1}
                                            </h5>
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-slate-200 font-mono">
                                            {proof}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sources */}
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-3">
                        Sources
                    </h3>

                    <div className="flex flex-col gap-2">
                        {sources?.length > 0 ? (
                            sources.map((source, index) => (
                                <a
                                    key={index}
                                    href={source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-100 hover:text-blue-800 dark:hover:text-blue-200 hover:underline break-all text-sm transition-colors"
                                >
                                    {source}
                                </a>
                            ))
                        ) : (
                            <div className="text-sm text-gray-500 italic dark:text-white">
                                No external references available.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recommended Actions - Dynamic based on status */}
            <div className={`rounded-xl border p-6 ${layer?.status === 'CRITICAL' || layer?.status === 'FAIL'
                ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-600/50'
                : layer?.status === 'WARNING' || layer?.status === 'CAUTION'
                    ? 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-400 dark:border-yellow-600/50'
                    : layer?.status === 'PASS' ?
                        'bg-green-50 dark:bg-green-950/50 border-green-400 dark:border-green-600/50'
                        : 'bg-gray-50 dark:bg-gray-950/50 border-gray-400 dark:border-gray-600/50'
                }`}>
                <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${layer?.status === 'CRITICAL' || layer?.status === 'FAIL'
                    ? 'text-red-900 dark:text-red-200'
                    : layer?.status === 'WARNING'
                        ? 'text-yellow-900 dark:text-yellow-200'
                        : 'text-green-900 dark:text-green-200'
                    }`}>
                    {layer?.status === 'CRITICAL' || layer?.status === 'FAIL' ? (
                        <>
                            <AlertTriangle className="w-5 h-5" />
                            ⚠️ Critical Recommendation
                        </>
                    ) : layer?.status === 'WARNING' || layer?.status === 'CAUTION' ? (
                        <>
                            <AlertTriangle className="w-5 h-5" />
                            ⚠️ Recommended Actions
                        </>
                    ) : layer?.status === 'PASS' ? (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            ✓ Recommendations
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            ✓ Recommendations
                        </>
                    )
                    }
                </h3>

                <>
                    <p className='text-gray-700 dark:text-slate-200 mb-3'>
                        {
                            nextStepRecommendation || "No specific recommendations provided. However, it is advisable to review the document thoroughly and ensure all calculations are accurate before proceeding."
                        }
                    </p>
                    {/* <p className="text-gray-800 dark:text-white mb-3">
                            <strong>DO NOT PROCEED</strong> with this document until critical issues are resolved:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-slate-300">
                            <li>Request a corrected version with accurate calculations from the sender</li>
                            <li>Have the document reviewed by a financial professional or accountant</li>
                            <li>Verify all numerical data independently before making any payments</li>
                            <li>Document all discrepancies and communicate them to the sender</li>
                            <li>Do not sign or approve until all mathematical errors are corrected</li>
                        </ol> */}
                </>
            </div>
        </div>
    )
}

export default LogicalConsistency