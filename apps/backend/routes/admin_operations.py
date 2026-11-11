"""Admin-only operational views over existing Sajiwa tables.

The responses deliberately exclude assessment answers, booking notes, private text,
and raw guardrail trigger input.
"""
from datetime import date, time, timedelta
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth import require_role
from core.db import query

router = APIRouter(prefix="/admin", tags=["Admin Operations"])
admin_access = require_role("admin")


class ScheduleCreate(BaseModel):
    counselor_id: UUID
    date: date
    start_time: time
    end_time: time


class ScheduleUpdate(BaseModel):
    status: Literal["available", "booked", "completed", "cancelled"]


class HotlineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    description: Optional[str] = Field(default=None, max_length=500)
    verification_status: Literal["active", "verification_required", "inactive"] = "verification_required"
    verification_note: Optional[str] = Field(default=None, max_length=1000)


class HotlineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, min_length=1, max_length=20)
    description: Optional[str] = Field(default=None, max_length=500)
    verification_status: Optional[Literal["active", "verification_required", "inactive"]] = None
    verification_note: Optional[str] = Field(default=None, max_length=1000)


@router.get("/attention")
def attention_signals(
    signal: Optional[Literal["assessment", "safety", "request"]] = None,
    unread_only: bool = False,
    faculty_id: List[UUID] = Query(default=[]),
    academic_unit_id: List[UUID] = Query(default=[]),
    page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(admin_access),
):
    # 'request' means the student pressed "contact me" in the app's crisis dialog.
    # source/assessment_id are authoritative; LIKE keeps older records readable.
    # %% escapes percent signs because psycopg also uses % for placeholders.
    kind = (
        "case when g.assessment_id is not null or g.source = 'assessment' "
        "or g.triggered_input like '[ASSESSMENT]%%' then 'assessment' "
        "when g.triggered_input like '[LAPORAN PENGGUNA]%%' then 'request' "
        "else 'safety' end"
    )
    faculties = [str(value) for value in dict.fromkeys(faculty_id)] or None
    units = [str(value) for value in dict.fromkeys(academic_unit_id)] or None
    if len(faculties or []) > 20 or len(units or []) > 50:
        raise HTTPException(422, "Terlalu banyak cakupan akademik dipilih")
    source = (
        "from guardrail_logs g left join users u on u.user_id = g.user_id "
        "left join student_academic_profiles sap on sap.user_id=g.user_id "
        f"where (%s::text is null or ({kind}) = %s) and (%s = false or g.is_read = false) "
        "and (%s::uuid[] is null or sap.faculty_id=any(%s::uuid[])) "
        "and (%s::uuid[] is null or sap.academic_unit_id=any(%s::uuid[]))"
    )
    params = (signal, signal, unread_only, faculties, faculties, units, units)
    summary_rows = query(
        f"select ({kind}) as signal_type, count(*) as total, "
        f"count(*) filter (where g.is_read = false) as unread {source} group by 1",
        params, user_id=admin.id,
    )
    rows = query(
        "select g.guardrail_log_id, g.user_id, g.assessment_id, g.is_read, g.notified_at, "
        "u.name, u.nim,(select string_agg(distinct r.category,', ' order by r.category) from assessment_category_results r where r.assessment_id=g.assessment_id) assessment_categories, "
        "(select jsonb_agg(jsonb_build_object('category',r.category,'severity',r.severity,'scaled_score',r.scaled_score) order by r.category) from assessment_category_results r where r.assessment_id=g.assessment_id) assessment_category_results, "
        f"({kind}) as signal_type {source} "
        "order by g.notified_at desc nulls last, g.guardrail_log_id desc limit %s offset %s",
        params + (page_size, (page - 1) * page_size), user_id=admin.id,
    )
    total = sum(row["total"] for row in summary_rows)
    return {"signals": rows, "summary": summary_rows, "total": total, "page": page, "page_size": page_size}


