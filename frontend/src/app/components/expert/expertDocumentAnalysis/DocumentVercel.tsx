import React, { useEffect, useRef, useState } from "react";
import { PrimaryButton, Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin, SidebarTab } from "@react-pdf-viewer/default-layout";
import {
  highlightPlugin,
  RenderHighlightTargetProps,
  RenderHighlightContentProps,
  RenderHighlightsProps,
  MessageIcon,
} from "@react-pdf-viewer/highlight";
import { Button, Position, Tooltip } from '@react-pdf-viewer/core';
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";
import { Note } from "@/app/types/document-highlight-type";
import { deleteNoteFromFirestore, downloadAnnotatedPDF, loadNotesFromFirestore, saveNotesToFirestore } from "@/api/documentPdf";

export default function DocumentVercel(props: {
  userId: string;
  documentUrl: string;
  documentId: string;
  documentName: string;
  setDownloadNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}) {
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const noteIdRef = useRef(0);
  const noteEles = useRef<Map<number, HTMLElement>>(new Map());
  const documentId = props.documentId;
  const userId = props.userId;
  const documentURL = props.documentUrl;
  const documentName = props.documentName;

  const renderSidebarNotes = () => (
    <div className="p-2 flex flex-col gap-2">
      <Button
        onClick={() => downloadAnnotatedPDF(documentURL, documentName, notes)}
        className="w-full mb-2 text-sm"
      >
        Download Annotated PDF
      </Button>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500 px-1">No notes yet</p>
      ) : (
        notes.map((note) => (
          <div
            key={note.id}
            className="border-b p-3 flex flex-col gap-2 cursor-pointer"
          >
            <div onClick={() => jumpToNote(note)} className="flex flex-col gap-1.5">
              <div className="flex gap-2 text-sm">
                <span className="font-medium flex-shrink-0">Quote:</span>
                <blockquote className="text-gray-600 dark:text-slate-400 italic truncate">
                  {note.quote}
                </blockquote>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-medium flex-shrink-0">Comment:</span>
                <span className="text-gray-700 dark:text-slate-300 break-words">{note.content}</span>
              </div>
            </div>
            <Button
              onClick={() => handleDeleteNote(note)}
              className="text-xs self-end"
            >
              Delete
            </Button>
          </div>
        ))
      )}
    </div>
  );

  const handleDeleteNote = async (note: Note) => {
    if (note.firestoreId) {
      await deleteNoteFromFirestore(note.firestoreId);
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  };

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs: SidebarTab[]) =>
      defaultTabs.concat({
        content: renderSidebarNotes(),
        icon: <MessageIcon />,
        title: "Notes",
      }),
  });

  const { activateTab } = defaultLayoutPluginInstance;

  const jumpToNote = (note: Note) => {
    if (note.highlightAreas.length > 0 && noteEles.current.has(note.id)) {
      activateTab(3);
      noteEles.current.get(note.id)!.scrollIntoView({ behavior: "smooth" });
    }
  };

  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    const isTopHalf = props.selectionRegion.top < 50;
    const positionStyle = isTopHalf
      ? { top: `${props.selectionRegion.top + props.selectionRegion.height}%`, transform: "translate(0, 8px)" }
      : { top: `${props.selectionRegion.top}%`, transform: "translate(0, -40px)" };

    return (
      <div
        style={{
          background: "#eee",
          display: "flex",
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          ...positionStyle,
          zIndex: 999,
          borderRadius: 4,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <Tooltip
          position={isTopHalf ? Position.BottomCenter : Position.TopCenter}
          target={<Button onClick={props.toggle}><MessageIcon /></Button>}
          content={() => <div style={{ width: "100px" }}>Add a note</div>}
          offset={{ left: 0, top: isTopHalf ? 8 : -8 }}
        />
      </div>
    );
  };

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    const addNote = async () => {
      if (!message.trim()) return;
      const newNote: Note = {
        id: noteIdRef.current++,
        content: message,
        highlightAreas: props.highlightAreas,
        quote: props.selectedText,
      };
      try {
        const firestoreId = await saveNotesToFirestore(newNote, documentId, userId);
        newNote.firestoreId = firestoreId;
        setNotes((prev) => [...prev, newNote]);
        props.cancel();
        setMessage("");
      } catch (error) {
        console.error("Failed to save note:", error);
        alert("Failed to save note. Please try again.");
      }
    };

    const isTopHalf = props.selectionRegion.top < 50;
    const positionStyle = isTopHalf
      ? { top: `${props.selectionRegion.top + props.selectionRegion.height}%`, transform: "translate(0, 8px)" }
      : { top: `${props.selectionRegion.top}%`, transform: "translate(0, calc(-100% - 8px))" };

    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.3)",
          borderRadius: 2,
          padding: 8,
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          ...positionStyle,
          zIndex: 999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          /* Clamp width so it doesn't overflow on small screens */
          width: "min(220px, 80vw)",
        }}
      >
        <textarea
          rows={3}
          style={{ width: "100%", border: "1px solid rgba(0,0,0,0.3)" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
          className="p-2 text-black text-sm rounded"
        />
        <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
          <PrimaryButton onClick={addNote}>Add</PrimaryButton>
          <Button onClick={props.cancel}>Cancel</Button>
        </div>
      </div>
    );
  };

  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
      {notes.map((note) => (
        <React.Fragment key={note.id}>
          {note.highlightAreas
            .filter((area) => area.pageIndex === props.pageIndex)
            .map((area, idx) => (
              <div
                key={idx}
                style={Object.assign(
                  {},
                  { background: "yellow", opacity: 0.4 },
                  props.getCssProperties(area, props.rotation)
                )}
              />
            ))}
        </React.Fragment>
      ))}
    </div>
  );

  useEffect(() => {
    loadNotesFromFirestore(documentId, userId, setNotes, noteIdRef);
  }, []);

  useEffect(() => {
    props.setDownloadNotes(notes);
  }, [notes]);

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights,
  });

  return (
    /* 
      Height strategy:
      - Mobile:  calc(100vh - 120px)  — leaves room for header + tabs
      - sm+:     calc(100vh - 80px)
      - lg+:     100vh (full height, sits in its own scrollable column)
    */
    <div
      className="z-[1] h-[calc(100vh-120px)] sm:h-[calc(100vh-80px)] lg:h-screen"
    >
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        <Viewer
          fileUrl={documentURL}
          plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
        />
      </Worker>
    </div>
  );
}
