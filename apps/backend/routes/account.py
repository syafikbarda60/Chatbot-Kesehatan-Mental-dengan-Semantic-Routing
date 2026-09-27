from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone
import os, uuid, secrets

import bcrypt
from dotenv import load_dotenv
from psycopg.errors import UniqueViolation

from auth import require_role, get_current_user, create_token, EXPIRES_IN
from core.db import db, query

load_dotenv()

router = APIRouter(tags=["Account"])


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify(pw: str, hashed: Optional[str]) -> bool:
    return bool(hashed) and bcrypt.checkpw(pw.encode(), hashed.encode())


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateAccountRequest(BaseModel):
    email: EmailStr
    password: str
    nama: str
    role: Literal["mahasiswa", "konselor", "admin", "pemangku_jabatan"] = "mahasiswa"
    nim: Optional[str] = None


class UpdateAccountRequest(BaseModel):
    nama: Optional[str] = None
    role: Optional[Literal["mahasiswa", "konselor", "admin", "pemangku_jabatan"]] = None
    nim: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class ConfirmPasswordResetRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(request: CreateAccountRequest):
    user_id = str(uuid.uuid4())
    try:
        with db(user_id) as conn:
            conn.execute(
                "insert into users (user_id, email, nama, nim, role, password_hash) "
                "values (%s, %s, %s, %s, 'mahasiswa', %s)",
                (user_id, request.email, request.nama, request.nim, _hash(request.password)),
            )
    except UniqueViolation:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    token = create_token(user_id, request.email)
    return {
        "user_id": user_id,
        "message": "Registrasi berhasil. Silakan login dengan akun kamu.",
        "session": {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": EXPIRES_IN,
        },
    }


@router.post("/auth/login")
def login(request: LoginRequest):
    rows = query(
        "select user_id, email, nama, nim, role, password_hash "
        "from auth_lookup(%s)",
        (request.email,),
    )
    user = rows[0] if rows else None

    if not user or not _verify(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
        )

    user_id = str(user["user_id"])
    token = create_token(user_id, user["email"])

    return {
        "access_token": token,
        "refresh_token": "",
        "token_type": "bearer",
        "expires_in": EXPIRES_IN,
        "user": {
            "user_id": user_id,
            "email": user["email"],
            "nama": user["nama"],
            "nim": user["nim"],
            "role": user["role"],
        },
    }


@router.post("/auth/reset-password/request")
def request_password_reset(request: ResetPasswordRequest):
    rows = query("select user_id from auth_lookup(%s)", (request.email,))
    if rows:
        otp = f"{secrets.randbelow(1000000):06d}"
        query(
            "insert into password_resets (email, otp_hash, expires_at) "
            "values (%s, %s, now() + interval '15 minutes') "
            "on conflict (email) do update set otp_hash = excluded.otp_hash, "
            "expires_at = excluded.expires_at, used = false",
            (request.email, _hash(otp)),
        )
        # ponytail: no SMTP wired; OTP goes to the server log. Add email delivery before prod.
        print(f"[reset-password] OTP untuk {request.email}: {otp}")

    return {"message": "Jika email terdaftar, OTP telah dikirimkan."}


@router.post("/auth/reset-password/confirm")
def confirm_password_reset(request: ConfirmPasswordResetRequest):
    rows = query(
        "select otp_hash, expires_at, used from password_resets where email = %s",
        (request.email,),
    )
    rec = rows[0] if rows else None
    if (
        not rec
        or rec["used"]
        or rec["expires_at"] < datetime.now(timezone.utc)
        or not _verify(request.otp, rec["otp_hash"])
    ):
        raise HTTPException(status_code=400, detail="OTP salah atau kedaluwarsa")

    users = query("select user_id from auth_lookup(%s)", (request.email,))
    if not users:
        raise HTTPException(status_code=400, detail="OTP salah atau kedaluwarsa")

    user_id = str(users[0]["user_id"])
    query("select set_password(%s, %s)", (user_id, _hash(request.new_password)))
    query(
        "update password_resets set used = true where email = %s",
        (request.email,),
    )

    return {"message": "Password berhasil diubah. Silakan login kembali."}


@router.get("/auth/me")
def get_my_profile(user=Depends(get_current_user)):
    rows = query("select * from users where user_id = %s", (user.id,), user_id=user.id)
    if not rows:
        raise HTTPException(status_code=404, detail="Profil tidak ditemukan")
    rows[0].pop("password_hash", None)
    return rows[0]


@router.get("/accounts")
def get_account_list(admin=Depends(require_role("admin", "pemangku_jabatan"))):
    try:
        rows = query(
            "select user_id, nama, email, nim, role, created_at from users "
            "order by created_at desc",
            user_id=admin.id,
        )
        return {"users": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil daftar akun: {e}")


@router.get("/accounts/konselor")
def get_konselor_list(user=Depends(get_current_user)):
    """Counselor directory for the booking screen (public fields only, via list_konselor())."""
    rows = query("select user_id, nama, role from list_konselor()", user_id=user.id)
    return {"users": rows, "total": len(rows)}


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
def create_account(request: CreateAccountRequest, admin=Depends(require_role("admin", "pemangku_jabatan"))):
    user_id = str(uuid.uuid4())
    try:
        with db(admin.id) as conn:
            conn.execute(
                "insert into users (user_id, nama, email, nim, role, password_hash) "
                "values (%s, %s, %s, %s, %s, %s)",
                (
                    user_id,
                    request.nama,
                    request.email,
                    request.nim,
                    request.role,
                    _hash(request.password),
                ),
            )
    except UniqueViolation:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    return {
        "user_id": user_id,
        "email": request.email,
        "nama": request.nama,
        "role": request.role,
        "message": "Akun berhasil dibuat",
    }


@router.put("/accounts/{user_id}")
def update_account(
    user_id: str,
    request: UpdateAccountRequest,
    admin=Depends(require_role("admin", "pemangku_jabatan")),
):
    try:
        if request.nama is None and request.role is None and request.nim is None:
            return {"message": "Tidak ada data yang diubah"}

        rows = query(
            "update users set nama = coalesce(%s, nama), role = coalesce(%s, role), "
            "nim = coalesce(%s, nim) where user_id = %s returning user_id",
            (request.nama, request.role, request.nim, user_id),
            user_id=admin.id,
        )

        if not rows:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")

        return {"message": "Akun berhasil diperbarui", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal memperbarui akun: {e}")


@router.delete("/accounts/{user_id}", status_code=status.HTTP_200_OK)
def delete_account(user_id: str, admin=Depends(require_role("admin", "pemangku_jabatan"))):
    try:
        rows = query(
            "delete from users where user_id = %s returning user_id",
            (user_id,),
            user_id=admin.id,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        return {"message": "Akun berhasil dihapus", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal menghapus akun: {e}")
