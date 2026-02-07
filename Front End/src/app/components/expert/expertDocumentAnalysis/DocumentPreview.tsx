import React, { useState, useEffect, useCallback, useRef } from "react";
import "react-pdf-highlighter/dist/style.css";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
  Tip,
} from 'react-pdf-highlighter';

import type {
  Content,
  IHighlight,
  NewHighlight,
  ScaledPosition,
} from "react-pdf-highlighter";

import { testHighlights as _testHighlights } from "../expertDocumentAnalysis/pdfViewer/test-highlights";
import { Eye, Loader2 } from 'lucide-react'
import { PDFSidebar } from "./pdfViewer/PDFSidebar";


const testHighlights: Record<string, Array<IHighlight>> = _testHighlights;

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () =>
  document.location.hash.slice("#highlight-".length);

const resetHash = () => {
  document.location.hash = "";
};

const HighlightPopup = ({
  comment,
}: {
  comment: { text: string; emoji: string };
}) =>
  comment.text ? (
    <div className="Highlight__popup">
      {comment.emoji} {comment.text}
    </div>
  ) : null;

const PRIMARY_PDF_URL = "https://r115epa2sy.ufs.sh/f/rkOi1LfXPqQ2EfR7w9jUiBzWnpQeNAsJ7jbPd3x8qt5hT0Hm";
const SECONDARY_PDF_URL = "https://r115epa2sy.ufs.sh/f/rkOi1LfXPqQ2QxrHQx3EXqhD4HpnIVQvU8M6kG9uYFdmifx5";

export default function DocumentPreview() {
  const searchParams = new URLSearchParams(document.location.search);
  const initialUrl = searchParams.get("url") || PRIMARY_PDF_URL;

  const [url, setUrl] = useState(initialUrl);
  const [highlights, setHighlights] = useState<Array<IHighlight>>(
    testHighlights[initialUrl] ? [...testHighlights[initialUrl]] : [],
  );
  const [scale, setScale] = useState(1.0);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  const resetHighlights = () => {
    setHighlights([]);
  };

  const toggleDocument = () => {
    const newUrl =
      url === PRIMARY_PDF_URL ? SECONDARY_PDF_URL : PRIMARY_PDF_URL;
    setUrl(newUrl);
    setHighlights(testHighlights[newUrl] ? [...testHighlights[newUrl]] : []);
  };

  const scrollViewerTo = useRef((highlight: IHighlight) => { });

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash());
    if (highlight) {
      scrollViewerTo.current(highlight);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash, false);
    return () => {
      window.removeEventListener(
        "hashchange",
        scrollToHighlightFromHash,
        false,
      );
    };
  }, [scrollToHighlightFromHash]);

  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  };

  const addHighlight = (highlight: NewHighlight) => {
    console.log("Saving highlight", highlight);
    setHighlights((prevHighlights) => [
      { ...highlight, id: getNextId() },
      ...prevHighlights,
    ]);
  };

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>,
  ) => {
    console.log("Updating highlight", highlightId, position, content);
    setHighlights((prevHighlights) =>
      prevHighlights.map((h) => {
        const {
          id,
          position: originalPosition,
          content: originalContent,
          ...rest
        } = h;
        return id === highlightId
          ? {
            id,
            position: { ...originalPosition, ...position },
            content: { ...originalContent, ...content },
            ...rest,
          }
          : h;
      }),
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 mb-6 transition-colors shadow-sm">
      {/* Header section */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Expert Document Review
      </h3>

      {/* Main Container: Flex layout using Tailwind */}
      <div className="flex flex-col lg:flex-row bg-gray-100 dark:bg-slate-950 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 h-[800px]">

        {/* Sidebar Component: 25% width on large screens */}
        <div className="w-full lg:w-1/4 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-slate-800 overflow-y-auto">
          <PDFSidebar
            highlights={highlights}
            resetHighlights={resetHighlights}
            toggleDocument={toggleDocument}
          />
        </div>

        {/* PDF Viewer Area: 75% width on large screens */}
        <div className="relative flex-1 h-full overflow-hidden">
          <PdfLoader
            url={url}
            beforeLoad={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            }
          >
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                onScrollChange={resetHash}
                scrollRef={(scrollTo) => {
                  scrollViewerTo.current = scrollTo;
                  scrollToHighlightFromHash();
                }}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection,
                ) => (
                  <Tip
                    onOpen={transformSelection}
                    onConfirm={(comment) => {
                      addHighlight({ content, position, comment });
                      hideTipAndSelection();
                    }}
                  />
                )}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  screenshot,
                  isScrolledTo,
                ) => {
                  const isTextHighlight = !highlight.content?.image;

                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        updateHighlight(
                          highlight.id,
                          { boundingRect: viewportToScaled(boundingRect) },
                          { image: screenshot(boundingRect) },
                        );
                      }}
                    />
                  );

                  return (
                    <Popup
                      popupContent={<HighlightPopup {...highlight} />}
                      onMouseOver={(popupContent) =>
                        setTip(highlight, (highlight) => popupContent)
                      }
                      onMouseOut={hideTip}
                      key={index}
                    >
                      {component}
                    </Popup>
                  );
                }}
                highlights={highlights}
              />
            )}
          </PdfLoader>
        </div>
      </div>

      {/* Footer shortcut hint */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-500 px-1">
        <div className="flex gap-4">
          <span><span className="font-bold text-blue-600 dark:text-blue-400 underline">Text Selection:</span> Highlight and Comment</span>
          <span><span className="font-bold text-blue-600 dark:text-blue-400 underline">ALT + Drag:</span> Area Highlight</span>
        </div>
        <span>{highlights.length} Annotations</span>
      </div>
    </div>
  );
}
