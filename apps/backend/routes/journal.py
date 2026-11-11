from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional, Literal

from auth import get_current_user
from core.db import query

router = APIRouter(prefix="/journal", tags=["Journal"])


# MASVS-CODE-4: bound what a client may send; a 1 MB entry used to be stored as is.
JOURNAL_MAX_CHARS = 10_000


class SaveJournalRequest(BaseModel):
    content: str = Field(max_length=JOURNAL_MAX_CHARS)
    mood: Optional[Literal["calm", "anxious", "focused", "tired"]] = None


class UpdateJournalRequest(BaseModel):
    content: Optional[str] = Field(default=None, max_length=JOURNAL_MAX_CHARS)
    mood: Optional[Literal["calm", "anxious", "focused", "tired"]] = None


@router.post("", status_code=status.HTTP_201_CREATED)
def save_journal(request: SaveJournalRequest, user=Depends(get_current_user)):
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Konten jurnal tidak boleh kosong")

    rows = query(
        "insert into journals (user_id, content, mood) values (%s, %s, %s) "
        "returning journal_id, content, mood, created_at, updated_at",
        (user.id, request.content.strip(), request.mood),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=500, detail="Gagal menyimpan jurnal")

    return {"journal": rows[0], "message": "Jurnal berhasil disimpan"}


@router.get("")
def get_journals(
    user=Depends(get_current_user),
    # A negative limit reached SQL and came back as a 500
    limit: int = Query(20, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    journals = query(
        "select journal_id, content, mood, created_at, updated_at from journals "
        "where user_id = %s order by created_at desc limit %s offset %s",
        (user.id, limit, offset),
        user_id=user.id,
    )
    return {"journals": journals, "total": len(journals)}


@router.get("/today")
def get_today_journal(user=Depends(get_current_user)):
    rows = query(
        "select journal_id, content, mood, created_at from journals "
        "where user_id = %s and created_at >= %s order by created_at desc limit 1",
        # Offset-aware: `date.today()` is the server's local day, but a bare timestamp would be
        # read in the DB session's timezone (UTC here), shifting the boundary for WIB mornings.
        (user.id, datetime.combine(date.today(), time.min).astimezone().isoformat()),
        user_id=user.id,
    )
    return {"journal": rows[0] if rows else None}


@router.patch("/{journal_id}")
def update_journal(
    journal_id: str,
    request: UpdateJournalRequest,
    user=Depends(get_current_user),
):
    if request.content is None and request.mood is None:
        return {"message": "Tidak ada yang diubah"}

    rows = query(
        "update journals set content = coalesce(%s, content), mood = coalesce(%s, mood) "
        "where journal_id = %s and user_id = %s "
        "returning journal_id, content, mood, created_at, updated_at",
        (
            request.content.strip() if request.content is not None else None,
            request.mood,
            journal_id,
            user.id,
        ),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Jurnal tidak ditemukan")
    return {"journal": rows[0], "message": "Jurnal diperbarui"}


@router.delete("/{journal_id}", status_code=status.HTTP_200_OK)
def delete_journal(journal_id: str, user=Depends(get_current_user)):
    rows = query(
        "delete from journals where journal_id = %s and user_id = %s returning journal_id",
        (journal_id, user.id),
        user_id=user.id,
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Jurnal tidak ditemukan")
    return {"message": "Jurnal dihapus"}
