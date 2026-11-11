"""Read-only administration over existing tables, with request-scoped RLS."""
from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_role
from core.db import query

router = APIRouter(prefix="/admin", tags=["Admin"])
operator_access = require_role("konselor", "admin", "pemangku_jabatan")
directory_access = require_role("admin", "pemangku_jabatan")


@router.get("/assessments")
def list_assessments(
    search: str = Query("", max_length=100),
    severity: Optional[Literal["minimal", "mild", "moderate", "severe"]] = None,
    instrument: Optional[str] = Query(default=None, max_length=40),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    faculty_id: List[UUID] = Query(default=[]),
    academic_unit_id: List[UUID] = Query(default=[]),
    page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100),
    operator=Depends(operator_access),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Tanggal awal harus sebelum tanggal akhir")
    # LEFT JOIN preserves assessment visibility without bypassing users RLS.
    where = """
        from assessments a left join users u on u.user_id = a.user_id
        left join student_academic_profiles sap on sap.user_id = a.user_id
        where (%s::text is null or a.severity = %s)
          and (%s::text is null or a.instrument_type = %s)
          and (%s::date is null or a.taken_at >= %s::date)
          and (%s::date is null or a.taken_at < %s::date + interval '1 day')
          and (%s = '' or u.name ilike %s or u.nim ilike %s
               or a.user_id::text ilike %s)
          and (%s::uuid[] is null or sap.faculty_id = any(%s::uuid[]))
          and (%s::uuid[] is null or sap.academic_unit_id = any(%s::uuid[]))
    """
    term = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    faculty = [str(value) for value in dict.fromkeys(faculty_id)] or None
    academic_unit = [str(value) for value in dict.fromkeys(academic_unit_id)] or None
    if len(faculty or []) > 20 or len(academic_unit or []) > 50:
        raise HTTPException(422, "Terlalu banyak cakupan akademik dipilih")
    if faculty and academic_unit:
        valid = query(
            "select count(*) total from academic_units where academic_unit_id=any(%s::uuid[]) and faculty_id=any(%s::uuid[])",
            (academic_unit, faculty), user_id=operator.id,
        )[0]["total"]
        if valid != len(academic_unit):
            raise HTTPException(422, "Unit akademik harus berada dalam fakultas yang dipilih")
    params = (severity, severity, instrument, instrument, date_from, date_from,
              date_to, date_to, search, term, term, term,
              faculty, faculty, academic_unit, academic_unit)
    total = query("select count(*) as total " + where, params, user_id=operator.id)[0]["total"]
    rows = query(
        "select a.assessment_id, a.user_id, a.instrument_type, a.instrument_version_id, a.score, "
        "a.severity, a.taken_at, u.name, u.nim,(select jsonb_agg(jsonb_build_object('category',r.category,'raw_score',r.raw_score,'scaled_score',r.scaled_score,'severity',r.severity) order by r.category) from assessment_category_results r where r.assessment_id=a.assessment_id) category_results " + where +
        " order by a.taken_at desc nulls last, a.assessment_id desc limit %s offset %s",
        params + (page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"assessments": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
def user_detail(user_id: UUID, operator=Depends(directory_access)):
    rows = query(
        "select u.user_id,u.name,u.email,u.nim,u.role,u.created_at,sap.faculty_id,f.name as faculty_name,"
        "sap.academic_unit_id,au.name as academic_unit_name,au.unit_type from users u "
        "left join student_academic_profiles sap on sap.user_id=u.user_id "
        "left join faculties f on f.faculty_id=sap.faculty_id "
        "left join academic_units au on au.academic_unit_id=sap.academic_unit_id where u.user_id=%s",
        (str(user_id),), user_id=operator.id,
    )
    if not rows:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    return {"user": rows[0]}


@router.get("/users/{user_id}/assessments")
def user_assessments(
    user_id: UUID, page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100), operator=Depends(operator_access),
):
    uid = str(user_id)
    total = query("select count(*) as total from assessments where user_id = %s",
                  (uid,), user_id=operator.id)[0]["total"]
    rows = query(
        "select a.assessment_id,a.user_id,a.instrument_type,a.instrument_version_id,a.score,a.severity,a.taken_at,"
        "(select jsonb_agg(jsonb_build_object('category',r.category,'raw_score',r.raw_score,'scaled_score',r.scaled_score,'severity',r.severity) order by r.category) from assessment_category_results r where r.assessment_id=a.assessment_id) category_results "
        "from assessments a where a.user_id = %s order by a.taken_at desc nulls last,a.assessment_id desc "
        "limit %s offset %s", (uid, page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"assessments": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}/bookings")
def user_bookings(
    user_id: UUID, page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100), operator=Depends(operator_access),
):
    # Existing RLS restricts counselors to bookings on their own schedules.
    source = "from counseling_bookings b join counseling_slots j on j.counseling_slot_id = b.counseling_slot_id where b.student_id = %s"
    total = query("select count(*) as total " + source, (str(user_id),), user_id=operator.id)[0]["total"]
    rows = query(
        "select b.counseling_booking_id, b.status, j.date, j.start_time, j.end_time "
        + source + " order by j.date desc, b.counseling_booking_id desc limit %s offset %s",
        (str(user_id), page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"bookings": rows, "total": total, "page": page, "page_size": page_size}
