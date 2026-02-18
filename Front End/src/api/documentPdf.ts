import { Note } from "@/app/types/document-highlight-type"
import { db } from "@/lib/firebase"
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore"
import { toast } from "react-toastify"
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const db_collection = 'pdf_highlights'

export const loadNotesFromFirestore = async (documentId: string, userId: string, setNotes: React.Dispatch<React.SetStateAction<Note[]>>, noteIdRef: React.RefObject<number>) => {
    try {
        const notesRef = collection(db, db_collection)
        const q = query(
            notesRef,
            where('documentId', '==', documentId),
            where('userId', '==', userId)
        )

        const querySnapshot = await getDocs(q)
        const loadNotes: Note[] = []

        querySnapshot.forEach((doc) => {
            const data = doc.data()
            loadNotes.push({
                id: data.id,
                content: data.content,
                highlightAreas: data.highlightAreas,
                quote: data.quote,
                firestoreId: doc.id
            })

            setNotes(loadNotes)

            if (loadNotes.length > 0) {
                const maxId = Math.max(...loadNotes.map(n => n.id))
                noteIdRef.current = maxId + 1
            }
        })
    } catch (error) {
        console.error("Error loading notes: ", error)
        toast.error("Error loading notes")
    }
}

export const saveNotesToFirestore = async (note: Note, documentId: string, userId: string) => {
    try {
        console.log("Note value to save in db: ", note)
        console.log("Note value to save in db: ", documentId, userId)
        const docRef = await addDoc(collection(db, db_collection), {
            id: note.id,
            content: note.content,
            highlightAreas: note.highlightAreas,
            quote: note.quote,
            documentId: documentId,
            userId: userId,
            createdAt: new Date().toISOString()
        })

        return docRef.id
    } catch (error) {
        console.error("Error saving note: ", error)
        throw error
    }
}


export const deleteNoteFromFirestore = async (firestoreId: string) => {
    try {
        await deleteDoc(doc(db, 'pdf_highlights', firestoreId));
    } catch (error) {
        console.error("Error deleting note:", error);
        throw error;
    }
};

export const generateAnnotatedPDF = async (documentURL: string, notes: Note[]) => {
    try {
        // Fetch the original PDF
        const existingPdfBytes = await fetch(documentURL).then(res => res.arrayBuffer());

        // Load the PDF
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Add annotations for each note
        notes.forEach((note) => {
            note.highlightAreas.forEach((area) => {
                const page = pages[area.pageIndex];
                const { height } = page.getSize();

                // Convert percentage-based coordinates to absolute values
                const x = (area.left / 100) * page.getWidth();
                const y = height - (area.top / 100) * height;
                const width = (area.width / 100) * page.getWidth();
                const highlightHeight = (area.height / 100) * height;

                // Draw yellow highlight rectangle
                page.drawRectangle({
                    x: x,
                    y: y - highlightHeight,
                    width: width,
                    height: highlightHeight,
                    color: rgb(1, 1, 0),
                    opacity: 0.3,
                });

                // Add comment text below the highlight
                if (note.content) {
                    const commentText = `Comment: ${note.content}`;
                    const textSize = 10;
                    const textWidth = font.widthOfTextAtSize(commentText, textSize);

                    // Draw white background for comment
                    page.drawRectangle({
                        x: x,
                        y: y - highlightHeight - 25,
                        width: Math.min(textWidth + 8, page.getWidth() - x),
                        height: 20,
                        color: rgb(1, 1, 0.8),
                        borderColor: rgb(0.8, 0.8, 0),
                        borderWidth: 1,
                    });

                    // Draw comment text
                    page.drawText(commentText, {
                        x: x + 4,
                        y: y - highlightHeight - 15,
                        size: textSize,
                        font: font,
                        color: rgb(0, 0, 0),
                        maxWidth: page.getWidth() - x - 8,
                    });
                }
            });
        });

        // Save the modified PDF
        const pdfBytes = await pdfDoc.save();

        return pdfBytes;
    } catch (error) {
        console.error("Failed to download annotated PDF:", error);
        alert("Failed to download annotated PDF. Please try again.");
    }
}

export const downloadAnnotatedPDF = async (documentURL: string, documentName: string, notes: Note[]) => {
    try {
        
        const pdfBytes = await generateAnnotatedPDF(documentURL, notes);

        if(!pdfBytes) {
            throw new Error("No PDF bytes generated");
        }
        // Create download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `annotated-${documentName}.pdf`;
        link.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Failed to download annotated PDF:", error);
        alert("Failed to download annotated PDF. Please try again.");
    }
};