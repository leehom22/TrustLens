from __future__ import annotations
 
import base64
import uuid
from typing import Optional
from fastapi import APIRouter
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter, BaseQuery
from pydantic import BaseModel

from app.models.scam_alert import AnalysisResult,ReportResponse, ReportRequest,analyze_with_gemini, create_report, report_velocity, get_report_by_phone, update_doc, get_all_reports, get_queue_item, get_doc, ADMIN_QUEUE_COL, AdminDecision, PublishedAlert, DOCS_COL, COMMENTS_COL, CommentResponse, CommentRequest, REPORTS_SUBCOL, find_duplicate, create_doc
from app.utils.scam_alert import utcnow, hash_phone, fmt_date,sha256_hex,perceptual_hash, determine_track
from app.core.config import HIGH_TRACK_REPORT_THRESHOLD, LOW_TRACK_REPORT_THRESHOLD
from app.services.scam_alert import check_publish_threshold
from app.models.files import FilesSchema
from app.core.firebase import db 

scam_alert_router = APIRouter()

# /scam-alert
structure_analysis_collection = 'structure_analysis_result'

@scam_alert_router.post("/analyze", response_model=AnalysisResult,
          summary="Step 1 — Upload document + Gemini initial analysis")
async def analyze_document(file: UploadFile = File(...)):
    """
    Receives a PDF or image upload.
    - Deduplication: if document already exists in Firestore (exact or near-duplicate),
      returns the existing analysis immediately — no wasted Gemini call.
    - New documents: Gemini analyzes, result saved to /documents/{id} with PENDING status.
 
    Firestore path: /documents/{document_id}
    """
    if not file.filename:
        raise HTTPException(400, "No file provided.")
 
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 10 MB limit.")
 
    file_sha256 = sha256_hex(raw)
    phash       = perceptual_hash(raw)
 
    # ── Deduplication check ───────────────────────────────────────────────────
    existing = find_duplicate(file_sha256, phash)
    if existing:
        return AnalysisResult(
            document_id      = existing["id"],
            document_type    = existing.get("mimeType", "Unknown"),
            threat_category  = existing.get("threat_category", "Unknown"),
            ai_confidence    = float(existing.get("ai_confidence", 0)),
            scam_indicators  = existing.get("scam_indicators", []),
            redacted_preview = existing.get("redacted_preview", ""),
            reasoning        = existing.get("gemini_reasoning", ""),
            is_suspicious    = existing.get("ai_confidence", 0) >= 50,
        )
 
    # ── Gemini analysis ───────────────────────────────────────────────────────
    try:
        analysis = await analyze_with_gemini(raw, file.filename)
    except Exception as e:
        raise HTTPException(502, f"Gemini analysis failed: {e}")
 
    # ── Persist to Firestore ──────────────────────────────────────────────────
    # file_bytes_b64: stored for downstream re-analysis background tasks.
    # In production, upload to Firebase Cloud Storage and store the GCS URI instead.
    doc_data = {
        "filename":         file.filename,
        "file_hash":        file_sha256,
        "perceptual_hash":  phash,
        "file_bytes_b64":   base64.b64encode(raw).decode(),
 
        "document_type":    analysis.get("mimeType", "Unknown"),
        "threat_category":  analysis.get("threat_category", "Unknown"),
        "ai_confidence":    float(analysis.get("ai_confidence", 0)),
        "scam_indicators":  analysis.get("scam_indicators", []),
        "redacted_preview": analysis.get("redacted_preview", ""),
        "gemini_reasoning": analysis.get("reasoning", ""),
 
        "track":            None,
        "status":           "PENDING",
        "report_count":     0,
        "avg_report_score": 0.0,
        "states_reported":  [],
        "is_national":      False,
 
        "first_flagged":    utcnow(),
        "last_seen":        utcnow(),
        "published_at":     None,
        "created_at":       utcnow(),
    }
    doc_id = create_doc(doc_data)
 
    return AnalysisResult(
        document_id      = doc_id,
        document_type    = analysis.get("mimeType", "Unknown"),
        threat_category  = analysis.get("threat_category", "Unknown"),
        ai_confidence    = float(analysis.get("ai_confidence", 0)),
        scam_indicators  = analysis.get("scam_indicators", []),
        redacted_preview = analysis.get("redacted_preview", ""),
        reasoning        = analysis.get("reasoning", ""),
        is_suspicious    = bool(analysis.get("is_suspicious", False)),
    )
 
# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — User Confirms + Report Submission
# ──────────────────────────────────────────────────────────────────────────────
 
@scam_alert_router.post("/report", response_model=ReportResponse,
          summary="Step 2 — User confirms suspicious + submits state & OTP")
async def report_document(payload: ReportRequest, background_tasks: BackgroundTasks):
    """
    User confirms the document is suspicious:
    1. One-report-per-phone guard (phone stored as SHA-256 hash only).
    2. Gemini re-analyzes the document for a fresh confidence score.
    3. Assigns HIGH or LOW track based on fresh score.
    4. Saves report to sub-collection: /documents/{id}/reports/{report_id}
    5. Background task checks if publish threshold is reached.
 
    Firestore path: /documents/{document_id}/reports/{report_id}
    """
    # find master doc using docId
    doc_ref = db.collection('upload_files').document(payload.documentId)
    doc_snapshot = doc_ref.get()
    
    if not doc_snapshot.exists:
        raise HTTPException(status_code=404, detail="Upload record not found")
    
    doc_data = doc_snapshot.to_dict()
    masterDocId = doc_data.get('master_doc_id')
    base64_key = doc_data.get('encryptedKey')
    base64_iv = doc_data.get('iv')
    
    print("fetching master_doc_id: ",masterDocId)
    
    doc = get_doc(masterDocId)
    if not doc:
        raise HTTPException(404, "Document not found.")
 
    # ── One-report-per-phone guard ────────────────────────────────────────────
    phone_hash = hash_phone(payload.phone)
    # if get_report_by_phone(masterDocId, phone_hash):
    #     raise HTTPException(409, "You have already reported this document.")
 
    # ── Gemini re-analysis ────────────────────────────────────────────────────
    try:
        fileUrl = doc.get("fileUrl")
        if fileUrl:
            fresh    = await analyze_with_gemini(fileUrl, doc.get("filename", "doc"),base64_key,base64_iv)
            # print("gemini analyzing scam document: ",fresh)
            confidence = float(fresh.get("ai_confidence", doc.get("ai_confidence", 0)))
        else:
            confidence = float(doc.get("ai_confidence", 0))
    except Exception:
        confidence = float(doc.get("ai_confidence", 0))
 
    track = determine_track(confidence)
    vel   = report_velocity(masterDocId)
 
    # ── Save report to sub-collection ────────────────────────────────────────
    report_id = create_report(masterDocId, {
        "document_id":     masterDocId,
        "user_phone_hash": phone_hash,      # PDPA compliant — no raw phone stored
        "state":           payload.state,
        "ai_confidence":   confidence,
        "report_velocity": vel,
        "reported_at":     utcnow(),
    })
 
    # Update document track + confidence
    update_doc(masterDocId, {
        "track":         track,
        "ai_confidence": confidence,
        "last_seen":     utcnow(),
    })
    
    report_count = len(get_all_reports(masterDocId))
    update_doc(masterDocId, {"report_count": report_count})
 
    # ── Async threshold check (non-blocking) ──────────────────────────────────
    background_tasks.add_task(check_publish_threshold, masterDocId,fileUrl,base64_key,base64_iv)
 
    messages = {
        "HIGH":     f"HIGH TRACK (score {confidence:.0f}%). Escalates after {HIGH_TRACK_REPORT_THRESHOLD} reports.",
        "LOW":      f"LOW TRACK (score {confidence:.0f}%). Escalates after {LOW_TRACK_REPORT_THRESHOLD} reports.",
        "REJECTED": "Score too low to track. Saved for monitoring.",
    }
 
    return ReportResponse(
        report_id        = report_id,
        masterDocId      = masterDocId,
        track            = track,
        message          = messages.get(track, "Report saved."),
        ai_confidence    = confidence,
        report_count     = report_count,
        queued_for_admin = get_queue_item(masterDocId) is not None,
    )
 
# ──────────────────────────────────────────────────────────────────────────────
# Admin — Review Queue
# ──────────────────────────────────────────────────────────────────────────────
 
