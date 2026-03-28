import { Annotation, Note } from "@/app/types/document-highlight-type"
import axios from "axios"
import { generateAnnotatedPDF } from "./documentPdf"
import { generateAnnotatedImage } from "./documentImages"
import { toast } from "react-toastify"
import { SpamReviewInterface } from "@/app/types/type"

const backendUrl = import.meta.env.VITE_BACKEND_URL

export const setFileAsFlagged = async (
  documentId: string,
  flaggedReason: string
) => {
  try {
    const res = await axios.post(
      `${backendUrl}/files/set_flag_document`,
      {
        documentId,
        flaggedReason,
      }
    );

    return res.data;

  } catch (error) {
    console.error("Error flagging document:", error);
    return { success: false };
  }
};

export const generatePdfReport = async (docId: string, analysisId: string, docName: string, role: string) => {
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
    return res; // Return the blob response for PDF download
  } catch (error) {
    console.log("Error generating PDF:", error);
    toast.error("Network error while generating PDF.");
  }

}

export const handlePdfDownload = async (docId: string, analysisId: string, docName: string, role: string) => {
  try {

    const res = await generatePdfReport(docId, analysisId, docName, role);

    // 2. If it is a PDF, proceed with the download
    const url = window.URL.createObjectURL(res?.data);
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

// TODO: Seding email to user about the review: Document review pdf + annotated imgaes/document + Expert's comments 
export const sendReviewEmailToUser = async (
  userEmail: string,
  docName: string,
  docId: string,
  analysisId: string,
  role: string,
  documentURL: string,
  notesType: 'pdf' | 'image',
  imageWidth?: number,
  imageHeight?: number,
  notes?: Note[],
  annotations?: Annotation[],
) => {
  try {
    console.log("The height and the width of the image is: ",imageHeight, imageWidth)
    const formData = new FormData();
    const res = await generatePdfReport(docId, analysisId, docName, role);
    let annotatedPdfBytes = null
    let dataURL = null //Images
    if (res) {
      if (notesType === 'pdf' && notes) {
        // Get the annotate images/document
        annotatedPdfBytes = await generateAnnotatedPDF(documentURL, notes!);
        if (!annotatedPdfBytes) {
          throw new Error("No annotated PDF bytes generated");
        }
        console.log("Generating annotated pdf")
        formData.append("annotated_pdf", new Blob([annotatedPdfBytes], { type: "application/pdf" }), `annotated-${docName}.pdf`);

      } else if (notesType === 'image' && annotations && imageHeight && imageWidth) {
        dataURL = await generateAnnotatedImage(documentURL, annotations, { width: imageWidth, height: imageHeight });
        console.log("Generating annotated image")
        if (!dataURL) {
          throw new Error("No annotated PDF bytes generated");
        }
        const resFetch = await fetch(dataURL);
        const imageBlob = await resFetch.blob();

        formData.append(
          "annotated_image",
          imageBlob,
          `annotated-${docName}.png`
        );
      }

      // Sending to email via backend API
      formData.append("email", userEmail);
      formData.append("doc_name", docName);
      formData.append("pdf_report", new Blob([res.data], { type: "application/pdf" }), `${docName}_review.pdf`);

      const emailRes = await axios.post(
        `${backendUrl}/email/send-review-report-to-user`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (emailRes.data.success) {
        // toast.success("Review email sent to user successfully.");
        return { success: true };
      } else {
        // toast.error("Error sending review email to user.");
        console.log("Error response from email API:", emailRes.data);
        return { success: false };
      }
    }
  } catch (error) {
    console.log("Error sending review email:", error);
    // toast.error("Error sending review email to user.");
    return { success: false };
  }
}

export const handleConfirmReview = async (documentId: string, flaggedReason: string, setRequestReview: React.Dispatch<React.SetStateAction<boolean>>) => {
    try {
      const res = await setFileAsFlagged(documentId, flaggedReason)

      if (res.success) {
        toast.success("Successfully request for review")
        setRequestReview(false)
      } else {
        toast.error("Failed to request for review. Please try again later")
      }
    } catch (error) {
      console.log("Error request for a review: ", error)
    }
  }

export const handleConfirmSpam = async (confirmSpamReview:SpamReviewInterface,setConfirmSpam:(value: React.SetStateAction<boolean>) => void, documentId: string) => {
    try {
      const {state,phone,comment} = confirmSpamReview
      if(state === null){
        return toast.warn("Please select your current state")
      }
      console.log("spam review: ",confirmSpamReview)
      // docId, phone, state
      const response = await axios.post(`${backendUrl}/scam-alert/report`,{
        documentId,phone,comment,state
      })
      const result = response.data 
      console.log("spam report response: ",result)
      if(result.report_id){
        toast.success("Successfully report as spam")
        setConfirmSpam(false)
        return true 
      } else {
        toast.error("Failed to request for review. Please try again later")
        return false
      }
    } catch (error) {
      console.log("Error report document as spam: ", error)
      return false
    }
  }