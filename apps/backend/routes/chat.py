from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv
import json
import logging

from auth import get_current_user
from core.security import decrypt_text, encrypt_text
from core.db import db, query
from services.chatbot.core import chat as chat_fn, chat_stream, semantic_router
from services.chatbot.guardrail import HARDCODED_RESPONSE
from services.chatbot.rag import retrieve_docs

load_dotenv()

guardrail_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])
router_router = APIRouter(prefix="/router", tags=["Router"])
rag_router = APIRouter(prefix="/rag", tags=["RAG"])
chat_router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    # MASVS-CODE-4: the app caps input at 500 characters; the server must not rely on that
    message: str = Field(max_length=1000)
    session_id: Optional[str] = None
    # No user_id: identity always comes from the JWT (`get_current_user`), never the body.

@guardrail_router.post("/check")
def check_safety_guardrail(request: ChatRequest):
    result = semantic_router(request.message)
    is_high_risk = result.name == "guardrail"
    return {
        "is_high_risk": is_high_risk,
        "route": result.name,
        "response": HARDCODED_RESPONSE if is_high_risk else None,
    }

@router_router.post("/intent")
def route_semantic_intent(request: ChatRequest):
    result = semantic_router(request.message)
    return {"route": result.name or "conversational"}

@rag_router.post("/context")
def retrieve_rag_context(request: ChatRequest, user=Depends(get_current_user)):
    docs = retrieve_docs(request.message)
    return {
        "context": [
            {"content": d["content"], "metadata": d.get("metadata", {})}
            for d in docs
        ]
    }

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@chat_router.post("/stream")
def stream_chat_response(request: ChatRequest, user=Depends(get_current_user)):
    """Real SSE: tokens as the model produces them. `[DONE]` terminates the stream."""
    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"
    is_high_risk = route == "guardrail"

    # The student's message is saved before generation, so an app kill mid-reply still keeps
    # the question in history; the reply row is appended once the answer completes.
    if request.session_id:
        try:
            with db(user.id) as conn:
                _persist_user_turn(conn, request, user.id, route, is_high_risk)
        except Exception:
            logging.exception("user turn not persisted (session_id=%s)", request.session_id)

    def generate():
        # Metadata first, so the client can raise the crisis card without waiting for tokens.
        yield _sse({"route": route, "is_high_risk": is_high_risk})

        parts = []
        try:
            for chunk in chat_stream(
                request.message,
                session_id=request.session_id,
                user_id=user.id,
                route=route,
            ):
                parts.append(chunk)
                yield _sse({"token": chunk})
        except Exception:
            # A truncated answer is not a turn: keep it out of history so the next request
            # re-asks rather than continuing from half a reply.
            yield _sse({"error": "generation_failed"})
            return

        response_text = "".join(parts)
        if request.session_id:
            try:
                with db(user.id) as conn:
                    _persist_assistant_turn(conn, request, user.id, route, response_text)
            except Exception:
                # The reply is already on the wire. Raising here aborts the chunked response
                # before its terminating chunk, so the client reports
                # ERR_INCOMPLETE_CHUNKED_ENCODING and throws away a complete answer. Log and
                # still close the stream; db() already rolled the half-written turn back.
                # No error frame: the client swaps the message for a failure fallback on
                # `error`, which would misreport an answer the user did receive.
                logging.exception("chat turn not persisted (session_id=%s)", request.session_id)

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

def _persist_user_turn(conn, request: ChatRequest, user_id, route: str, is_high_risk: bool):
    """Session row (idempotent), optional crisis log, and the student's message.

    On /chat/stream this runs before generation, so a killed stream still keeps the question.
    """
    # No title. It used to store the first 80 characters of the user's message in plaintext,
    # beside messages that are encrypted precisely so the database never holds what a
    # student wrote — anyone reading the table as the owner saw how every conversation
    # opened. /chat/sessions derives the label from the encrypted first message instead.
    conn.execute(
        "insert into sessions (session_id, user_id) values (%s, %s) "
        "on conflict (session_id) do nothing",
        (request.session_id, user_id),
    )
    if is_high_risk:
        conn.execute(
            "insert into guardrail_logs (session_id, user_id, triggered_input) "
            "values (%s, %s, %s)",
            (request.session_id, user_id, encrypt_text(request.message)),
        )
    conn.execute(
        "insert into messages (session_id, user_id, role, content, route_used) "
        "values (%s, %s, 'user', %s, %s)",
        (request.session_id, user_id, encrypt_text(request.message), route),
    )


