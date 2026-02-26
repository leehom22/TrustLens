import { FileText } from 'lucide-react'
import React from 'react'

const NoSelected = () => {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Selected</h3>
                <p className="text-gray-600">Select a document from the list to begin review</p>
            </div>
        </div>
    )
}

export default NoSelected