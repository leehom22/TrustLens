import { Annotation } from "@/app/types/document-highlight-type";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, documentId, getDocs, query, where } from "firebase/firestore";
import Konva from "konva";
import { Stage } from "konva/lib/Stage";
import { toast } from "sonner";

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

export const generateAnnotatedImage = async (
  documentUrl: string,
  annotations: Annotation[],
  imageSize: {
    width: number;
    height: number;
  },
) => {
  try {
    // Create a temporary stage
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

    // Use a Promise to handle the async image loading
    const dataURL = await new Promise<string>((resolve, reject) => {
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

          if (annotation.comment) {
            const text = new Konva.Text({
              x: annotation.x,
              y: annotation.y - 25,
              text: `#${annotation.id}: ${annotation.comment}`,
              fontSize: 14,
              fontFamily: 'Arial',
              fill: '#000000',
              padding: 5,
            });

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

        // Export and resolve
        const result = tempStage.toDataURL({ pixelRatio: 2 });

        // Cleanup DOM
        document.body.removeChild(tempContainer);
        resolve(result);
      };

      imageObj.onerror = (err) => {
        document.body.removeChild(tempContainer);
        reject(err);
      };
    });

    return dataURL;

  } catch (error) {
    console.error("Error generating annotated image:", error);
    // Note: ensure 'toast' is available in your scope
    toast.error("Failed to generate annotated image. Please try again.");
    return null;
  }
};

export const downloadAnnotatedImage = async (
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
    // ✅ Await the async function
    const dataURL = await generateAnnotatedImage(
      documentUrl,
      annotations,
      imageSize
    );

    if (!dataURL) {
      throw new Error("No image generated");
    }

    // ✅ Create download link
    const link = document.createElement("a");
    link.download = `annotated-image-${documentName}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Failed to download annotated image:", error);
    alert("Failed to download annotated image. Please try again.");
  }
};
