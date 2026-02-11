import React from 'react';
// PDF Imports
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// Image Zoom Imports
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface DocumentViewerProps {
  fileUrl: string;
  fileType: 'application/pdf' | 'image';
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ fileUrl, fileType }) => {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  return (
    <div className="w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-inner" style={{ height: "80vh" }}>
      {fileType === 'application/pdf' ? (
        /* PDF VIEWING ENGINE */
        <div className="h-full">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <Viewer 
              fileUrl={fileUrl} 
              plugins={[defaultLayoutPluginInstance]} 
            />
          </Worker>
        </div>
      ) : (
        /* IMAGE VIEWING ENGINE WITH MAGNIFICATION */
        <div className="h-full flex  justify-center ">
          <TransformWrapper
            initialScale={1}
            initialPositionX={0} 
            initialPositionY={0}
            minScale={0.5}
            maxScale={20}
            centerOnInit={true}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <React.Fragment >
                <div className='flex flex-col p-3'>
                    {/* Floating Controls for Image */}
                    <div className=" z-10 flex gap-2">
                    <button onClick={() => zoomIn()} className="bg-white/90 p-2 rounded shadow hover:bg-white">+</button>
                    <button onClick={() => zoomOut()} className="bg-white/90 p-2 rounded shadow hover:bg-white">-</button>
                    <button onClick={() => resetTransform()} className="bg-white/90 p-2 rounded shadow hover:bg-white">Reset</button>
                    </div>
                        
                    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <img 
                        src={fileUrl} 
                        alt="Document" 
                        className="max-w-full h-auto object-contain"
                    />
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