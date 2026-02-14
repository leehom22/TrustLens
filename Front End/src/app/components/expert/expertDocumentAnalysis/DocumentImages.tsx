import { useState, useRef, useEffect, Fragment } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Stage, Layer, Rect } from 'react-konva';
import { ZoomIn, ZoomOut, RotateCcw, Square, Trash2, GripVertical, Download } from 'lucide-react';
import Konva from 'konva';
import { Annotation, ImageViewerProps } from '@/app/types/document-highlight-type';
import { deleteAnnotationFromFirestore, downloadAnnotatedImage, loadAnnotationsFromFirestore, saveAnnotationToFirestore } from '@/api/documentImages';

export default function ImageViewer({ userId, documentUrl, documentId, documentName }: ImageViewerProps) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingMode, setDrawingMode] = useState(false); // New state for drawing mode toggle
    const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null);
    const [comment, setComment] = useState('');
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 800, height: 600 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const annotationIdRef = useRef(0);
    const stageRef = useRef<Konva.Stage>(null);
    const transformRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const handleSidebarMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    const handleSideBarMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const newWidth = e.clientX ;
        // Set min and max width constraints
        if (newWidth >= 180 && newWidth <= 500) {
            setSidebarWidth(newWidth);
        }
    };

    const handleSidebarMouseUp = () => {
        setIsResizing(false);
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleSideBarMouseMove);
            document.addEventListener('mouseup', handleSidebarMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleSideBarMouseMove);
            document.removeEventListener('mouseup', handleSidebarMouseUp);
        };
    }, [isResizing]);

    // Load image and set dimensions
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = documentUrl;

        img.onload = () => {
            const maxWidth = window.innerWidth - 400;
            const maxHeight = window.innerHeight - 150;

            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }

            setImageSize({ width, height });
            setImageLoaded(true);
        };

        img.onerror = () => {
            console.error('Failed to load image');
            setImageLoaded(true);
        };
    }, [documentUrl]);

    const handleDeleteAnnotation = async (annotation: Annotation) => {
        if (annotation.firestoreId) {
            await deleteAnnotationFromFirestore(annotation.firestoreId);
        }
        setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    };

    // Handle mouse down on stage
    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!drawingMode) return; // Only draw when in drawing mode
        
        const stage = stageRef.current;
        if (!stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        setIsDrawing(true);
        setCurrentAnnotation({
            id: annotationIdRef.current,
            type: 'rectangle',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            color: 'rgba(255, 0, 0, 0.5)',
            comment: '',
        });
    };

    // Handle mouse move on stage
    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isDrawing || !currentAnnotation) return;

        const stage = stageRef.current;
        if (!stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        const width = pos.x - currentAnnotation.x!;
        const height = pos.y - currentAnnotation.y!;

        setCurrentAnnotation({
            ...currentAnnotation,
            width: width,
            height: height,
        });
    };

    // Handle mouse up on stage
    const handleMouseUp = () => {
        if (!isDrawing || !currentAnnotation) return;

        setIsDrawing(false);

        // Only save if annotation has meaningful size
        if (Math.abs(currentAnnotation.width || 0) > 10 &&
            Math.abs(currentAnnotation.height || 0) > 10) {
            setShowCommentBox(true);
        } else {
            setCurrentAnnotation(null);
        }
    };

    // Save annotation with comment
    const saveAnnotation = async () => {
        if (!currentAnnotation || !comment.trim()) {
            alert('Please enter a comment');
            return;
        }

        const newAnnotation: Annotation = {
            id: annotationIdRef.current++,
            type: 'rectangle',
            x: currentAnnotation.x!,
            y: currentAnnotation.y!,
            width: currentAnnotation.width!,
            height: currentAnnotation.height!,
            color: currentAnnotation.color!,
            comment: comment,
        };

        try {
            const firestoreId = await saveAnnotationToFirestore(documentId,userId,newAnnotation);
            newAnnotation.firestoreId = firestoreId;

            setAnnotations((prev) => [...prev, newAnnotation]);
            setCurrentAnnotation(null);
            setComment('');
            setShowCommentBox(false);
        } catch (error) {
            console.error('Failed to save annotation:', error);
            alert('Failed to save annotation. Please try again.');
        }
    };

    const cancelAnnotation = () => {
        setCurrentAnnotation(null);
        setComment('');
        setShowCommentBox(false);
    };

    useEffect(() => {
        loadAnnotationsFromFirestore(documentId,userId,setAnnotations,annotationIdRef);
    }, []);

    if (!imageLoaded) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-slate-400">Loading image...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-slate-900">
            {/* Sidebar */}
            <div 
                ref={sidebarRef}
                className="bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 overflow-y-auto relative"
                style={{ width: `${sidebarWidth}px` }}
            >
                <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Annotations
                    </h3>

                    {/* Instructions */}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Square className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-900 dark:text-blue-200">
                                {drawingMode 
                                    ? "Click and drag on the image to create a rectangular annotation"
                                    : "Pan mode active. Enable drawing mode to create annotations"}
                            </p>
                        </div>
                    </div>

                    {/* Annotations List */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                            Your Annotations ({annotations.length})
                        </h4>
                        {annotations.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-slate-400">No annotations yet</p>
                        )}
                        {annotations.map((annotation) => (
                            <div
                                key={annotation.id}
                                className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
                                onClick={() => setSelectedAnnotationId(annotation.id)}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Square className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            Annotation #{annotation.id}
                                        </span>
                                    </div>
                                    <button
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAnnotation(annotation);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-slate-300">
                                    {annotation.comment}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resize Handle */}
                <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group"
                    onMouseDown={handleSidebarMouseDown}
                >
                    <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 bg-gray-300 dark:bg-slate-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-3 h-3 text-gray-600 dark:text-slate-300" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4">
                    <div className="flex gap-2">
                        {/* Drawing Mode Toggle */}
                        <button
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded ${
                                drawingMode
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'
                            }`}
                            onClick={() => setDrawingMode(!drawingMode)}
                        >
                            <Square className="w-4 h-4" />
                            {drawingMode ? 'Drawing Mode' : 'Pan Mode'}
                        </button>
                        
                        <div className="w-px bg-gray-300 dark:bg-slate-600 mx-1"></div>

                        {/* Download Button */}
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            onClick={() => downloadAnnotatedImage(stageRef,imageSize,documentUrl,annotations,documentName)}
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                                        
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                            onClick={() => transformRef.current?.zoomIn()}
                        >
                            <ZoomIn className="w-4 h-4" />
                            Zoom In
                        </button>
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                            onClick={() => transformRef.current?.zoomOut()}
                        >
                            <ZoomOut className="w-4 h-4" />
                            Zoom Out
                        </button>
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                            onClick={() => transformRef.current?.resetTransform()}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-hidden relative" ref={containerRef}>
                    <TransformWrapper
                        ref={transformRef}
                        initialScale={1}
                        minScale={0.5}
                        maxScale={20}
                        wheel={{ step: 0.1 }}
                        panning={{ disabled: drawingMode || isDrawing }} // Disable panning only in drawing mode
                    >
                        <TransformComponent
                            wrapperStyle={{
                                width: '100%',
                                height: '100%',
                            }}
                        >
                            <div className="relative inline-block">
                                {/* Background Image */}
                                <img
                                    src={documentUrl}
                                    alt="Document"
                                    style={{
                                        width: imageSize.width,
                                        height: imageSize.height,
                                        display: 'block',
                                    }}
                                    className='object-contain'
                                />

                                {/* Konva Overlay */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: imageSize.width,
                                        height: imageSize.height,
                                        pointerEvents: drawingMode ? 'auto' : 'none', // Only capture events in drawing mode
                                    }}
                                >
                                    <Stage
                                        width={imageSize.width}
                                        height={imageSize.height}
                                        ref={stageRef}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        style={{
                                            cursor: drawingMode ? 'crosshair' : 'grab',
                                        }}
                                    >
                                        <Layer>
                                            {/* Render saved annotations */}
                                            {annotations.map((annotation) => (
                                                <Rect
                                                    key={annotation.id}
                                                    x={annotation.x}
                                                    y={annotation.y}
                                                    width={annotation.width}
                                                    height={annotation.height}
                                                    stroke={selectedAnnotationId === annotation.id ? '#3b82f6' : '#ef4444'}
                                                    strokeWidth={selectedAnnotationId === annotation.id ? 3 : 2}
                                                    fill="rgba(255, 0, 0, 0.2)"
                                                />
                                            ))}

                                            {/* Render current drawing annotation */}
                                            {currentAnnotation && (
                                                <Rect
                                                    x={currentAnnotation.x!}
                                                    y={currentAnnotation.y!}
                                                    width={currentAnnotation.width || 0}
                                                    height={currentAnnotation.height || 0}
                                                    stroke="#ef4444"
                                                    strokeWidth={2}
                                                    fill="rgba(255, 0, 0, 0.2)"
                                                    dash={[5, 5]}
                                                />
                                            )}
                                        </Layer>
                                    </Stage>
                                </div>
                            </div>
                        </TransformComponent>
                    </TransformWrapper>

                    {/* Comment Box */}
                    {showCommentBox && (
                        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl p-4 z-50">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                Add Comment
                            </h4>
                            <textarea
                                className="w-64 h-24 p-2 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700"
                                placeholder="Enter your comment..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-2 mt-3">
                                <button
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                    onClick={saveAnnotation}
                                >
                                    Save
                                </button>
                                <button
                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                                    onClick={cancelAnnotation}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}