"""Live change notices for the dashboard: WebSocket /realtime.

A notice names only the area that changed ("signals", "requests", "schedule"), never a row, a
name or a score. The dashboard answers it by refetching through the REST routes, so their role
checks and caseload scoping stay the only gate on student data, and a delivery mistake here can
leak "something changed" at most.
"""
import asyncio
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

import jwt
import psycopg

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials

import auth

router = APIRouter(tags=["Realtime"])
logger = logging.getLogger(__name__)

# db/migrations/009_realtime_notify.sql sends the written table's name on this channel
CHANNEL = "sajiwa_changes"

AUTH_TIMEOUT_SECONDS = 10
# 4401/4403 tell the dashboard not to reconnect: the session, not the network, is the problem
CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403
# Staff who work the queue and the calendar. Stakeholders read aggregates only, so they poll.
LISTENER_ROLES = {"admin", "konselor"}

# Table written -> dashboard area. A table not listed here never produces a notice.
TOPICS = {
    "guardrail_logs": "signals",
    "assessment_category_results": "signals",
    "counseling_requests": "requests",
    "counseling_appointments": "schedule",
    "counselor_blocked_periods": "schedule",
    "counselor_exception_requests": "schedule",
    # Each bell refetches its own list; the notice never says whose list changed
    "notifications": "notifications",
    "admin_notifications": "notifications",
}

# websocket -> (the event loop serving it, so publish() works from any thread; token expiry)
_clients: dict[WebSocket, tuple[asyncio.AbstractEventLoop, float]] = {}


def _authenticate(token: str) -> tuple[auth.AuthUser, float]:
    user = auth.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    expires_at = jwt.decode(token, auth.SECRET, algorithms=[auth.ALGORITHM])["exp"]
    return user, expires_at


@router.websocket("/realtime")
async def realtime(ws: WebSocket):
    await ws.accept()
    # The token arrives in the first message rather than the URL, which would put it in every
    # access log. Browsers cannot set an Authorization header on a WebSocket.
    try:
        first = await asyncio.wait_for(ws.receive_json(), AUTH_TIMEOUT_SECONDS)
        token = first.get("token") if isinstance(first, dict) and first.get("type") == "auth" else None
        if not isinstance(token, str):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED)
        user, expires_at = await run_in_threadpool(_authenticate, token)
    except (HTTPException, asyncio.TimeoutError, ValueError):
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return
    if user.role not in LISTENER_ROLES:
        await ws.close(code=CLOSE_FORBIDDEN)
        return
    _clients[ws] = (asyncio.get_running_loop(), expires_at)
    await ws.send_json({"type": "ready"})
    try:
        while True:
            await ws.receive_text()  # clients have nothing to say; this only waits for the disconnect
    except WebSocketDisconnect:
        pass
    finally:
        _clients.pop(ws, None)


def publish(table: str) -> None:
    """Tell every connected client which area `table` belongs to. Safe to call from any thread."""
    topic = TOPICS.get(table)
    if topic is None:
        return
    now = time.time()
    for ws, (loop, expires_at) in list(_clients.items()):
        if now >= expires_at:
            # The REST routes would refuse this token now; the socket must not outlive it either.
            _clients.pop(ws, None)
            asyncio.run_coroutine_threadsafe(ws.close(code=CLOSE_UNAUTHORIZED), loop)
        else:
            asyncio.run_coroutine_threadsafe(ws.send_json({"type": "changed", "topic": topic}), loop)


def listen_for_changes(stop: threading.Event) -> None:
    """Forward the database's change notices to publish() until `stop` is set.

    A plain thread with a blocking connection, because psycopg's async connections cannot run
    on the Proactor event loop uvicorn uses on Windows. Each API process listens for itself.
    """
    while not stop.is_set():
        try:
            with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
                conn.execute(f"listen {CHANNEL}")
                while not stop.is_set():
                    for notice in conn.notifies(timeout=1.0):
                        publish(notice.payload)
        except psycopg.Error:
            # The dashboard keeps working without notices (it also refreshes on its own),
            # so a lost database connection is a warning and a retry, never a crash.
            logger.warning("realtime: database listener disconnected, retrying in 5s", exc_info=True)
            stop.wait(5)


@asynccontextmanager
async def lifespan(_app):
    stop = threading.Event()
    threading.Thread(target=listen_for_changes, args=(stop,), name="realtime-listener", daemon=True).start()
    yield
    stop.set()
