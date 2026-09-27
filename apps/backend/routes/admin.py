"""Read-only administration over existing tables, with request-scoped RLS."""
from datetime import date
from typing import Literal, Optional
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
    instrument: Optional[Literal["PHQ-9", "GAD-7", "SRQ", "custom"]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100),
    operator=Depends(operator_access),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Tanggal awal harus sebelum tanggal akhir")
    # LEFT JOIN preserves assessment visibility without bypassing users RLS.
    where = """
        from assessments a left join users u on u.user_id = a.user_id
        where (%s::text is null or a.severity = %s)
          and (%s::text is null or a.instrument_type = %s)
          and (%s::date is null or a.taken_at >= %s::date)
          and (%s::date is null or a.taken_at < %s::date + interval '1 day')
          and (%s = '' or u.nama ilike %s or u.nim ilike %s
               or a.user_id::text ilike %s)
    """
    term = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    params = (severity, severity, instrument, instrument, date_from, date_from,
              date_to, date_to, search, term, term, term)
    total = query("select count(*) as total " + where, params, user_id=operator.id)[0]["total"]
    rows = query(
        "select a.assessment_id, a.user_id, a.instrument_type, a.score, "
        "a.severity, a.taken_at, u.nama, u.nim " + where +
        " order by a.taken_at desc nulls last, a.assessment_id desc limit %s offset %s",
        params + (page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"assessments": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
def user_detail(user_id: UUID, operator=Depends(directory_access)):
    rows = query(
        "select user_id, nama, email, nim, role, created_at from users where user_id = %s",
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
        "select assessment_id, user_id, instrument_type, score, severity, taken_at "
        "from assessments where user_id = %s order by taken_at desc nulls last, assessment_id desc "
        "limit %s offset %s", (uid, page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"assessments": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}/bookings")
def user_bookings(
    user_id: UUID, page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100), operator=Depends(operator_access),
):
    # Existing RLS restricts counselors to bookings on their own schedules.
    source = "from booking_konsultasi b join jadwal_konsultasi j on j.jadwal_id = b.jadwal_id where b.user_id = %s"
    total = query("select count(*) as total " + source, (str(user_id),), user_id=operator.id)[0]["total"]
    rows = query(
        "select b.booking_id, b.status, j.tanggal, j.waktu_mulai, j.waktu_selesai "
        + source + " order by j.tanggal desc, b.booking_id desc limit %s offset %s",
        (str(user_id), page_size, (page - 1) * page_size), user_id=operator.id,
    )
    return {"bookings": rows, "total": total, "page": page, "page_size": page_size}