@router.patch("/attention/{guardrail_log_id}/read")
def mark_attention_read(guardrail_log_id: UUID, admin=Depends(admin_access)):
    rows = query(
        "update guardrail_logs set is_read = true where guardrail_log_id = %s returning guardrail_log_id",
        (str(guardrail_log_id),), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Sinyal perhatian tidak ditemukan")
    return {"message": "Sinyal ditandai sudah ditinjau"}


@router.get("/schedules")
def organization_schedules(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    counselor_id: Optional[UUID] = None,
    admin=Depends(admin_access),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Tanggal awal harus sebelum tanggal akhir")
    rows = query(
        "select j.counseling_slot_id, j.counselor_id, u.name as counselor_name, j.date, "
        "j.start_time, j.end_time, j.status, b.counseling_booking_id, "
        "b.status as booking_status "
        "from counseling_slots j join users u on u.user_id = j.counselor_id "
        "left join lateral (select bk.counseling_booking_id, bk.status from counseling_bookings bk "
        "where bk.counseling_slot_id = j.counseling_slot_id order by bk.created_at desc, bk.counseling_booking_id desc limit 1) b on true "
        "where (%s::date is null or j.date >= %s::date) "
        "and (%s::date is null or j.date <= %s::date) "
        "and (%s::uuid is null or j.counselor_id = %s::uuid) "
        "order by j.date, j.start_time, j.counseling_slot_id",
        (date_from, date_from, date_to, date_to, str(counselor_id) if counselor_id else None,
         str(counselor_id) if counselor_id else None), user_id=admin.id,
    )
    return {"schedules": rows, "total": len(rows)}


@router.post("/schedules", status_code=status.HTTP_201_CREATED)
def create_organization_schedule(request: ScheduleCreate, admin=Depends(admin_access)):
    if request.end_time <= request.start_time:
        raise HTTPException(422, "Jam selesai harus setelah jam mulai")
    counselor = query(
        "select user_id from users where user_id = %s and role = 'konselor'",
        (str(request.counselor_id),), user_id=admin.id,
    )
    if not counselor:
        raise HTTPException(404, "Akun konselor tidak ditemukan")
    rows = query(
        "insert into counseling_slots (counselor_id, date, start_time, end_time, status) "
        "values (%s, %s, %s, %s, 'available') "
        "returning counseling_slot_id, counselor_id, date, start_time, end_time, status",
        (str(request.counselor_id), request.date, request.start_time, request.end_time),
        user_id=admin.id,
    )
    return {"schedule": rows[0]}


@router.patch("/schedules/{schedule_id}")
def update_organization_schedule(schedule_id: UUID, request: ScheduleUpdate, admin=Depends(admin_access)):
    rows = query(
        "update counseling_slots set status = %s where counseling_slot_id = %s returning counseling_slot_id",
        (request.status, str(schedule_id)), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    return {"message": "Status jadwal diperbarui"}


@router.get("/hotlines")
def list_hotlines(admin=Depends(admin_access)):
    rows = query(
        "select hotline_id,name,phone,description,verification_status,verified_at,verified_by,verification_note,created_at,updated_at,updated_by from hotlines order by created_at,name",
        user_id=admin.id,
    )
    return {"hotlines": rows, "total": len(rows)}


@router.post("/hotlines", status_code=status.HTTP_201_CREATED)
def create_hotline(request: HotlineCreate, admin=Depends(admin_access)):
    rows = query(
        "insert into hotlines (name,phone,description,verification_status,verified_at,verified_by,verification_note,updated_by) values (%s,%s,%s,%s,case when %s='active' then now() end,case when %s='active' then %s::uuid end,%s,%s) "
        "returning hotline_id,name,phone,description,verification_status,verified_at,verified_by,verification_note,created_at,updated_at,updated_by",
        (request.name.strip(), request.phone.strip(), request.description, request.verification_status, request.verification_status, request.verification_status, admin.id, request.verification_note, admin.id), user_id=admin.id,
    )
    return {"hotline": rows[0]}


@router.put("/hotlines/{hotline_id}")
def update_hotline(hotline_id: UUID, request: HotlineUpdate, admin=Depends(admin_access)):
    if request.name is None and request.phone is None and request.description is None and request.verification_status is None and request.verification_note is None:
        raise HTTPException(422, "Tidak ada data yang diubah")
    content_changed = request.name is not None or request.phone is not None or request.description is not None
    next_verification_status = "verification_required" if content_changed else request.verification_status
    rows = query(
        "update hotlines set name=coalesce(%s,name),phone=coalesce(%s,phone),description=coalesce(%s,description),"
        "verification_status=coalesce(%s,verification_status),"
        "verified_at=case when %s='active' then now() when %s::text is not null then null else verified_at end,"
        "verified_by=case when %s='active' then %s::uuid when %s::text is not null then null else verified_by end,"
        "verification_note=coalesce(%s,verification_note),updated_at=now(),updated_by=%s where hotline_id=%s "
        "returning hotline_id,name,phone,description,verification_status,verified_at,verified_by,verification_note,created_at,updated_at,updated_by",
        (request.name.strip() if request.name else None, request.phone.strip() if request.phone else None, request.description,
         next_verification_status,
         next_verification_status, next_verification_status,
         next_verification_status, admin.id, next_verification_status,
         request.verification_note, admin.id, str(hotline_id)), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Hotline tidak ditemukan")
    return {"hotline": rows[0]}


@router.delete("/hotlines/{hotline_id}")
def delete_hotline(hotline_id: UUID, admin=Depends(admin_access)):
    rows = query(
        "update hotlines set verification_status='inactive',verified_at=null,verified_by=null,updated_at=now(),updated_by=%s where hotline_id=%s returning hotline_id",
        (admin.id, str(hotline_id)), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Hotline tidak ditemukan")
    return {"message": "Hotline dinonaktifkan"}


@router.get("/analytics")
def analytics(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    admin=Depends(admin_access),
):
    end = date_to or date.today()
    start = date_from or end - timedelta(days=29)
    if start > end:
        raise HTTPException(422, "Tanggal awal harus sebelum tanggal akhir")
    assessment_params = (start, end)
    severity = query(
        "select severity, count(*) as count from assessments "
        "where taken_at >= %s::date and taken_at < %s::date + interval '1 day' group by severity",
        assessment_params, user_id=admin.id,
    )
    trend = query(
        "select taken_at::date as date, count(*) as count from assessments "
        "where taken_at >= %s::date and taken_at < %s::date + interval '1 day' "
        "group by 1 order by 1", assessment_params, user_id=admin.id,
    )
    bookings = query(
        "select b.status, count(*) as count from counseling_bookings b "
        "join counseling_slots j on j.counseling_slot_id = b.counseling_slot_id "
        "where j.date >= %s::date and j.date <= %s::date group by b.status",
        assessment_params, user_id=admin.id,
    )
    students = query("select count(*) as count from users where role = 'mahasiswa'", user_id=admin.id)[0]["count"]
    return {
        "date_from": start, "date_to": end, "registered_students": students,
        "assessment_total": sum(row["count"] for row in severity),
        "severity_distribution": severity, "assessment_trend": trend,
        "booking_total": sum(row["count"] for row in bookings), "booking_status": bookings,
    }
