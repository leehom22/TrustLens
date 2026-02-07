import { useRef, useState } from "react";
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext,
  PdfHighlighterUtils,
} from "react-pdf-highlighter-plus";
import "react-pdf-highlighter-plus/style/style.css";

export default function App() {
  const [highlights, setHighlights] = useState([]);
  const utilsRef = useRef<PdfHighlighterUtils>(null);
  return (
    <PdfLoader document="https://r115epa2sy.ufs.sh/f/rkOi1LfXPqQ2EfR7w9jUiBzWnpQeNAsJ7jbPd3x8qt5hT0Hm">
      {(pdfDocument) => (
        <PdfHighlighter
          utilsRef={(utils) => {
            utilsRef.current = utils;
          }}
          pdfDocument={pdfDocument}
          highlights={highlights}
          enableAreaSelection={(e) => e.altKey}
        >
          <HighlightContainer />
        </PdfHighlighter>
      )}
    </PdfLoader>
  );
}

function HighlightContainer() {
  const { highlight, isScrolledTo } = useHighlightContainerContext();

  return highlight.type === "text" ? (
    <TextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
  ) : (
    <AreaHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
  );
}