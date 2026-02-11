import { Note } from "@/app/types/document-highlight-type"
import { db } from "@/lib/firebase"
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore"
import { toast } from "react-toastify"

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
          id:data.id,
          content: data.content,
          highlightAreas: data.highlightAreas,
          quote: data.quote,
          firestoreId: doc.id
        })

        setNotes(loadNotes)

        if(loadNotes.length > 0) {
          const maxId = Math.max(...loadNotes.map(n => n.id))
          noteIdRef.current = maxId + 1
        }
      })
    } catch (error) {
      console.error("Error loading notes: ",error)
      toast.error("Error loading notes")
    }
  }

  export const saveNotesToFirestore = async (note: Note, documentId: string, userId: string) => {
      try {
        console.log("Note value to save in db: ",note)
        console.log("Note value to save in db: ",documentId, userId)
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
        console.error("Error saving note: ",error)
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