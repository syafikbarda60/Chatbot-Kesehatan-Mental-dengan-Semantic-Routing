from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal

from auth import get_current_user, require_role
from core.db import query

router = APIRouter(tags=["Jadwal Konsultasi"])


class BuatJadwalRequest(BaseModel):
    tanggal: str
    waktu_mulai: str
    waktu_selesai: str


class BookingRequest(BaseModel):
    jadwal_id: str
    catatan: Optional[str] = None


class UpdateBookingRequest(BaseModel):
    status: Literal["menunggu", "dikonfirmasi", "selesai", "dibatalkan"]


class UpdateJadwalRequest(BaseModel):
    status: Literal["tersedia", "dipesan", "selesai", "dibatalkan"]


@router.post("/jadwal", status_code=status.HTTP_201_CREATED)
def buat_jadwal(
    request: BuatJadwalRequest,
    user=Depends(require_role("konselor", "admin")),
):
    rows = query(
        "insert into jadwal_konsultasi (konselor_id, tanggal, waktu_mulai, waktu_selesai, status) "
        "values (%s, %s, %s, %s, 'tersedia') returning *",
        (user.id, request.tanggal, request.waktu_mulai, request.waktu_selesai),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal membuat jadwal")
    return {"jadwal": rows[0], "message": "Jadwal berhasil dibuat"}


@router.get("/jadwal")
def lihat_jadwal_tersedia(user=Depends(get_current_user)):
    rows = query(
        "select jadwal_id, konselor_id, tanggal, waktu_mulai, waktu_selesai, status "
        "from jadwal_konsultasi where status = 'tersedia' order by tanggal",
        user_id=user.id,
    )
    return {"jadwal": rows}


@router.get("/jadwal/saya")
def lihat_jadwal_saya(user=Depends(require_role("konselor", "admin"))):
    rows = query(
        "select jadwal_id, tanggal, waktu_mulai, waktu_selesai, status "
        "from jadwal_konsultasi where konselor_id = %s order by tanggal desc",
        (user.id,),
        user_id=user.id,
    )
    return {"jadwal": rows}


@router.patch("/jadwal/{jadwal_id}")
def update_status_jadwal(
    jadwal_id: str,
    request: UpdateJadwalRequest,
    user=Depends(require_role("konselor", "admin")),
):
    rows = query(
        "update jadwal_konsultasi set status = %s where jadwal_id = %s and konselor_id = %s "
        "returning jadwal_id",
        (request.status, jadwal_id, user.id),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    return {"message": "Status jadwal diperbarui"}


@router.post("/booking", status_code=status.HTTP_201_CREATED)
def buat_booking(request: BookingRequest, user=Depends(get_current_user)):
    jadwal = query(
        "select status from jadwal_konsultasi where jadwal_id = %s",
        (request.jadwal_id,),
        user_id=user.id,
    )

    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    if jadwal[0]["status"] != "tersedia":
        raise HTTPException(status_code=409, detail="Jadwal sudah tidak tersedia")

    rows = query(
        "insert into booking_konsultasi (jadwal_id, user_id, catatan, status) "
        "values (%s, %s, %s, 'menunggu') returning *",
        (request.jadwal_id, user.id, request.catatan),
        user_id=user.id,
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal membuat booking")

    return {"booking": rows[0], "message": "Booking berhasil dibuat"}


def _embed_jadwal(row: dict) -> dict:
    return {
        "booking_id": row["booking_id"],
        "jadwal_id": row["jadwal_id"],
        "status": row["status"],
        "catatan": row["catatan"],
        "created_at": row["created_at"],
        "jadwal_konsultasi": {
            "tanggal": row["tanggal"],
            "waktu_mulai": row["waktu_mulai"],
            "waktu_selesai": row["waktu_selesai"],
            "konselor_id": row["konselor_id"],
        },
    }


@router.get("/booking/saya")
def lihat_booking_saya(user=Depends(get_current_user)):
    rows = query(
        "select b.booking_id, b.jadwal_id, b.status, b.catatan, b.created_at, "
        "j.tanggal, j.waktu_mulai, j.waktu_selesai, j.konselor_id "
        "from booking_konsultasi b join jadwal_konsultasi j on j.jadwal_id = b.jadwal_id "
        "where b.user_id = %s order by b.created_at desc",
        (user.id,),
        user_id=user.id,
    )
    return {"bookings": [_embed_jadwal(r) for r in rows]}


@router.get("/booking/masuk")
def lihat_booking_masuk(user=Depends(require_role("konselor", "admin"))):
    rows = query(
        "select b.booking_id, b.jadwal_id, b.status, b.catatan, b.created_at, "
        "j.tanggal, j.waktu_mulai, j.waktu_selesai, j.konselor_id "
        "from booking_konsultasi b join jadwal_konsultasi j on j.jadwal_id = b.jadwal_id "
        "where j.konselor_id = %s order by b.created_at desc",
        (user.id,),
        user_id=user.id,
    )
    return {"bookings": [_embed_jadwal(r) for r in rows]}


@router.patch("/booking/{booking_id}")
def update_status_booking(
    booking_id: str,
    request: UpdateBookingRequest,
    user=Depends(get_current_user),
):
    rows = query(
        "update booking_konsultasi set status = %s where booking_id = %s returning booking_id",
        (request.status, booking_id),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"message": f"Status booking diupdate ke '{request.status}'"}
