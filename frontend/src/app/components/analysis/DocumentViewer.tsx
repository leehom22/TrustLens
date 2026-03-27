import React from 'react';
// PDF Imports
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// Image Zoom Imports
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Loader2, FileQuestion } from 'lucide-react';

interface DocumentViewerProps {
  fileUrl?: string;
  imageUrl?: string[];
  fileType: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ fileUrl, fileType, imageUrl }) => {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  
  const isPdf = fileType?.toLowerCase().includes('pdf');

  // 🚀 FIX 1: If the URL is explicitly marked as missing, show a clean error state
  if (fileUrl === "missing") {
    return (
        <div className="w-full bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200 shadow-inner h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]">
            <div className="flex flex-col items-center gap-3 text-gray-500">
                <FileQuestion className="w-12 h-12 text-gray-400" />
                <p className="text-sm font-medium">Document file is missing from the database.</p>
                <p className="text-xs text-gray-400">This is likely an old record without an uploaded file.</p>
            </div>
        </div>
    );
  }

  // 🚀 FIX 2: Show loading spinner ONLY while we are actively waiting for a real URL
  if (!fileUrl && (!imageUrl || imageUrl.length === 0)) {
      return (
          <div className="w-full bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200 shadow-inner h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm font-medium">Loading document viewer...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-inner h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]">
      {isPdf && fileUrl ? (
        /* PDF VIEWING ENGINE */
        <div className="h-full">
          <Worker workerUrl="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js">
            <Viewer
              fileUrl={fileUrl}
              plugins={[defaultLayoutPluginInstance]}
            />
          </Worker>
        </div>
      ) : (
        /* IMAGE VIEWING ENGINE WITH MAGNIFICATION */
        <div className="h-full w-full flex justify-center">
          <TransformWrapper
            initialScale={1}
            initialPositionX={0}
            initialPositionY={0}
            minScale={0.5}
            maxScale={20}
            centerOnInit={true}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <React.Fragment>
                <div className="flex flex-col p-2 sm:p-3 gap-2 sm:gap-4 h-full w-full">

                  {/* Zoom Controls */}
                  <div className="z-10 flex gap-1.5 sm:gap-2">
                    <button
                      onClick={() => zoomIn()}
                      className="bg-white/90 dark:bg-slate-700/90 px-3 py-1.5 sm:p-2 rounded shadow hover:bg-white dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 text-sm sm:text-base font-medium transition-colors border border-transparent dark:border-slate-600"
                      aria-label="Zoom in"
                    >
                      +
                    </button>

                    <button
                      onClick={() => zoomOut()}
                      className="bg-white/90 dark:bg-slate-700/90 px-3 py-1.5 sm:p-2 rounded shadow hover:bg-white dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 text-sm sm:text-base font-medium transition-colors border border-transparent dark:border-slate-600"
                      aria-label="Zoom out"
                    >
                      −
                    </button>

                    <button
                      onClick={() => resetTransform()}
                      className="bg-white/90 dark:bg-slate-700/90 px-3 py-1.5 sm:p-2 rounded shadow hover:bg-white dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium transition-colors border border-transparent dark:border-slate-600"
                      aria-label="Reset zoom"
                    >
                      Reset
                    </button>
                  </div>

                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <div className="flex flex-col items-center gap-4 w-full">
                      {
                        Array.isArray(imageUrl) === true && imageUrl && imageUrl.length > 0 ? 
                        imageUrl.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Document ${index + 1}`}
                            className="max-w-full object-contain"
                          />
                        )) :
                        <img
                            src={imageUrl || fileUrl}
                            alt={`Document`}
                            className="max-w-full object-contain"
                          />
                    }
                    </div>
                  </TransformComponent>

                </div>
              </React.Fragment>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;