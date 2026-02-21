from fastapi import APIRouter, status, HTTPException
from app.core.firebase import db
from app.models.annotate import LoadAnnotationsRequest, SaveAnnotationRequest, DeleteAnnotationRequest, LoadNotesRequest
from datetime import datetime
annotate_router = APIRouter()

image_annotation_collection = 'image_annotations'
pdf_annotation_collection = 'pdf_highlights'

@annotate_router.post("/load-image-annotation", status_code=status.HTTP_201_CREATED)
async def load_annotations(request: LoadAnnotationsRequest):

    try:
        annotations_ref = db.collection(image_annotation_collection)

        query = (
            annotations_ref
            .where("documentId", "==", request.documentId)
            .where("userId", "==", request.userId)
        )

        docs = query.stream()

        annotations = []

        for doc in docs:
            data = doc.to_dict()

            annotations.append({
                "id": data.get("id"),
                "type": "rectangle",
                "x": data.get("x"),
                "y": data.get("y"),
                "width": data.get("width"),
                "height": data.get("height"),
                "color": data.get("color"),
                "comment": data.get("comment"),
                "firestoreId": doc.id,
            })

        return {
            "success": True,
            "annotations": annotations
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading annotations: {str(e)}"
        )

@annotate_router.post("/save-image-annotation", status_code=status.HTTP_201_CREATED)
async def save_annotation_to_firestore(request: SaveAnnotationRequest):

    try:
        doc_ref = db.collection(image_annotation_collection).add({
            "id": request.annotation.id,
            "type": request.annotation.type,
            "x": request.annotation.x,
            "y": request.annotation.y,
            "width": request.annotation.width,
            "height": request.annotation.height,
            "color": request.annotation.color,
            "comment": request.annotation.comment,
            "documentId": request.documentId,
            "userId": request.userId,
            "createdAt": datetime.utcnow().isoformat(),
        })

        # Firestore Python add() returns (update_time, reference)
        firestore_id = doc_ref[1].id

        return {
            "success": True,
            "firestoreId": firestore_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error saving annotation: {str(e)}"
        )
        
@annotate_router.post("/delete-image-annotation", status_code=status.HTTP_200_OK)
async def delete_annotation_from_firestore(request: DeleteAnnotationRequest):

    try:
        doc_ref = db.collection(image_annotation_collection).document(request.firestoreId)
        doc_ref.delete()

        return {
            "success": True,
            "message": "Annotation deleted successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting annotation: {str(e)}"
        )
        
@annotate_router.post("/load-pdf-notes", status_code=status.HTTP_201_CREATED)
async def load_notes_from_firestore(request: LoadNotesRequest):

    try:
        notes_ref = db.collection(pdf_annotation_collection)

        query = (
            notes_ref
            .where("documentId", "==", request.documentId)
            .where("userId", "==", request.userId)
        )

        docs = query.stream()

        loaded_notes = []

        for doc in docs:
            data = doc.to_dict()

            loaded_notes.append({
                "id": data.get("id"),
                "content": data.get("content"),
                "highlightAreas": data.get("highlightAreas"),
                "quote": data.get("quote"),
                "firestoreId": doc.id
            })

        return {
            "success": True,
            "notes": loaded_notes
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading notes: {str(e)}"
        )

@annotate_router.post("/save-pdf-note", status_code=status.HTTP_201_CREATED)
async def saveNotesToFirestore(note: dict, documentId: str, userId: str):
    try:
        print("Note value to save in db:", note)
        print("Document + User:", documentId, userId)

        doc_ref = db.collection(pdf_annotation_collection).add({
            "id": note.get("id"),
            "content": note.get("content"),
            "highlightAreas": note.get("highlightAreas"),
            "quote": note.get("quote"),
            "documentId": documentId,
            "userId": userId,
            "createdAt": datetime.utcnow().isoformat()
        })

        return {
            "success": True,
            "firestoreId": doc_ref[1].id
        }

    except Exception as error:
        print("Error saving note:", error)
        raise HTTPException(status_code=500, detail="Error saving note")
    
@annotate_router.delete("/delete-pdf-note/{firestoreId}", status_code=status.HTTP_200_OK)
async def deleteNoteFromFirestore(firestoreId: str):
    try:
        doc_ref = db.collection(pdf_annotation_collection).document(firestoreId)

        # Check if document exists (optional but safer)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Note not found")

        doc_ref.delete()

        return {
            "success": True,
            "message": "Note deleted successfully"
        }

    except Exception as error:
        print("Error deleting note:", error)
        raise HTTPException(status_code=500, detail="Error deleting note")