@scam_alert_router.get("/admin/queue", summary="Admin — Documents pending human review")
def get_admin_queue():
    """
    Returns all undecided documents in the admin review queue.
    Firestore path: /admin_queue where decision == null
    """
    results = []
    for snap in ADMIN_QUEUE_COL.where(
        filter=FieldFilter("decision", "==", None)
    ).order_by("queued_at").stream():
        q   = snap.to_dict()
        doc = get_doc(q.get("document_id", ""))
        if doc:
            results.append({
                "queue_id":         snap.id,
                "masterDocId":      doc["id"],
                "title":            doc.get("filename"),
                "document_type":    doc.get("mimeType"),
                "fileUrl":          doc.get("fileUrl"),
                "threat_category":  doc.get("threat_category"),
                "track":            doc.get("track"),
                "ai_confidence":    doc.get("ai_confidence"),
                "avg_score":        doc.get("avg_report_score"),
                "report_count":     doc.get("report_count"),
                "states":           doc.get("states_reported", []),
                "is_national":      doc.get("is_national", False),
                "queued_at":        q.get("queued_at"),
                "notes":            q.get("notes"),
                "scam_indicators":  doc.get("scam_indicators", []),
                "redacted_preview": doc.get("redacted_preview"),
                "reasoning":        doc.get("gemini_reasoning"),
                "status":           doc.get("status")
            })
    return {"queue": results, "total": len(results),"success":True}
 
@scam_alert_router.post("/get-doc-analysis")
async def get_document_analysis(docId: str = Form(...), adminQId: str= Form(...)):
    try:
        # Get the ai_analysis_id from the masterDocuments
        doc_ref = DOCS_COL.document(docId)
        doc_snapshot = doc_ref.get()
        
        if not doc_ref:
            raise HTTPException(status_code=404, detail="Upload record not found")

        doc_data = doc_snapshot.to_dict()
        
        # Get the structure_ai_analysis using the ai_analysis_id
        ai_analysis_id = doc_data.get("ai_analysis_id")
        
        # 1. Correctly define the query
        query = db.collection(structure_analysis_collection).where("raw_analysis_id", "==", ai_analysis_id)
        
        # 2. Execute the query to get a list of snapshots
        docs = query.get()
        
        # 3. Check if any documents were found
        if docs and len(docs) > 0:
            # Get the first document found
            doc_snap = docs[0]
            doc_data = doc_snap.to_dict()
            
            # 4. Correctly attach the document ID to the data
            doc_data['id'] = doc_snap.id
            
            return {"success": True, "data": doc_data}
        
        # Handle case where no document matches the ID
        return {"success": False, "message": "Document not found"}
        
    except Exception as e:
        # Use a logger in production instead of print
        print(f"Error occurred while fetching document analysis: {e}")
        return {"success": False, "error": str(e)}
    
 
@scam_alert_router.get("/get_selected_files/{doc_id}")
def get_selected_files(doc_id:str):
    try:
        # received docId = masterDocId
        # Need to fetch the latest updated doc
        query = (
            db.collection("upload_files")
            .where(filter=FieldFilter("master_doc_id", "==", doc_id)) # Filter by ID
            .order_by("created_at", direction=BaseQuery.DESCENDING)      # Sort newest first
            .limit(1)                                               # Take only the top one
        )
        
        # 2. Execute the query
        docs = list(query.stream())
        
        # 3. Return the result safely
        if docs:
            latest_doc = docs[0]
            res = FilesSchema.get_selected_file(latest_doc.id)
            return {
                    "data":res,
                    "success":True
                }
        
        raise HTTPException(status_code=404, detail="Upload record not found")
    
    except Exception as e:
        print(f"Error fetch selected_file: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch selected data from database"
        )
 
