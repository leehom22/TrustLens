import { db } from "@/lib/firebase"
import axios from "axios"
import { doc, setDoc, updateDoc } from "firebase/firestore"
import { toast } from "sonner"

const db_collection = 'upload_files'
const backendUrl = import.meta.env.VITE_BACKEND_URL
export const setFileAsFlagged = async (documentId: string, flaggedReason: string) => {
  try {
    const documentRef = doc(db, db_collection, documentId)

    await setDoc(documentRef, {
      flagged: true, // Need to be processed by Python, need to use True/False
      flaggedReason: flaggedReason,
      expertReview: false,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    return { "success": true }
  } catch (error) {
    console.log("Error flagging a document: ", error)
    return { "success": false }
  }
}

export const handlePdfDownload = async (docId: string, analysisId: string, docName: string, role: string) => {
  try {

    //! role value only has two options: 'expert' or 'user'
    if (role !== 'expert' && role !== 'user') {
      toast.error("Invalid role for PDF download.");
      return;
    }
    const formData = new FormData();
    formData.append("doc_id", docId);
    formData.append("analysis_id", analysisId);
    formData.append("doc_name", docName);
    formData.append("role", role);

    const res = await axios.post(
      `${backendUrl}/analysis/download-analysis-report`,
      formData,
      { responseType: "blob" }   
    );

    // 1. Check if the backend actually sent JSON instead of a PDF
    if (res.data.type === "application/json") {
      // Convert the Blob back to text, then parse the JSON
      const text = await res.data.text();
      const result = JSON.parse(text);
      
      toast.error(result.message || "Error generating PDF");
      console.log("Error generating PDF:", result);
      return; // Stop here, do not download!
    }
    
    // 2. If it is a PDF, proceed with the download
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docName}_analysis.pdf`;

    document.body.appendChild(link);
    link.click();
    
    // 3. Clean up the DOM and Memory
    link.remove();
    window.URL.revokeObjectURL(url); 

  } catch (error) {
    console.log("Error downloading PDF:", error);
    toast.error("Network error while downloading PDF.");
  }
};