def _persist_assistant_turn(conn, request: ChatRequest, user_id, route: str, response_text: str):
    conn.execute(
        "insert into messages (session_id, user_id, role, content, route_used) "
        "values (%s, %s, 'assistant', %s, %s)",
        (request.session_id, user_id, encrypt_text(response_text), route),
    )


def _persist_turn(conn, request: ChatRequest, user_id, route: str, response_text: str, is_high_risk: bool):
    """Both rows in one transaction — the non-streaming /chat path stays atomic."""
    _persist_user_turn(conn, request, user_id, route, is_high_risk)
    _persist_assistant_turn(conn, request, user_id, route, response_text)


class ReportRequest(BaseModel):
    session_id: Optional[str] = None


@chat_router.post("/report")
def report_to_team(request: ReportRequest, user=Depends(get_current_user)):
    """User tapped "Kabari tim Sajiwa" in the crisis sheet. Logged as an unread safety
    signal, which the counselor dashboard surfaces under /admin/attention."""
    query(
        "insert into guardrail_logs (session_id, user_id, triggered_input) values (%s, %s, %s)",
        (request.session_id, str(user.id), "[LAPORAN PENGGUNA] Minta dihubungi tim dari modal krisis"),
        user_id=user.id,
    )
    return {"status": "reported"}


@chat_router.post("")
def chat_unified(request: ChatRequest, user=Depends(get_current_user)):
    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"
    is_high_risk = route == "guardrail"

    if is_high_risk:
        response_text = HARDCODED_RESPONSE
    else:
        # Routed above, so chat() must not route again; it only loads history and generates.
        response_text = chat_fn(
            request.message,
            session_id=request.session_id,
            user_id=user.id,
            route=route,
        )

    if request.session_id:
        with db(user.id) as conn:
            _persist_turn(conn, request, user.id, route, response_text, is_high_risk)

    return {
        "response": response_text,
        "route": route,
        "is_high_risk": is_high_risk,
    }


@chat_router.get("/history")
def chat_history(session_id: str, limit: int = 50, user=Depends(get_current_user)):
    """The caller's own transcript. RLS scopes it to `user.id`; never expose this to admins."""
    rows = query(
        "select role, content, route_used, created_at from messages "
        "where session_id = %s order by created_at desc, role limit %s",
        (session_id, min(max(limit, 1), 200)), user_id=user.id,
    )

    # Fetched newest-first so a long conversation keeps its latest turns; flip back for the
    # transcript the client renders. `role` breaks ties: both rows of a turn share one
    # transaction timestamp, and 'assistant' sorts before 'user' newest-first — reversed, the
    # user turn lands before its reply.
    messages = []
    for row in reversed(rows):
        try:
            text = decrypt_text(row["content"])
        except Exception:
            continue
        messages.append({
            "role": row["role"],
            "text": text,
            "route": row["route_used"],
            "created_at": row["created_at"],
        })

    return {"session_id": session_id, "messages": messages}


SESSION_PREVIEW_CHARS = 80


@chat_router.get("/sessions")
def chat_sessions(limit: int = 30, user=Depends(get_current_user)):
    """The caller's own conversations, most recently active first, for the history drawer.

    Each one is labelled by its first user message, decrypted here: the plaintext never has
    to be stored to show a list. A conversation whose opening cannot be decrypted (written
    under another key) still appears, with no preview, rather than vanishing.
    """
    rows = query(
        "select s.session_id, s.started_at, "
        "  (select max(m.created_at) from messages m "
        "    where m.session_id = s.session_id and m.user_id = s.user_id) as last_message_at, "
        "  (select m.content from messages m "
        "    where m.session_id = s.session_id and m.user_id = s.user_id and m.role = 'user' "
        "    order by m.created_at asc limit 1) as first_message "
        "from sessions s "
        # RLS already limits this to the caller; the explicit filter keeps it true even for
        # a connection that bypasses RLS, and lets the planner use idx_sessions_user_id.
        "where s.user_id = %s "
        "order by last_message_at desc nulls last, s.started_at desc "
        "limit %s",
        (str(user.id), min(max(limit, 1), 100)),
        user_id=user.id,
    )

    sessions = []
    for row in rows:
        preview = None
        if row["first_message"]:
            try:
                preview = " ".join(decrypt_text(row["first_message"]).split())[:SESSION_PREVIEW_CHARS]
            except Exception:
                pass
        sessions.append({
            "session_id": row["session_id"],
            "preview": preview,
            "started_at": row["started_at"],
            "last_message_at": row["last_message_at"],
        })
    return {"sessions": sessions}
