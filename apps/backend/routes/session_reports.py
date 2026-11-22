"""Attendance and two-part reports for held counseling sessions.

The counselor who held a session, or an admin, marks attendance (appointment completed /
no_show) and fills the report: a part the student reads in the app and a part for management
that only counselors and admins see. RLS (migration 014) scopes every read and write to that
counselor's own sessions, so a counselor asking for someone else's session gets a 404.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.errors import NoDataFound, ObjectNotInPrerequisiteState
from pydantic import BaseModel, Field, field_validator

from auth import require_role
from core.db import db, query

router = APIRouter(prefix="/counseling/sessions", tags=["Session Reports"])
admin_router = APIRouter(prefix="/admin/counseling", tags=["Session Reports"])
staff_access = require_role("konselor", "admin")
admin_access = require_role("admin")
WIB = timezone(timedelta(hours=7))

SESSION_SQL = (
    "select a.counseling_appointment_id,a.student_id,s.name student_name,s.nim,a.counselor_id,k.name counselor_name,"
    "a.starts_at,a.ends_at,a.status from counseling_appointments a "
    "left join users s on s.user_id=a.student_id left join users k on k.user_id=a.counselor_id "
    "where a.counseling_appointment_id=%s")
STUDENT_REPORT_SQL = ("select summary,follow_up,updated_at from counseling_student_reports "
                      "where counseling_appointment_id=%s")
MANAGEMENT_REPORT_SQL = ("select topic,risk_level,follow_up,notes,updated_at from counseling_management_reports "
                         "where counseling_appointment_id=%s")


class AttendanceBody(BaseModel):
    attended: bool


class StudentPart(BaseModel):
    summary: str = Field(min_length=1, max_length=2000)
    follow_up: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("summary")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Ringkasan untuk mahasiswa wajib diisi")
        return value.strip()


class ManagementPart(BaseModel):
    topic: Literal["akademik", "keluarga", "relasi", "keuangan", "kesehatan_mental", "karier", "lainnya"]
    risk_level: Literal["rendah", "sedang", "tinggi"]
    follow_up: Literal["none", "next_session", "referral"] = "none"
    notes: Optional[str] = Field(default=None, max_length=4000)


class ReportBody(BaseModel):
    student: StudentPart
    management: ManagementPart


def _blank(value):
    return (value or "").strip() or None


@router.get("/{counseling_appointment_id}")
def session_detail(counseling_appointment_id: UUID, user=Depends(staff_access)):
    sid = str(counseling_appointment_id)
    with db(user.id) as conn:
        session = conn.execute(SESSION_SQL, (sid,)).fetchone()
        # RLS hides other counselors' sessions: unrelated and nonexistent look the same
        if not session:
            raise HTTPException(404, "Sesi tidak ditemukan")
        return {
            "session": session,
            "student_report": conn.execute(STUDENT_REPORT_SQL, (sid,)).fetchone(),
            "management_report": conn.execute(MANAGEMENT_REPORT_SQL, (sid,)).fetchone(),
        }


@router.put("/{counseling_appointment_id}/attendance")
def record_attendance(counseling_appointment_id: UUID, body: AttendanceBody, user=Depends(staff_access)):
    try:
        with db(user.id) as conn:
            status = conn.execute("select record_counseling_attendance(%s,%s) status",
                                  (str(counseling_appointment_id), body.attended)).fetchone()["status"]
    except NoDataFound:
        raise HTTPException(404, "Sesi tidak ditemukan")
    except ObjectNotInPrerequisiteState:
        raise HTTPException(409, "Kehadiran hanya dapat dicatat untuk sesi yang sudah dimulai dan tidak dibatalkan")
    return {"counseling_appointment_id": str(counseling_appointment_id), "status": status}


@router.put("/{counseling_appointment_id}/report")
def save_report(counseling_appointment_id: UUID, body: ReportBody, user=Depends(staff_access)):
    sid = str(counseling_appointment_id)
    with db(user.id) as conn:
        session = conn.execute(SESSION_SQL, (sid,)).fetchone()
        if not session:
            raise HTTPException(404, "Sesi tidak ditemukan")
        if session["status"] != "completed":
            raise HTTPException(409, "Tandai mahasiswa hadir sebelum mengisi laporan sesi")
        student = conn.execute(
            "insert into counseling_student_reports(counseling_appointment_id,summary,follow_up,author_user_id) "
            "values(%s,%s,%s,%s) on conflict (counseling_appointment_id) do update set "
            "summary=excluded.summary,follow_up=excluded.follow_up,author_user_id=excluded.author_user_id "
            "returning summary,follow_up,updated_at",
            (sid, body.student.summary, _blank(body.student.follow_up), user.id)).fetchone()
        m = body.management
        management = conn.execute(
            "insert into counseling_management_reports(counseling_appointment_id,topic,risk_level,follow_up,notes,author_user_id) "
            "values(%s,%s,%s,%s,%s,%s) on conflict (counseling_appointment_id) do update set "
            "topic=excluded.topic,risk_level=excluded.risk_level,follow_up=excluded.follow_up,notes=excluded.notes,"
            "author_user_id=excluded.author_user_id returning topic,risk_level,follow_up,notes,updated_at",
            (sid, m.topic, m.risk_level, m.follow_up, _blank(m.notes), user.id)).fetchone()
    return {"session": session, "student_report": student, "management_report": management}


@admin_router.get("/session-reports")
def session_reports(date_from: date, date_to: date, counselor_id: Optional[UUID] = None,
                    admin=Depends(admin_access)):
    if date_from > date_to or (date_to - date_from).days > 366:
        raise HTTPException(422, "Rentang tanggal tidak valid atau melebihi satu tahun")
    start = datetime.combine(date_from, time.min, WIB)
    end = datetime.combine(date_to + timedelta(days=1), time.min, WIB)
    counselor = str(counselor_id) if counselor_id else None
    # Sessions that have started, so "not yet recorded" shows up next to the recorded ones
    rows = query(
        "select a.counseling_appointment_id,a.starts_at,a.ends_at,a.status,s.name student_name,s.nim,"
        "a.counselor_id,k.name counselor_name,m.topic,m.risk_level,m.follow_up,"
        "sr.counseling_appointment_id is not null has_student_report,"
        "m.counseling_appointment_id is not null has_management_report,"
        "greatest(m.updated_at,sr.updated_at) report_updated_at "
        "from counseling_appointments a left join users s on s.user_id=a.student_id "
        "left join users k on k.user_id=a.counselor_id "
        "left join counseling_management_reports m on m.counseling_appointment_id=a.counseling_appointment_id "
        "left join counseling_student_reports sr on sr.counseling_appointment_id=a.counseling_appointment_id "
        "where a.starts_at>=%s and a.starts_at<%s and a.starts_at<=now() "
        "and a.status in ('confirmed','rescheduled','completed','no_show') "
        "and (%s::uuid is null or a.counselor_id=%s::uuid) "
        "order by a.starts_at desc limit 500",
        (start, end, counselor, counselor), user_id=admin.id)
    return {"sessions": rows, "total": len(rows)}
