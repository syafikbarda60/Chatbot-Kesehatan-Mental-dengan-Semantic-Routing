"""Counselor workspace: own caseload, own calendar, schedule exception requests.

The counselor always comes from the token, never from the request. Case data is limited to
active case assignments (the same rule RLS enforces through counselor_has_case()) and is a
safe projection: category and severity, never raw answers, chat, journals or guardrail text.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from auth import require_role
from core.db import db, query

router = APIRouter(prefix="/counselor", tags=["Counselor Workspace"])
admin_router = APIRouter(prefix="/admin", tags=["Counselor Exceptions"])
counselor_access = require_role("konselor")
admin_access = require_role("admin")

# The portal works in Jakarta time; exception dates and times are entered in it.
WIB = timezone(timedelta(hours=7))
ACTIVE = ("confirmed", "rescheduled")

CATEGORY = {"depression": "depresi", "anxiety": "kecemasan", "stress": "stres"}
SEVERITY = {
    "normal": "normal", "minimal": "minimal", "mild": "ringan", "moderate": "sedang",
    "severe": "berat", "extremely_severe": "sangat berat",
}
RISK = {"extremely_severe": "critical", "severe": "high", "moderate": "medium",
        "mild": "low", "minimal": "low", "normal": "low"}
RISK_ORDER = ["unknown", "low", "medium", "high", "critical"]
SUPPORT_STATE = {"none": "tidak ada", "present": "ada", "unknown": "belum diketahui",
                 "prefer_not_to_say": "memilih tidak menyebutkan"}

# One row per active case. %s order: counselor, then the optional student filter.
CASES_SQL = (
    "select ca.counselor_case_assignment_id,ca.student_id,u.name student_name,u.nim,"
    "f.name faculty_name,au.name academic_unit_name,"
    "(select cr.preferred_context from counseling_requests cr where cr.student_id=ca.student_id "
    " order by cr.created_at desc limit 1) context,"
    "la.instrument_type,la.severity assessment_severity,la.taken_at assessment_at,"
    "(select coalesce(json_agg(json_build_object('category',r.category,'severity',r.severity) order by r.category),'[]'::json) "
    " from assessment_category_results r where r.assessment_id=la.assessment_id) categories,"
    "(select max(a.starts_at) from counseling_appointments a where a.counselor_id=ca.counselor_id "
    " and a.student_id=ca.student_id and a.starts_at<=now() and a.status in ('confirmed','rescheduled','completed')) last_session_at,"
    "(select min(a.starts_at) from counseling_appointments a where a.counselor_id=ca.counselor_id "
    " and a.student_id=ca.student_id and a.starts_at>now() and a.status in ('confirmed','rescheduled')) next_session_at "
    "from counselor_case_assignments ca join users u on u.user_id=ca.student_id "
    "left join student_academic_profiles sap on sap.user_id=ca.student_id "
    "left join faculties f on f.faculty_id=sap.faculty_id "
    "left join academic_units au on au.academic_unit_id=sap.academic_unit_id "
    "left join lateral (select assessment_id,instrument_type,severity,taken_at from assessments "
    " where user_id=ca.student_id order by taken_at desc limit 1) la on true "
    "where ca.counselor_id=%s and ca.status='active' and (%s::uuid is null or ca.student_id=%s::uuid) "
    "order by u.name"
)

# A service label from data the appointment really has; there is no service_type column.
SERVICE_SQL = ("case r.resource_type when 'virtual' then 'Konseling daring' "
               "when 'physical' then 'Konseling tatap muka' else 'Konseling' end service_type")

EXCEPTION_COLUMNS = (
    "e.counselor_exception_request_id,(e.starts_at at time zone 'Asia/Jakarta')::date date,"
    "e.starts_at,e.ends_at,e.full_day,e.reason,e.note,e.status,e.created_at submitted_at,"
    "e.decision_note,e.affected_appointment_ids affected_appointments"
)


def _summary(row):
    """Risk, a one-line assessment summary and the follow-up state of one case row."""
    categories = row.pop("categories") or []
    severity = row.pop("assessment_severity")
    instrument = row.pop("instrument_type")
    if categories:
        risk = max((RISK.get(c["severity"], "unknown") for c in categories), key=RISK_ORDER.index)
        parts = [f"{CATEGORY.get(c['category'], c['category'])} {SEVERITY.get(c['severity'], c['severity'] or '-')}" for c in categories]
        row["assessment_summary"] = f"{instrument}: " + ", ".join(parts)
    elif severity:
        risk = RISK.get(severity, "unknown")
        row["assessment_summary"] = f"{instrument}: {SEVERITY.get(severity, severity)}"
    else:
        risk, row["assessment_summary"] = "unknown", None
    row["risk"] = risk
    row["context"] = row["context"] or "Tidak ada konteks permintaan"
    if row["next_session_at"]:
        row["follow_up_status"] = "planned"
    elif row["last_session_at"] and risk not in ("high", "critical"):
        row["follow_up_status"] = "complete"
    else:
        row["follow_up_status"] = "action_required"
    return row


def _cases(counselor_id, student_id=None):
    sid = str(student_id) if student_id else None
    rows = query(CASES_SQL, (counselor_id, sid, sid), user_id=counselor_id)
    return [_summary(dict(r)) for r in rows]


def _affected(conn, counselor_id, starts_at, ends_at):
    rows = conn.execute(
        "select counseling_appointment_id from counseling_appointments where counselor_id=%s "
        "and status in ('confirmed','rescheduled') and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)') "
        "order by starts_at", (counselor_id, starts_at, ends_at)).fetchall()
    return [r["counseling_appointment_id"] for r in rows]


@router.get("/profile")
def profile(counselor=Depends(counselor_access)):
    rows = query(
        "select u.user_id,u.name,u.email,cp.title,cp.specialization,coalesce(cp.active,true) active "
        "from users u left join counselor_profiles cp on cp.user_id=u.user_id where u.user_id=%s",
        (counselor.id,), user_id=counselor.id)
    if not rows:
        raise HTTPException(404, "Profil konselor tidak ditemukan")
    return rows[0]


@router.get("/cases")
def cases(counselor=Depends(counselor_access)):
    rows = _cases(counselor.id)
    return {"cases": rows, "total": len(rows)}


@router.get("/cases/{student_id}")
def case_detail(student_id: UUID, counselor=Depends(counselor_access)):
    rows = _cases(counselor.id, student_id)
    # Unrelated and nonexistent students look the same: no hint that the student exists
    if not rows:
        raise HTTPException(404, "Kasus tidak ditemukan")
    sid = str(student_id)
    support = query(
        "select mental_health_condition_state,disability_state from student_support_profiles where user_id=%s",
        (sid,), user_id=counselor.id)
    # States only; the free-text details stay with the admin
    support_summary = (
        f"Kondisi kesehatan mental: {SUPPORT_STATE.get(support[0]['mental_health_condition_state'])}; "
        f"disabilitas: {SUPPORT_STATE.get(support[0]['disability_state'])}" if support else None)
    assessments = query(
        "select a.assessment_id,a.instrument_type instrument,a.taken_at,a.severity,"
        "coalesce(json_agg(json_build_object('name',r.category,'score',r.scaled_score,'severity',coalesce(r.severity,'unknown')) "
        " order by r.category) filter (where r.assessment_category_result_id is not null),'[]'::json) dimensions "
        "from assessments a left join assessment_category_results r on r.assessment_id=a.assessment_id "
        "where a.user_id=%s group by a.assessment_id order by a.taken_at desc limit 20",
        (sid,), user_id=counselor.id)
    # Only this counselor's own sessions with the student
    sessions = query(
        "select a.counseling_appointment_id,a.starts_at,a.ends_at,a.status," + SERVICE_SQL + ",r.name resource_name "
        "from counseling_appointments a left join counseling_resources r on r.counseling_resource_id=a.counseling_resource_id "
        "where a.counselor_id=%s and a.student_id=%s order by a.starts_at desc",
        (counselor.id, sid), user_id=counselor.id)
    return {"case": rows[0], "support_summary": support_summary, "assessments": assessments, "sessions": sessions}


@router.get("/calendar")
def calendar(date_from: date, date_to: date, counselor=Depends(counselor_access)):
    # 120 days covers the widest dashboard view (availability: 30 days back, 90 ahead)
    if date_from > date_to or (date_to - date_from).days > 120:
        raise HTTPException(422, "Rentang kalender tidak valid atau melebihi 120 hari")
    # The range is whole Jakarta days
    start = datetime.combine(date_from, time.min, WIB)
    end = datetime.combine(date_to + timedelta(days=1), time.min, WIB)
    appointments = query(
        "select a.counseling_appointment_id,a.student_id,s.name student_name,s.nim,a.starts_at,a.ends_at,a.status,"
        + SERVICE_SQL + ",r.name resource_name,r.resource_type,"
        # Flags a session that approved time off now overlaps, for the counselor to raise
        "exists(select 1 from counselor_blocked_periods b where b.counselor_id=a.counselor_id "
        " and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(a.starts_at,a.ends_at,'[)')) "
        " and a.status in ('confirmed','rescheduled') conflict "
        "from counseling_appointments a left join users s on s.user_id=a.student_id "
        "left join counseling_resources r on r.counseling_resource_id=a.counseling_resource_id "
        "where a.counselor_id=%s and a.starts_at<%s and a.ends_at>%s order by a.starts_at",
        (counselor.id, end, start), user_id=counselor.id)
    availability = query(
        "select counselor_availability_rule_id,day_of_week,start_time,end_time,effective_from,effective_to "
        "from counselor_availability_rules where counselor_id=%s and active "
        "and coalesce(effective_from,'-infinity'::date)<=%s and coalesce(effective_to,'infinity'::date)>=%s "
        "order by day_of_week,start_time",
        (counselor.id, date_to, date_from), user_id=counselor.id)
    exceptions = query(
        "select " + EXCEPTION_COLUMNS + " from counselor_exception_requests e "
        "where e.counselor_id=%s and e.starts_at<%s and e.ends_at>%s order by e.starts_at",
        (counselor.id, end, start), user_id=counselor.id)
    return {"appointments": appointments, "availability": availability, "exceptions": exceptions}


class ExceptionBody(BaseModel):
    date: date
    full_day: bool = False
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: str = Field(min_length=1, max_length=250)
    note: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def valid_interval(self):
        if not self.reason.strip():
            raise ValueError("Alasan wajib diisi")
        if not self.full_day and (self.start_time is None or self.end_time is None or self.end_time <= self.start_time):
            raise ValueError("Jam selesai harus setelah jam mulai")
        return self

    def interval(self):
        if self.full_day:
            return (datetime.combine(self.date, time.min, WIB),
                    datetime.combine(self.date + timedelta(days=1), time.min, WIB))
        return datetime.combine(self.date, self.start_time, WIB), datetime.combine(self.date, self.end_time, WIB)


@router.post("/exception-requests", status_code=201)
def request_exception(body: ExceptionBody, counselor=Depends(counselor_access)):
    starts_at, ends_at = body.interval()
    if ends_at <= datetime.now(timezone.utc):
        raise HTTPException(422, "Waktu pengecualian sudah lewat")
    with db(counselor.id) as conn:
        # The counselor's schedule lock: the same one appointment assignment takes
        conn.execute("select pg_advisory_xact_lock(hashtext(%s))", ("appointment:" + counselor.id,))
        if conn.execute(
            "select 1 from counselor_exception_requests where counselor_id=%s and status in ('pending','approved') "
            "and tstzrange(starts_at,ends_at,'[)') && tstzrange(%s,%s,'[)')",
            (counselor.id, starts_at, ends_at)).fetchone():
            raise HTTPException(409, "Sudah ada pengecualian pada waktu itu")
        affected = _affected(conn, counselor.id, starts_at, ends_at)
        row = conn.execute(
            "insert into counselor_exception_requests(counselor_id,starts_at,ends_at,full_day,reason,note,affected_appointment_ids) "
            "values(%s,%s,%s,%s,%s,%s,%s::uuid[]) returning counselor_exception_request_id",
            (counselor.id, starts_at, ends_at, body.full_day, body.reason.strip(),
             (body.note or "").strip() or None, [str(a) for a in affected])).fetchone()
        exception = conn.execute(
            "select " + EXCEPTION_COLUMNS + " from counselor_exception_requests e where e.counselor_exception_request_id=%s",
            (row["counselor_exception_request_id"],)).fetchone()
    return {"exception": exception}


# ── admin decision ───────────────────────────────────────────────────────────

@admin_router.get("/counseling/exception-requests")
def exception_queue(
    status: Optional[Literal["pending", "approved", "rejected", "cancelled"]] = None,
    counselor_id: Optional[UUID] = None,
    admin=Depends(admin_access),
):
    cid = str(counselor_id) if counselor_id else None
    rows = query(
        "select " + EXCEPTION_COLUMNS + ",e.counselor_id,u.name counselor_name,e.reviewed_at,e.counselor_blocked_period_id "
        "from counselor_exception_requests e join users u on u.user_id=e.counselor_id "
        "where (%s::text is null or e.status=%s) and (%s::uuid is null or e.counselor_id=%s::uuid) "
        "order by case when e.status='pending' then 0 else 1 end,e.created_at desc limit 200",
        (status, status, cid, cid), user_id=admin.id)
    return {"exception_requests": rows, "total": len(rows)}


class DecisionBody(BaseModel):
    decision_note: Optional[str] = Field(default=None, max_length=1000)


def _pending(conn, exception_request_id):
    row = conn.execute(
        "select * from counselor_exception_requests where counselor_exception_request_id=%s for update",
        (str(exception_request_id),)).fetchone()
    if not row:
        raise HTTPException(404, "Permintaan pengecualian tidak ditemukan")
    if row["status"] != "pending":
        raise HTTPException(409, "Permintaan pengecualian sudah diputuskan")
    return row


@admin_router.post("/counseling/exception-requests/{exception_request_id}/approve")
def approve_exception(exception_request_id: UUID, body: DecisionBody, admin=Depends(admin_access)):
    with db(admin.id) as conn:
        request = _pending(conn, exception_request_id)
        counselor = str(request["counselor_id"])
        conn.execute("select pg_advisory_xact_lock(hashtext(%s))", ("appointment:" + counselor,))
        # The schedule may have changed since the request; record what it overlaps now.
        # Those sessions stay as they are: the admin reschedules them deliberately.
        affected = _affected(conn, counselor, request["starts_at"], request["ends_at"])
        block = conn.execute(
            "insert into counselor_blocked_periods(counselor_id,starts_at,ends_at,reason,created_by) "
            "values(%s,%s,%s,%s,%s) returning counselor_blocked_period_id",
            (counselor, request["starts_at"], request["ends_at"], request["reason"], admin.id)).fetchone()
        conn.execute(
            "update counselor_exception_requests set status='approved',reviewed_by=%s,reviewed_at=now(),decision_note=%s,"
            "counselor_blocked_period_id=%s,affected_appointment_ids=%s::uuid[] where counselor_exception_request_id=%s",
            (admin.id, body.decision_note, block["counselor_blocked_period_id"], [str(a) for a in affected],
             str(exception_request_id)))
        row = conn.execute(
            "select " + EXCEPTION_COLUMNS + ",e.counselor_blocked_period_id from counselor_exception_requests e "
            "where e.counselor_exception_request_id=%s", (str(exception_request_id),)).fetchone()
    return {"exception_request": row}


@admin_router.post("/counseling/exception-requests/{exception_request_id}/reject")
def reject_exception(exception_request_id: UUID, body: DecisionBody, admin=Depends(admin_access)):
    if not (body.decision_note or "").strip():
        raise HTTPException(422, "Catatan keputusan wajib diisi saat menolak")
    with db(admin.id) as conn:
        _pending(conn, exception_request_id)
        conn.execute(
            "update counselor_exception_requests set status='rejected',reviewed_by=%s,reviewed_at=now(),decision_note=%s "
            "where counselor_exception_request_id=%s",
            (admin.id, body.decision_note.strip(), str(exception_request_id)))
        row = conn.execute(
            "select " + EXCEPTION_COLUMNS + " from counselor_exception_requests e where e.counselor_exception_request_id=%s",
            (str(exception_request_id),)).fetchone()
    return {"exception_request": row}
