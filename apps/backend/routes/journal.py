from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal

from auth import get_current_user
from core.db import query

router = APIRouter(prefix="/journal", tags=["Journal"])


class SaveJournalRequest(BaseModel):
    content: str
    mood: Optional[Literal["Calm", "Anxious", "Focused", "Tired"]] = None


class UpdateJournalRequest(BaseModel):
    content: Optional[str] = None
    mood: Optional[Literal["Calm", "Anxious", "Focused", "Tired"]] = None


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
def get_journals(user=Depends(get_current_user), limit: int = 20, offset: int = 0):
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
        (user.id, f"{date.today().isoformat()}T00:00:00"),
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
