import { AlertTriangle, FileText, Shield, } from 'lucide-react'
import { LayerResult } from '@/app/types/db-ai-analysis-type'
import { statusStyles } from '@/lib/utils'

const Metadata = ({ layer }: { layer: LayerResult }) => {

    return (
        <div className='space-y-4'>
                <div
                    key={layer?.layer_id}
                    className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {layer?.layer_title}
                            </h3>
                        </div>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusStyles[layer?.status_color] || statusStyles.gray}`}>
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
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-1">
                                    AI Analysis
                                </p>
                                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                    {layer?.ai_analysis}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Technical Proofs */}
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
                                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-gray-900 dark:text-white font-mono text-sm">
                                        {proof}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
        </div>
    )
}

export default Metadata