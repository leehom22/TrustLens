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