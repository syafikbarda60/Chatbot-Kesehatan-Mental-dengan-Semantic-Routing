"""Admin-only operational views over existing Sanctuary tables.

The responses deliberately exclude assessment answers, booking notes, private text,
and raw guardrail trigger input.
"""
from datetime import date, time, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth import require_role
from core.db import query

router = APIRouter(prefix="/admin", tags=["Admin Operations"])
admin_access = require_role("admin")


class ScheduleCreate(BaseModel):
    counselor_id: UUID
    tanggal: date
    waktu_mulai: time
    waktu_selesai: time


class ScheduleUpdate(BaseModel):
    status: Literal["tersedia", "dipesan", "selesai", "dibatalkan"]


class HotlineCreate(BaseModel):
    nama: str = Field(min_length=1, max_length=100)
    nomor: str = Field(min_length=1, max_length=20)
    deskripsi: Optional[str] = Field(default=None, max_length=500)


class HotlineUpdate(BaseModel):
    nama: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nomor: Optional[str] = Field(default=None, min_length=1, max_length=20)
    deskripsi: Optional[str] = Field(default=None, max_length=500)


@router.get("/attention")
def attention_signals(
    signal: Optional[Literal["assessment", "safety"]] = None,
    unread_only: bool = False,
    page: int = Query(1, ge=1, le=2147483647),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(admin_access),
):
    # Older assessment logs only recorded a safe prefix in triggered_input. It is
    # used solely for classification here and is never returned to the client.
    kind = "case when g.assessment_id is not null or g.triggered_input like '[ASSESSMENT]%' then 'assessment' else 'safety' end"
    source = (
        "from guardrail_logs g left join users u on u.user_id = g.user_id "
        f"where (%s::text is null or ({kind}) = %s) and (%s = false or g.is_read = false)"
    )
    params = (signal, signal, unread_only)
    summary_rows = query(
        f"select ({kind}) as signal_type, count(*) as total, "
        f"count(*) filter (where g.is_read = false) as unread {source} group by 1",
        params, user_id=admin.id,
    )
    rows = query(
        "select g.log_id, g.user_id, g.assessment_id, g.is_read, g.notified_at, "
        f"u.nama, u.nim, ({kind}) as signal_type {source} "
        "order by g.notified_at desc nulls last, g.log_id desc limit %s offset %s",
        params + (page_size, (page - 1) * page_size), user_id=admin.id,
    )
    total = sum(row["total"] for row in summary_rows)
    return {"signals": rows, "summary": summary_rows, "total": total, "page": page, "page_size": page_size}


@router.patch("/attention/{log_id}/read")
def mark_attention_read(log_id: UUID, admin=Depends(admin_access)):
    rows = query(
        "update guardrail_logs set is_read = true where log_id = %s returning log_id",
        (str(log_id),), user_id=admin.id,
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
        "select j.jadwal_id, j.konselor_id, u.nama as counselor_name, j.tanggal, "
        "j.waktu_mulai, j.waktu_selesai, j.status, b.booking_id, "
        "b.status as booking_status "
        "from jadwal_konsultasi j join users u on u.user_id = j.konselor_id "
        "left join lateral (select bk.booking_id, bk.status from booking_konsultasi bk "
        "where bk.jadwal_id = j.jadwal_id order by bk.created_at desc, bk.booking_id desc limit 1) b on true "
        "where (%s::date is null or j.tanggal >= %s::date) "
        "and (%s::date is null or j.tanggal <= %s::date) "
        "and (%s::uuid is null or j.konselor_id = %s::uuid) "
        "order by j.tanggal, j.waktu_mulai, j.jadwal_id",
        (date_from, date_from, date_to, date_to, str(counselor_id) if counselor_id else None,
         str(counselor_id) if counselor_id else None), user_id=admin.id,
    )
    return {"schedules": rows, "total": len(rows)}


