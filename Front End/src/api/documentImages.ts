import { Annotation } from "@/app/types/document-highlight-type";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, documentId, getDocs, query, where } from "firebase/firestore";
import Konva from "konva";
import { Stage } from "konva/lib/Stage";

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

export const downloadAnnotatedImage = (
    stageRef: React.RefObject<Stage | null>, 
    imageSize: {
    width: number;
    height: number;
},
    documentUrl: string,
    annotations: Annotation[],
    documentName: string
) => {
  const stage = stageRef.current;
  if (!stage) return;

  try {
    // Create a temporary stage with both image and annotations
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    const tempStage = new Konva.Stage({
      container: tempContainer,
      width: imageSize.width,
      height: imageSize.height,
    });

    const layer = new Konva.Layer();
    tempStage.add(layer);

    // Add the background image
    const imageObj = new window.Image();
    imageObj.crossOrigin = 'anonymous';
    imageObj.src = documentUrl;

    imageObj.onload = () => {
      const konvaImage = new Konva.Image({
        x: 0,
        y: 0,
        image: imageObj,
        width: imageSize.width,
        height: imageSize.height,
      });
      layer.add(konvaImage);

      // Add all annotations
      annotations.forEach((annotation) => {
        const rect = new Konva.Rect({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          stroke: '#ef4444',
          strokeWidth: 2,
          fill: 'rgba(255, 0, 0, 0.2)',
        });
        layer.add(rect);

        // Add comment text
        if (annotation.comment) {
          const text = new Konva.Text({
            x: annotation.x,
            y: annotation.y - 25,
            text: `#${annotation.id}: ${annotation.comment}`,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#000000',
            padding: 5,
            background: '#ffffff',
          });

          // Add background for text
          const textBackground = new Konva.Rect({
            x: annotation.x,
            y: annotation.y - 25,
            width: text.width(),
            height: text.height(),
            fill: '#ffff00',
            opacity: 0.8,
          });

          layer.add(textBackground);
          layer.add(text);
        }
      });

      layer.batchDraw();

      // Export as image
      const dataURL = tempStage.toDataURL({ pixelRatio: 2 });

      // Create download link
      const link = document.createElement('a');
      link.download = `annotated-image-${documentName}.png`;
      link.href = dataURL;
      link.click();

      // Cleanup
      tempStage.destroy();
      document.body.removeChild(tempContainer);
    };

    imageObj.onerror = () => {
      console.error('Failed to load image for download');
      alert('Failed to download annotated image. Please try again.');
      document.body.removeChild(tempContainer);
    };
  } catch (error) {
    console.error('Failed to download annotated image:', error);
    alert('Failed to download annotated image. Please try again.');
  }
};