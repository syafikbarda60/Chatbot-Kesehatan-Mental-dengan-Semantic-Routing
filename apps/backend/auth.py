from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

bearer_scheme = HTTPBearer()


import jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """Verify Supabase JWT token, ignoring expiration so mobile users stay logged in."""
    token = credentials.credentials
    try:
        # Decode without verifying expiration
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False}
        )
        if "sub" not in payload:
            raise Exception("No subject in token")
            
        class DummyUser:
            def __init__(self, user_id, email, metadata):
                self.id = user_id
                self.email = email
                self.user_metadata = metadata

        return DummyUser(
            user_id=payload["sub"], 
            email=payload.get("email", ""),
            metadata=payload.get("user_metadata", {})
        )
    except Exception as e:
        print(f"Token decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid",
        )


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
):
    """Same as get_current_user but returns None if no token provided."""
    if credentials is None:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False}
        )
        class DummyUser:
            def __init__(self, user_id, email, metadata):
                self.id = user_id
                self.email = email
                self.user_metadata = metadata

        return DummyUser(
            user_id=payload["sub"], 
            email=payload.get("email", ""),
            metadata=payload.get("user_metadata", {})
        )
    except Exception:
        return None


def require_role(*roles: str):
    """Dependency factory: raise 403 if user role not in allowed roles.
    Query tabel users untuk role (lebih reliable dari JWT metadata).
    """

    def _check(user=Depends(get_current_user)):
        # Ambil role dari tabel users (sesuai ERD)
        try:
            profile = supabase.table("users").select("role").eq(
                "user_id", str(user.id)
            ).maybe_single().execute()
            user_role = (profile.data or {}).get("role", "mahasiswa")
        except Exception:
            # Fallback ke JWT metadata
            user_role = (user.user_metadata or {}).get("role", "mahasiswa")

        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Dibutuhkan role: {', '.join(roles)}",
            )
        return user

    return _check
