import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.db import query

load_dotenv()

SECRET = os.getenv("JWT_SECRET", "")
if not SECRET:
    raise RuntimeError("JWT_SECRET wajib diisi di .env")
ALGORITHM = "HS256"
EXPIRES_IN = int(os.getenv("JWT_EXPIRES_MINUTES", "10080")) * 60  # 7 hari

bearer_scheme = HTTPBearer()


@dataclass
class AuthUser:
    id: str
    email: str


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=EXPIRES_IN),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=[ALGORITHM])
        return AuthUser(id=payload["sub"], email=payload.get("email", ""))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kadaluarsa",
        )


def require_role(*roles: str):
    def _check(user: AuthUser = Depends(get_current_user)):
        rows = query("select role from users where user_id = %s", (user.id,), user_id=user.id)
        user_role = rows[0]["role"] if rows else "mahasiswa"
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Dibutuhkan role: {', '.join(roles)}",
            )
        return user

    return _check
