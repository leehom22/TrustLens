import { db } from "@/lib/firebase"
import { doc, setDoc, updateDoc } from "firebase/firestore"

const db_collection = 'upload_files'
export const setFileAsFlagged = async (documentId: string, flaggedReason:string) => {
    try {
      const documentRef = doc(db,db_collection,documentId)

      await setDoc(documentRef, {
        flagged: true, // Need to be processed by Python, need to use True/False
        flaggedReason: flaggedReason,
        expertReview: false, 
        updatedAt: new Date().toISOString()
      }, {merge:true})
      
      return {"success" : true}
    } catch (error) {
        console.log("Error flagging a document: ",error)
        return {"success": false}
    }
}