@scam_alert_router.post("/admin/decide", summary="Admin — Approve or reject a queued document")
def admin_decide(payload: AdminDecision):
    """
    APPROVED → document.status = PUBLISHED → visible on public alert feed.
    REJECTED → document.status = REJECTED  → removed from public view.
    """
    if payload.decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(400, "Decision must be APPROVED or REJECTED.")
 
    queue_item = get_queue_item(payload.document_id)
    if not queue_item:
        raise HTTPException(404, "Document not in admin queue.")
 
    doc = get_doc(payload.document_id)
    if not doc:
        raise HTTPException(404, "Document record not found.")
 
    ADMIN_QUEUE_COL.document(queue_item["id"]).update({
        "decision":    payload.decision,
        "reviewer":    payload.reviewer,
        "reviewed_at": utcnow(),
        "notes":       payload.notes or queue_item.get("notes", ""),
    })
 
    if payload.decision == "APPROVED":
        update_doc(payload.document_id, {"status": "PUBLISHED", "published_at": utcnow()})
        msg = f"✅ Published. National alert: {doc.get('is_national', False)}"
    else:
        update_doc(payload.document_id, {"status": "REJECTED"})
        msg = "❌ Rejected — will not be published."
 
    return {"message": msg, "document_id": payload.document_id, "decision": payload.decision}
 
# ──────────────────────────────────────────────────────────────────────────────
# Public — Scam Alert Feed
# ──────────────────────────────────────────────────────────────────────────────
 
class AlertResponse(BaseModel):
    data: list[PublishedAlert]
    success: bool
    
@scam_alert_router.get("/alerts", response_model=AlertResponse,
         summary="Public — Published scam alerts (filterable)")
def get_alerts(
    state:           Optional[str]  = None,
    document_type:   Optional[str]  = None,
    threat_category: Optional[str]  = None,
    is_national:     Optional[bool] = None,
):
    """
    Powers the public Scam Alert page.
    Firestore notes:
    - array_contains filter used for state (Firestore native array membership).
    - Compound queries (array_contains + equality + order_by) require composite
      indexes — Firebase Console will prompt you to create them on first query.
 
    Firestore path: /documents where status == "PUBLISHED"
    """
    query = DOCS_COL.where(filter=FieldFilter("status", "==", "PUBLISHED"))
    riskLevel = "LOW"
    if state:
        query = query.where(filter=FieldFilter("states_reported", "array_contains", state))
    if document_type:
        query = query.where(filter=FieldFilter("mimeType", "==", document_type))
    if threat_category:
        query = query.where(filter=FieldFilter("threat_category", "==", threat_category))
    if is_national is not None:
        query = query.where(filter=FieldFilter("is_national", "==", is_national))
    
    alerts = []
    for snap in query.order_by("published_at", direction=firestore.Query.DESCENDING).stream():
        d = snap.to_dict()
        # Determine Risk Level based on Average Report Score
        avg_score = float(d.get("avg_report_score", 0))
        
        if avg_score >= 90:
            riskLevel = "CRITICAL"
        elif avg_score >= 70:
            riskLevel = "HIGH"
        elif avg_score >= 40:
            riskLevel = "CAUTION"
        else:
            riskLevel = "LOW"
            
        alerts.append(PublishedAlert(
            id               = snap.id,
            title            = d.get("filename", ""),
            documentType    = d.get("document_type", "Unknown"),
            threatCategory  = d.get("threat_category", "Unknown"),
            aiConfidence    = float(d.get("ai_confidence", 0)),
            reportCount     = int(d.get("report_count", 0)),
            avg_report_score = float(d.get("avg_report_score", 0)),
            state  = d.get("states_reported", []),
            scamIndicators  = d.get("scam_indicators", []),
            redactedPreview = d.get("redacted_preview", ""),
            is_national      = bool(d.get("is_national", False)),
            firstFlagged    = fmt_date(d.get("first_flagged")),
            lastSeen        = fmt_date(d.get("last_seen")),
            published_at     = fmt_date(d.get("published_at")),
            riskLevel = riskLevel
        ))
    return {"data":alerts,"success":True}
 
# ──────────────────────────────────────────────────────────────────────────────
# Comments — Community Reports on Alerts
# ──────────────────────────────────────────────────────────────────────────────
 
@scam_alert_router.post("/{document_id}/comments", response_model=CommentResponse,
          summary="Public — Add community comment to a published alert")
