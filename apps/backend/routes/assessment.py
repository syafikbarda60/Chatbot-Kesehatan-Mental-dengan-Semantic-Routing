from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Literal
from psycopg.types.json import Jsonb

from auth import get_current_user
from core.db import query

router = APIRouter(prefix="/assessment", tags=["Assessment"])

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


class AnswerItem(BaseModel):
    question_id: int
    score: int


class AssessmentRequest(BaseModel):
    answers: List[AnswerItem]
    instrument_type: Literal["PHQ-9", "GAD-7", "SRQ", "custom"] = "PHQ-9"
    session_id: Optional[str] = None


class NotifyRiskRequest(BaseModel):
    user_id: str
    assessment_id: str
    score: int
    session_id: Optional[str] = None


@router.post("/submit")
def submit_self_assessment(
    request: AssessmentRequest,
    user=Depends(get_current_user),
):
    score = sum(a.score for a in request.answers)
    severity = _calc_severity(score)
    answers_payload = [a.model_dump() for a in request.answers]

    rows = query(
        "insert into assessments (user_id, instrument_type, answers, score, severity) "
        "values (%s, %s, %s, %s, %s) returning assessment_id",
        (user.id, request.instrument_type, Jsonb(answers_payload), score, severity),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=500, detail="Gagal menyimpan hasil asesmen")

    assessment_id = rows[0]["assessment_id"]

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


@router.post("/notify-risk")
def send_high_risk_notification(request: NotifyRiskRequest):
    _log_high_risk(
        user_id=request.user_id,
        assessment_id=request.assessment_id,
        score=request.score,
        session_id=request.session_id,
    )
    return {"status": "notified", "user_id": request.user_id}


@router.get("/history")
def get_assessment_history(user=Depends(get_current_user)):
    rows = query(
        "select assessment_id, instrument_type, score, severity, taken_at "
        "from assessments where user_id = %s order by taken_at desc",
        (user.id,),
        user_id=user.id,
    )
    return {"assessments": rows}


def _log_high_risk(
    user_id: str,
    score: int,
    session_id: Optional[str] = None,
    assessment_id: Optional[str] = None,
):
    query(
        "insert into guardrail_logs (user_id, session_id, triggered_input) values (%s, %s, %s)",
        (user_id, session_id, f"[ASSESSMENT] score={score}, assessment_id={assessment_id}"),
        user_id=user_id,
    )
