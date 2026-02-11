import { Trash2, ExternalLink } from "lucide-react";
import type { IHighlight } from "react-pdf-highlighter";

interface Props {
  highlights: Array<IHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
}

const updateHash = (highlight: IHighlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

declare const APP_VERSION: string;

export function PDFSidebar({
  highlights,
  toggleDocument,
  resetHighlights,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900/50">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider mb-2">
          Annotations
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          Select text to comment, or hold <kbd className="font-sans px-1 py-0.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded shadow-sm">Alt</kbd> to drag area highlights.
        </p>
      </div>

      {/* Highlights List */}
      <ul className="flex-1 overflow-y-auto overflow-x-hidden">
        {highlights.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-600">No annotations yet.</p>
          </div>
        ) : (
          highlights.map((highlight, index) => (
            <li
              key={highlight.id}
              className="p-4 border-b border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors group"
              onClick={() => updateHash(highlight)}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                    Page {highlight.position.pageNumber}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>

                <strong className="block text-sm text-gray-800 dark:text-slate-200 mb-2">
                  {highlight.comment.emoji} {highlight.comment.text || "No comment provided"}
                </strong>

                {highlight.content.text ? (
                  <blockquote className="text-xs italic text-gray-600 dark:text-slate-400 border-l-2 border-gray-300 dark:border-slate-700 pl-3 py-1 bg-gray-100/50 dark:bg-slate-950/50 rounded-r">
                    {`${highlight.content.text.slice(0, 90).trim()}…`}
                  </blockquote>
                ) : null}

                {highlight.content.image ? (
                  <div className="mt-2 rounded-md border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm bg-white">
                    <img
                      src={highlight.content.image}
                      alt={"Screenshot"}
                      className="w-full h-auto object-contain max-h-32"
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Action Footer */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={toggleDocument}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-all shadow-sm"
        >
          {/* <FileRefresh className="w-3.5 h-3.5" /> */}
          Switch Document
        </button>

        {highlights.length > 0 && (
          <button
            type="button"
            onClick={resetHighlights}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}