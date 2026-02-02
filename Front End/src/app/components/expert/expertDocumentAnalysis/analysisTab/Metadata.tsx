import { AlertTriangle, FileText, Globe, Shield, Wand2 } from 'lucide-react'
import React from 'react'
import { DocumentMetadata } from '../../../../types/type'

const Metadata = ({metadata}:{metadata:DocumentMetadata}) => {
    return (
        <div className='space-y-4'>
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
        </div>
    )
}

export default Metadata