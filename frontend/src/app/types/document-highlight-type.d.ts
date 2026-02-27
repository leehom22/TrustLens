// PDF highlight
export interface TextHighlight {
  id: string;
  position: {
    boundingRect: ScaledPosition;
    rects: ScaledPosition[];
    pageNumber: number;
  };
  content: {
    text: string;
  };
  comment?: {
    text: string;
    emoji?: string;
  };
}

// Images highlight
export interface Annotation {
    id: number;
    type: 'rectangle';
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    comment: string;
    firestoreId?: string;
}

export interface ImageViewerProps {
    userId: string;
    documentUrl: string;
    documentId: string;
    documentName: string;
    setDownloadAnnotations:  React.Dispatch<React.SetStateAction<Annotation[]>>
    setParentImageSize:React.Dispatch<React.SetStateAction<{
    height: number;
    width: number;
}>>
}

interface Note {
  id: number;
  content: string;
  highlightAreas: HighlightArea[];
  quote: string;
  firestoreId?: string  // Firestore document ID
}