from datetime import datetime
import base64
from ..core.config import HIGH_TRACK_AVG_SCORE, HIGH_TRACK_INITIAL_SCORE, HIGH_TRACK_REANALYSIS_SCORE, NATIONAL_ALERT_STATE_COUNT, HIGH_TRACK_REPORT_THRESHOLD, LOW_TRACK_AVG_SCORE, LOW_TRACK_REANALYSIS_SCORE, LOW_TRACK_REPORT_THRESHOLD
from app.models.scam_alert import analyze_with_gemini, get_doc, get_all_reports, weighted_avg_score, update_doc, enqueue_for_admin, report_velocity
from app.utils.scam_alert import utcnow
from app.core.config import VELOCITY_SPIKE_THRESHOLD

async def check_publish_threshold(doc_id: str, fileUrl: str, base64_key: str,base64_iv: str):
    """
    Runs after every new report (non-blocking background task).
    Evaluates whether the document has crossed the publish threshold:
      HIGH TRACK: ≥10 reports  AND fresh_score ≥ 90  AND avg_score ≥ 95
      LOW  TRACK: ≥50 reports  AND fresh_score ≥ 80  AND avg_score ≥ 85
    If yes → escalate to admin review queue.
    Velocity spike → hold immediately regardless of scores.
    """
    doc = get_doc(doc_id)
    if not doc:
        return
 
    reports      = get_all_reports(doc_id)
    report_count = len(reports)
    states       = list({r.get("state", "") for r in reports if r.get("state")})
    avg_score    = weighted_avg_score(reports)
    is_national  = len(states) >= NATIONAL_ALERT_STATE_COUNT
 
    update_doc(doc_id, {
        "report_count":     report_count,
        "avg_report_score": avg_score,
        "states_reported":  states,
        "is_national":      is_national,
        "last_seen":        utcnow(),
    })
 
    # ── Velocity spike guard ──────────────────────────────────────────────────
    vel = report_velocity(doc_id)
    if vel > VELOCITY_SPIKE_THRESHOLD:
        enqueue_for_admin(
            doc_id,
            note=f"⚠ Velocity spike: {vel:.0f} reports/hr — hold for manipulation review.",
        )
        return
 
    # ── Re-analyze with Gemini ────────────────────────────────────────────────
    async def fresh_score() -> float:
        if fileUrl:
            result = await analyze_with_gemini(fileUrl, doc.get("filename", "doc"),base64_key,base64_iv)
            return float(result.get("ai_confidence", doc.get("ai_confidence", 0)))
        return float(doc.get("ai_confidence", 0))
 
    track = doc.get("track", "REJECTED")

    if track == "HIGH" and report_count >= HIGH_TRACK_REPORT_THRESHOLD:
        fs = await fresh_score()
        if fs >= HIGH_TRACK_REANALYSIS_SCORE and avg_score >= HIGH_TRACK_AVG_SCORE:
            enqueue_for_admin(doc_id,
                note=f"HIGH track passed ✓ fresh={fs:.0f} avg={avg_score:.0f}")

    elif track == "LOW" and report_count >= LOW_TRACK_REPORT_THRESHOLD:
        fs = await fresh_score()
        if fs >= LOW_TRACK_REANALYSIS_SCORE and avg_score >= LOW_TRACK_AVG_SCORE:
            enqueue_for_admin(doc_id,
                note=f"LOW track passed ✓ fresh={fs:.0f} avg={avg_score:.0f}")