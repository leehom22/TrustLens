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
import { deleteNoteFromFirestore, loadNotesFromFirestore, saveNotesToFirestore } from "@/api/documentPdf";

export default function DocumentVercel(props: { userId : string, documentUrl: string, documentId : string }) {
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const noteIdRef = useRef(0);
  const noteEles = useRef<Map<number, HTMLElement>>(new Map());
  const documentId = props.documentId // testing document //firestore
  const userId = props.userId // firestore 
  const documentURL = props.documentUrl

    const renderSidebarNotes = () => (
    <div style={{ padding: 8 }}>
      {notes.length === 0 && <div>No notes yet</div>}
      {notes.map((note) => (
        <div
          key={note.id}
          style={{ marginBottom: 8, cursor: "pointer", position: 'relative' }}
          className="border-b p-3 flex flex-col gap-3"
        >
          <div onClick={() => jumpToNote(note)} >
            <div className="flex gap-3">
              Quote:
              <blockquote>{note.quote}</blockquote>
            </div>
            <div className="flex gap-3 ">
              Comment: {note.content}
            </div>
          </div>
          <Button 
            onClick={() => handleDeleteNote(note)}
            style={{ marginTop: 4, fontSize: '12px', }}
          >
            Delete
          </Button>
        </div>
      ))}
    </div>
  );

  const handleDeleteNote = async (note: Note) => {
    if (note.firestoreId) {
      await deleteNoteFromFirestore(note.firestoreId);
    }
    setNotes((prev) => prev.filter(n => n.id !== note.id));
  };
  // --------------------------
  // Default layout plugin
  // --------------------------
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
      activateTab(3); // Notes tab index
      noteEles.current.get(note.id)!.scrollIntoView({ behavior: "smooth" });
    }
  };

  // --------------------------
  // Highlight target / content (optional if you want hover buttons)
  // --------------------------
  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    // Determine if highlight is in top half of page
    const isTopHalf = props.selectionRegion.top < 50;

    // Dynamically set position based on location
    const positionStyle = isTopHalf
      ? {
        // Show below when highlight is at top
        top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
        transform: "translate(0, 8px)",
      }
      : {
        // Show above when highlight is at bottom
        top: `${props.selectionRegion.top}%`,
        transform: "translate(0, -40px)",
      };

    return (
      <div
        style={{
          background: "#eee",
          display: "flex",
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          ...positionStyle, // Apply dynamic positioning
          zIndex: 999,
          borderRadius: 4,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <Tooltip
          position={isTopHalf ? Position.BottomCenter : Position.TopCenter}
          target={
            <Button onClick={props.toggle}>
              <MessageIcon />
            </Button>
          }
          content={() => <div style={{ width: "100px" }}>Add a note</div>}
          offset={{ left: 0, top: isTopHalf ? 8 : -8 }}
        />
      </div>
    );
  };

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    const addNote = async() => {
      if (!message.trim()) return;

      const newNote: Note = {
        id: noteIdRef.current++,
        content: message,
        highlightAreas: props.highlightAreas,
        quote: props.selectedText,
      };

      // Save to Firestore
      try {
        const firestoreId = await saveNotesToFirestore(newNote,documentId,userId);
        newNote.firestoreId = firestoreId;
        
        setNotes((prev) => [...prev, newNote]);
        props.cancel();
        setMessage("");
      } catch (error) {
        console.error("Failed to save note:", error);
        alert("Failed to save note. Please try again.");
      }
    };

    // Determine if highlight is in top half of page
    const isTopHalf = props.selectionRegion.top < 50;

    // Dynamically set position based on location
    const positionStyle = isTopHalf
      ? {
        // Show below when highlight is at top
        top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
        transform: "translate(0, 8px)",
      }
      : {
        // Show above when highlight is at bottom
        top: `${props.selectionRegion.top}%`,
        transform: "translate(0, calc(-100% - 8px))",
      };
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.3)",
          borderRadius: 2,
          padding: 8,
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          ...positionStyle, // Apply dynamic positioning
          zIndex: 999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <textarea
          rows={3}
          style={{ width: 200, border: "1px solid rgba(0,0,0,0.3)" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
          className="p-3 text-black"
        />
        <div style={{ display: "flex", marginTop: 8, gap:10}}>
          <PrimaryButton onClick={addNote} style={{ marginRight: 8 }}>
            Add
          </PrimaryButton>
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
            // Filter all highlights on the current page
            .filter((area) => area.pageIndex === props.pageIndex)
            .map((area, idx) => (
              <div
                key={idx}
                style={Object.assign(
                  {},
                  {
                    background: 'yellow',
                    opacity: 0.4,
                  },
                  props.getCssProperties(area, props.rotation)
                )}
              />
            ))}
        </React.Fragment>
      ))}
    </div>
  );

  useEffect(() => {
    loadNotesFromFirestore(documentId,userId,setNotes,noteIdRef);
  }, []);

  const highlightPluginInstance = highlightPlugin({ renderHighlightTarget, renderHighlightContent, renderHighlights });

  return (
    <div style={{ height: "100vh" }} className="z-1">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        <Viewer
          fileUrl={documentURL}
          plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
        />
      </Worker>
    </div>
  );
}