def add_comment(document_id: str, payload: CommentRequest):
    doc = get_doc(document_id)
    if not doc or doc.get("status") != "PUBLISHED":
        raise HTTPException(404, "Published alert not found.")
 
    cid  = str(uuid.uuid4())
    now  = utcnow()
    data = {
        "document_id": document_id,
        "user_id":   payload.user_id,
        "user_name": payload.user_name,
        "text":        payload.text,
        "created_at":  now,
        "helpful":     0,
    }
    COMMENTS_COL.document(cid).set(data)
 
    return CommentResponse(
        comment_id  = cid,
        document_id = document_id,
        user_id   = payload.user_id,
        user_name= payload.user_name,
        text        = payload.text,
        created_at  = fmt_date(now),
        helpful     = 0,
    )
 
 
@scam_alert_router.get("/{document_id}/comments", response_model=list[CommentResponse],
         summary="Public — Get all comments for an alert")
def get_comments(document_id: str):
    """Firestore path: /comments where document_id == {document_id}"""
    results = []
    for snap in COMMENTS_COL.where(
        filter=FieldFilter("document_id", "==", document_id)
    ).order_by("created_at", direction=firestore.Query.DESCENDING).stream():
        d = snap.to_dict()
        results.append(CommentResponse(
            comment_id  = snap.id,
            document_id = document_id,
            user_id   = d.get("user_id", 0),
            user_name=d.get("user_name","Anonymous"),
            text        = d.get("text", ""),
            created_at  = fmt_date(d.get("created_at")),
            helpful     = int(d.get("helpful", 0)),
        ))
    return results
 
 
@scam_alert_router.post("/comments/{comment_id}/helpful",
          summary="Public — Upvote a comment as helpful")
def mark_helpful(comment_id: str):
    """Uses Firestore atomic Increment — safe for concurrent upvotes."""
    ref  = COMMENTS_COL.document(comment_id)
    if not ref.get().exists:
        raise HTTPException(404, "Comment not found.")
    ref.update({"helpful": firestore.Increment(1)})
    return {"message": "Marked as helpful.", "comment_id": comment_id}
 
# ──────────────────────────────────────────────────────────────────────────────
# Dispute
# ──────────────────────────────────────────────────────────────────────────────
 
@scam_alert_router.post("/{document_id}/dispute",
          summary="Public — Dispute a published alert (PDPA compliance)")
async def dispute_alert(
    document_id:   str,
    reason:        str        = Form(...),
    evidence_file: UploadFile = File(None),
):
    """
    Anyone can dispute a published alert.
    Moves document back to REVIEW status and creates a new admin queue entry.
    Evidence file should go to Firebase Cloud Storage in production.
    """
    doc = get_doc(document_id)
    if not doc or doc.get("status") != "PUBLISHED":
        raise HTTPException(404, "Published alert not found.")
 
    update_doc(document_id, {"status": "REVIEW"})
    ADMIN_QUEUE_COL.document(str(uuid.uuid4())).set({
        "document_id": document_id,
        "queued_at":   utcnow(),
        "reviewed_at": None,
        "reviewer":    None,
        "decision":    None,
        "notes":       f"DISPUTE: {reason}",
    })
 
    return {
        "message":     "Dispute received. Alert flagged for admin review.",
        "document_id": document_id,
    }
 
# ──────────────────────────────────────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────────────────────────────────────
 
@scam_alert_router.get("/stats", summary="Dashboard — Aggregated statistics")
def get_stats():
    """
    Note: Firestore has no native COUNT().
    At production scale, maintain denormalized counter documents updated by
    Cloud Functions (Firestore triggers) rather than scanning entire collections.
    This implementation is fine for hackathon / demo scale.
    """
    def count(field: str, val) -> int:
        return sum(1 for _ in DOCS_COL.where(filter=FieldFilter(field, "==", val)).stream())
 
    all_docs     = list(DOCS_COL.stream())
    total_reports = sum(
        sum(1 for _ in DOCS_COL.document(d.id).collection(REPORTS_SUBCOL).stream())
        for d in all_docs
    )
 
    return {
        "total_documents_analyzed": len(all_docs),
        "published_alerts":         count("status", "PUBLISHED"),
        "pending_review":           count("status", "REVIEW"),
        "high_track_documents":     count("track", "HIGH"),
        "low_track_documents":      count("track", "LOW"),
        "national_alerts":          count("is_national", True),
        "total_user_reports":       total_reports,
    }