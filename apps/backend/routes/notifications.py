"""The signed-in user's own notifications (students and counselors).

Rows are written only by database triggers (migration 011); RLS limits every read and update
to the owner, and the `user_id` filter below says the same thing out loud. Admins have their
own queue at /admin/notifications.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from core.db import query

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def own_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    user=Depends(get_current_user),
):
    where = "where user_id=%s and (%s=false or read_at is null)"
    rows = query(
        "select notification_id,category,title,body,target_path,entity_type,entity_id,read_at,created_at "
        "from notifications " + where + " order by created_at desc limit %s offset %s",
        (user.id, unread_only, page_size, (page - 1) * page_size), user_id=user.id,
    )
    unread = query("select count(*) total from notifications where user_id=%s and read_at is null",
                   (user.id,), user_id=user.id)[0]["total"]
    return {"notifications": rows, "unread": unread, "page": page, "page_size": page_size}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: UUID, user=Depends(get_current_user)):
    rows = query(
        "update notifications set read_at=coalesce(read_at,now()) where notification_id=%s and user_id=%s "
        "returning notification_id,read_at",
        (str(notification_id), user.id), user_id=user.id,
    )
    if not rows:
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    return {"notification": rows[0]}


@router.post("/mark-all-read")
def mark_all_read(user=Depends(get_current_user)):
    rows = query(
        "update notifications set read_at=now() where user_id=%s and read_at is null returning notification_id",
        (user.id,), user_id=user.id,
    )
    return {"updated": len(rows)}
