from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Literal
from supabase import create_client
from auth import get_current_user
from dotenv import load_dotenv
import os

load_dotenv()

router = APIRouter(prefix="/assessment", tags=["Assessment"])

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

# Sesuai ERD: severity thresholds (contoh PHQ-9)
SEVERITY_THRESHOLDS = {
    "minimal":  (0,  4),
    "mild":     (5,  9),
    "moderate": (10, 14),
    "severe":   (15, 999),
}


def _calc_severity(score: int) -> str:
    for label, (lo, hi) in SEVERITY_THRESHOLDS.items():
        if lo <= score <= hi:
            return label
    return "severe"


# ── Schema ───────────────────────────────────────────────────────────────────

class AnswerItem(BaseModel):
    question_id: int
    score: int  # 0–3


class AssessmentRequest(BaseModel):
    answers: List[AnswerItem]
    instrument_type: Literal["PHQ-9", "GAD-7", "SRQ", "custom"] = "PHQ-9"
    session_id: Optional[str] = None


class NotifyRiskRequest(BaseModel):
    user_id: str
    assessment_id: str
    score: int
    session_id: Optional[str] = None


# ── CB-01: submitSelfAssessment ───────────────────────────────────────────────

@router.post("/submit")
def submit_self_assessment(
    request: AssessmentRequest,
    user=Depends(get_current_user),
):
    """
    CB-01 — Terima jawaban kuesioner mahasiswa, hitung skor,
    simpan ke tabel assessments. Auto-trigger CB-02 jika severity severe/moderate.
    """
    score = sum(a.score for a in request.answers)
    severity = _calc_severity(score)
    answers_payload = [a.model_dump() for a in request.answers]

    result = supabase.table("assessments").insert({
        "user_id": str(user.id),
        "instrument_type": request.instrument_type,
        "answers": answers_payload,
        "score": score,
        "severity": severity,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Gagal menyimpan hasil asesmen")

    assessment_id = result.data[0]["assessment_id"]

    # Auto-trigger CB-02 jika severe
    if severity in ("severe", "moderate"):
        _log_high_risk(
            user_id=str(user.id),
            assessment_id=assessment_id,
            score=score,
            session_id=request.session_id,
        )

    return {
        "assessment_id": assessment_id,
        "score": score,
        "severity": severity,
        "instrument_type": request.instrument_type,
        "message": "Asesmen berhasil disimpan",
    }


# ── CB-02: sendHighRiskNotification ──────────────────────────────────────────

@router.post("/notify-risk")
def send_high_risk_notification(request: NotifyRiskRequest):
    """
    CB-02 — Log notifikasi alert ke guardrail_logs agar Operator bisa pantau.
    """
    _log_high_risk(
        user_id=request.user_id,
        assessment_id=request.assessment_id,
        score=request.score,
        session_id=request.session_id,
    )
    return {"status": "notified", "user_id": request.user_id}


# ── GET: riwayat asesmen user ─────────────────────────────────────────────────

@router.get("/history")
def get_assessment_history(user=Depends(get_current_user)):
    """Ambil riwayat asesmen mahasiswa yang login."""
    result = supabase.table("assessments").select(
        "assessment_id, instrument_type, score, severity, taken_at"
    ).eq("user_id", str(user.id)).order("taken_at", desc=True).execute()
    return {"assessments": result.data or []}


# ── Internal helper ───────────────────────────────────────────────────────────

def _log_high_risk(
    user_id: str,
    score: int,
    session_id: Optional[str] = None,
    assessment_id: Optional[str] = None,
):
    """Insert ke guardrail_logs — notifikasi high-risk untuk Operator."""
    supabase.table("guardrail_logs").insert({
        "user_id": user_id,
        "session_id": session_id,
        "triggered_input": f"[ASSESSMENT] score={score}, assessment_id={assessment_id}",
    }).execute()
