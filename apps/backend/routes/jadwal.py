from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal

from auth import get_current_user, require_role
from core.db import query

router = APIRouter(tags=["Jadwal Konsultasi"])


class BuatJadwalRequest(BaseModel):
    date: str
    start_time: str
    end_time: str


class BookingRequest(BaseModel):
    counseling_slot_id: str
    notes: Optional[str] = None


class UpdateBookingRequest(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled"]


class UpdateJadwalRequest(BaseModel):
    status: Literal["available", "booked", "completed", "cancelled"]


@router.post("/jadwal", status_code=status.HTTP_201_CREATED)
def buat_jadwal(
    request: BuatJadwalRequest,
    user=Depends(require_role("konselor", "admin")),
):
    rows = query(
        "insert into counseling_slots (counselor_id, date, start_time, end_time, status) "
        "values (%s, %s, %s, %s, 'available') returning *",
        (user.id, request.date, request.start_time, request.end_time),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal membuat jadwal")
    return {"jadwal": rows[0], "message": "Jadwal berhasil dibuat"}


@router.get("/jadwal")
def lihat_jadwal_tersedia(user=Depends(get_current_user)):
    rows = query(
        "select counseling_slot_id, counselor_id, date, start_time, end_time, status "
        "from counseling_slots where status = 'available' order by date",
        user_id=user.id,
    )
    return {"jadwal": rows}


@router.get("/jadwal/saya")
def lihat_jadwal_saya(user=Depends(require_role("konselor", "admin"))):
    rows = query(
        "select counseling_slot_id, date, start_time, end_time, status "
        "from counseling_slots where counselor_id = %s order by date desc",
        (user.id,),
        user_id=user.id,
    )
    return {"jadwal": rows}


@router.patch("/jadwal/{counseling_slot_id}")
def update_status_jadwal(
    counseling_slot_id: str,
    request: UpdateJadwalRequest,
    user=Depends(require_role("konselor", "admin")),
):
    rows = query(
        "update counseling_slots set status = %s where counseling_slot_id = %s and counselor_id = %s "
        "returning counseling_slot_id",
        (request.status, counseling_slot_id, user.id),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    return {"message": "Status jadwal diperbarui"}


@router.post("/booking", status_code=status.HTTP_201_CREATED)
def buat_booking(request: BookingRequest, user=Depends(get_current_user)):
    jadwal = query(
        "select status from counseling_slots where counseling_slot_id = %s",
        (request.counseling_slot_id,),
        user_id=user.id,
    )

    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    if jadwal[0]["status"] != "available":
        raise HTTPException(status_code=409, detail="Jadwal sudah tidak tersedia")

    rows = query(
        "insert into counseling_bookings (counseling_slot_id, student_id, notes, status) "
        "values (%s, %s, %s, 'pending') returning *",
        (request.counseling_slot_id, user.id, request.notes),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal membuat booking")

    return {"booking": rows[0], "message": "Booking berhasil dibuat"}


def _embed_jadwal(row: dict) -> dict:
    return {
        "counseling_booking_id": row["counseling_booking_id"],
        "counseling_slot_id": row["counseling_slot_id"],
        "status": row["status"],
        "notes": row["notes"],
        "created_at": row["created_at"],
        "counseling_slots": {
            "date": row["date"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "counselor_id": row["counselor_id"],
        },
    }


@router.get("/booking/saya")
def lihat_booking_saya(user=Depends(get_current_user)):
    rows = query(
        "select b.counseling_booking_id, b.counseling_slot_id, b.status, b.notes, b.created_at, "
        "j.date, j.start_time, j.end_time, j.counselor_id "
        "from counseling_bookings b join counseling_slots j on j.counseling_slot_id = b.counseling_slot_id "
        "where b.student_id = %s order by b.created_at desc",
        (user.id,),
        user_id=user.id,
    )
    return {"bookings": [_embed_jadwal(r) for r in rows]}


@router.get("/booking/masuk")
def lihat_booking_masuk(user=Depends(require_role("konselor", "admin"))):
    rows = query(
        "select b.counseling_booking_id, b.counseling_slot_id, b.status, b.notes, b.created_at, "
        "j.date, j.start_time, j.end_time, j.counselor_id "
        "from counseling_bookings b join counseling_slots j on j.counseling_slot_id = b.counseling_slot_id "
        "where j.counselor_id = %s order by b.created_at desc",
        (user.id,),
        user_id=user.id,
    )
    return {"bookings": [_embed_jadwal(r) for r in rows]}


@router.patch("/booking/{counseling_booking_id}")
def update_status_booking(
    counseling_booking_id: str,
    request: UpdateBookingRequest,
    user=Depends(get_current_user),
):
    rows = query(
        "update counseling_bookings set status = %s where counseling_booking_id = %s returning counseling_booking_id",
        (request.status, counseling_booking_id),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"message": f"Status booking diupdate ke '{request.status}'"}