@router.post("/schedules", status_code=status.HTTP_201_CREATED)
def create_organization_schedule(request: ScheduleCreate, admin=Depends(admin_access)):
    if request.waktu_selesai <= request.waktu_mulai:
        raise HTTPException(422, "Jam selesai harus setelah jam mulai")
    counselor = query(
        "select user_id from users where user_id = %s and role = 'konselor'",
        (str(request.counselor_id),), user_id=admin.id,
    )
    if not counselor:
        raise HTTPException(404, "Akun konselor tidak ditemukan")
    rows = query(
        "insert into jadwal_konsultasi (konselor_id, tanggal, waktu_mulai, waktu_selesai, status) "
        "values (%s, %s, %s, %s, 'tersedia') "
        "returning jadwal_id, konselor_id, tanggal, waktu_mulai, waktu_selesai, status",
        (str(request.counselor_id), request.tanggal, request.waktu_mulai, request.waktu_selesai),
        user_id=admin.id,
    )
    return {"schedule": rows[0]}


@router.patch("/schedules/{schedule_id}")
def update_organization_schedule(schedule_id: UUID, request: ScheduleUpdate, admin=Depends(admin_access)):
    rows = query(
        "update jadwal_konsultasi set status = %s where jadwal_id = %s returning jadwal_id",
        (request.status, str(schedule_id)), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    return {"message": "Status jadwal diperbarui"}


@router.get("/hotlines")
def list_hotlines(admin=Depends(admin_access)):
    rows = query(
        "select hotline_id, nama, nomor, deskripsi, created_at from hotline order by created_at, nama",
        user_id=admin.id,
    )
    return {"hotlines": rows, "total": len(rows)}


@router.post("/hotlines", status_code=status.HTTP_201_CREATED)
def create_hotline(request: HotlineCreate, admin=Depends(admin_access)):
    rows = query(
        "insert into hotline (nama, nomor, deskripsi) values (%s, %s, %s) "
        "returning hotline_id, nama, nomor, deskripsi, created_at",
        (request.nama.strip(), request.nomor.strip(), request.deskripsi), user_id=admin.id,
    )
    return {"hotline": rows[0]}


@router.put("/hotlines/{hotline_id}")
def update_hotline(hotline_id: UUID, request: HotlineUpdate, admin=Depends(admin_access)):
    if request.nama is None and request.nomor is None and request.deskripsi is None:
        raise HTTPException(422, "Tidak ada data yang diubah")
    rows = query(
        "update hotline set nama = coalesce(%s, nama), nomor = coalesce(%s, nomor), "
        "deskripsi = coalesce(%s, deskripsi) where hotline_id = %s "
        "returning hotline_id, nama, nomor, deskripsi, created_at",
        (request.nama.strip() if request.nama else None, request.nomor.strip() if request.nomor else None,
         request.deskripsi, str(hotline_id)), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Hotline tidak ditemukan")
    return {"hotline": rows[0]}


@router.delete("/hotlines/{hotline_id}")
def delete_hotline(hotline_id: UUID, admin=Depends(admin_access)):
    rows = query(
        "delete from hotline where hotline_id = %s returning hotline_id",
        (str(hotline_id),), user_id=admin.id,
    )
    if not rows:
        raise HTTPException(404, "Hotline tidak ditemukan")
    return {"message": "Hotline dihapus"}


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
        "select b.status, count(*) as count from booking_konsultasi b "
        "join jadwal_konsultasi j on j.jadwal_id = b.jadwal_id "
        "where j.tanggal >= %s::date and j.tanggal <= %s::date group by b.status",
        assessment_params, user_id=admin.id,
    )
    students = query("select count(*) as count from users where role = 'mahasiswa'", user_id=admin.id)[0]["count"]
    return {
        "date_from": start, "date_to": end, "registered_students": students,
        "assessment_total": sum(row["count"] for row in severity),
        "severity_distribution": severity, "assessment_trend": trend,
        "booking_total": sum(row["count"] for row in bookings), "booking_status": bookings,
    }
