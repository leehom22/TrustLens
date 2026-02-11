import { Annotation } from "@/app/types/document-highlight-type";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, documentId, getDocs, query, where } from "firebase/firestore";

const db_collection = 'image_annotations';

// Load annotations from Firestore
export const loadAnnotationsFromFirestore = async (
    documentId: string,
    userId: string,
    setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
    annotationIdRef: React.RefObject<number>
) => {
    try {
        const annotationsRef = collection(db, db_collection);
        const q = query(
            annotationsRef,
            where('documentId', '==', documentId),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const loadedAnnotations: Annotation[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            loadedAnnotations.push({
                id: data.id,
                type: 'rectangle',
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
                color: data.color,
                comment: data.comment,
                firestoreId: doc.id,
            });
        });

        setAnnotations(loadedAnnotations);

        if (loadedAnnotations.length > 0) {
            const maxId = Math.max(...loadedAnnotations.map((a) => a.id));
            annotationIdRef.current = maxId + 1;
        }
    } catch (error) {
        console.error('Error loading annotations:', error);
    }
};

// Save annotation to Firestore
export const saveAnnotationToFirestore = async (
    documentId: string,
    userId: string,
    annotation: Annotation
) => {
    try {
        const docRef = await addDoc(collection(db, db_collection), {
            id: annotation.id,
            type: annotation.type,
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
            color: annotation.color,
            comment: annotation.comment,
            documentId: documentId,
            userId: userId,
            createdAt: new Date().toISOString(),
        });

        return docRef.id;
    } catch (error) {
        console.error('Error saving annotation:', error);
        throw error;
    }
};

// Delete annotation from Firestore
export const deleteAnnotationFromFirestore = async (firestoreId: string) => {
    try {
        await deleteDoc(doc(db, db_collection, firestoreId));
    } catch (error) {
        console.error('Error deleting annotation:', error);
        throw error;
    }
};