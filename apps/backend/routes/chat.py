from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import json

from auth import get_current_user
from core.db import db, query
from core.security import encrypt_text, decrypt_text
from services.chatbot.core import chat as chat_fn, semantic_router
from services.chatbot.guardrail import HARDCODED_RESPONSE
from services.chatbot.rag import retrieve_docs, stream_rag_response
from services.chatbot.conversational import stream_conversational_response

load_dotenv()

guardrail_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])
router_router = APIRouter(prefix="/router", tags=["Router"])
rag_router = APIRouter(prefix="/rag", tags=["RAG"])
chat_router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: Optional[list] = None


# ── DB helpers (all run as the requesting user, so RLS applies) ────────────────

def _ensure_session(session_id: str, user_id: str):
    query(
        "insert into chat_sessions (session_id, user_id) values (%s, %s) on conflict (session_id) do nothing",
        (session_id, user_id),
        user_id=user_id,
    )


def _save_messages(session_id: str, user_id: str, route: str, *turns: tuple[str, str]):
    """turns: (role, plaintext). Content is always stored encrypted."""
    with db(user_id) as conn:
        conn.cursor().executemany(
            "insert into messages (session_id, user_id, role, content, route_used) values (%s, %s, %s, %s, %s)",
            [(session_id, user_id, role, encrypt_text(text), route) for role, text in turns],
        )


def _log_guardrail(session_id: Optional[str], user_id: str, message: str):
    query(
        "insert into guardrail_logs (session_id, user_id, triggered_input) values (%s, %s, %s)",
        (session_id, user_id, message),
        user_id=user_id,
    )


def _decrypt(content: str) -> str:
    try:
        return decrypt_text(content)
    except Exception:
        return content


def _history(request: ChatRequest, user_id: str) -> list[dict]:
    """Conversation context for the LLM: client-sent history, else the stored session."""
    if request.history:
        return [
            {"role": m.get("role", "user"), "content": m.get("content", "")}
            for m in request.history
            if m.get("content")
        ]
    if not request.session_id:
        return []
    rows = query(
        "select role, content from messages where session_id = %s order by created_at limit 20",
        (request.session_id,),
        user_id=user_id,
    )
    return [{"role": r["role"], "content": _decrypt(r["content"])} for r in rows]


def _generate_session_title(session_id: str, user_id: str, first_message: str):
    try:
        rows = query("select title from chat_sessions where session_id = %s", (session_id,), user_id=user_id)
        if rows and not rows[0]["title"]:
            prompt = (
                "Buatkan satu judul singkat (maksimal 5 kata) untuk percakapan yang diawali dengan pesan "
                f"berikut: '{first_message}'. Hanya keluarkan judulnya saja tanpa tanda kutip atau penjelasan tambahan."
            )
            title = chat_fn(prompt).strip(" \n'\"")
            query("update chat_sessions set title = %s where session_id = %s", (title, session_id), user_id=user_id)
    except Exception:
        pass


# ── Routes ─────────────────────────────────────────────────────────────────────

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
    return {"context": [{"content": d["content"], "metadata": d.get("metadata", {})} for d in docs]}


@chat_router.post("/stream")
def stream_chat_response(request: ChatRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    uid = str(user.id)
    route = semantic_router(request.message).name or "conversational"

    def generate():
        # Guardrail: deterministic crisis response in one shot, never generated
        if route == "guardrail":
            yield f"data: {json.dumps({'token': HARDCODED_RESPONSE})}\n\n"
            _log_guardrail(request.session_id, uid, request.message)
            if request.session_id:
                _ensure_session(request.session_id, uid)
                _save_messages(request.session_id, uid, route, ("user", request.message), ("assistant", HARDCODED_RESPONSE))
            yield f"data: {json.dumps({'done': True, 'is_high_risk': True, 'route': 'guardrail'})}\n\n"
            return

        conv_history = _history(request, uid)

        if request.session_id:
            _ensure_session(request.session_id, uid)
            background_tasks.add_task(_generate_session_title, request.session_id, uid, request.message)
            _save_messages(request.session_id, uid, route, ("user", request.message))

        token_gen = (
            stream_rag_response(request.message, history=conv_history)
            if route == "rag"
            else stream_conversational_response(request.message, history=conv_history)
        )

        full_response = []
        try:
            for token in token_gen:
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        finally:
            # Persist the assistant turn even if the client disconnects mid-stream
            if request.session_id and full_response:
                _save_messages(request.session_id, uid, route, ("assistant", "".join(full_response)))

        yield f"data: {json.dumps({'done': True, 'is_high_risk': False, 'route': route})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


class ReportRequest(BaseModel):
    session_id: Optional[str] = None


@chat_router.post("/report")
def report_to_team(request: ReportRequest, user=Depends(get_current_user)):
    """User tapped "Kabari tim Sajiwa" in the crisis sheet. Logged as an unread safety
    signal, which the counselor dashboard surfaces under /admin/attention."""
    _log_guardrail(request.session_id, str(user.id), "[LAPORAN PENGGUNA] Minta dihubungi tim dari modal krisis")
    return {"status": "reported"}


@chat_router.get("/sessions")
def get_chat_sessions(user=Depends(get_current_user)):
    rows = query(
        "select session_id, user_id, title, started_at from chat_sessions where user_id = %s order by started_at desc",
        (str(user.id),),
        user_id=str(user.id),
    )
    return {"sessions": rows}


@chat_router.get("/history/{session_id}")
def get_chat_history(session_id: str, user=Depends(get_current_user)):
    rows = query(
        "select message_id as id, session_id, role, content, route_used, created_at "
        "from messages where session_id = %s and user_id = %s order by created_at",
        (session_id, str(user.id)),
        user_id=str(user.id),
    )
    for r in rows:
        r["content"] = _decrypt(r["content"])
    return {"messages": rows}


@chat_router.post("/history")
def save_chat_history(request: ChatRequest, user=Depends(get_current_user)):
    if not request.session_id:
        return {"status": "skipped", "reason": "no session_id"}
    uid = str(user.id)
    route_used = semantic_router(request.message).name or "conversational"
    response_text = chat_fn(request.message)
    _ensure_session(request.session_id, uid)
    _save_messages(request.session_id, uid, route_used, ("user", request.message), ("assistant", response_text))
    return {"status": "saved", "route": route_used, "response": response_text}


@chat_router.post("")
def chat_unified(request: ChatRequest, user=Depends(get_current_user)):
    uid = str(user.id)
    route = semantic_router(request.message).name or "conversational"
    is_high_risk = route == "guardrail"

    if is_high_risk:
        response_text = HARDCODED_RESPONSE
        _log_guardrail(request.session_id, uid, request.message)
    else:
        response_text = chat_fn(request.message, history=_history(request, uid))

    if request.session_id:
        _ensure_session(request.session_id, uid)
        _save_messages(request.session_id, uid, route, ("user", request.message), ("assistant", response_text))

    return {"response": response_text, "route": route, "is_high_risk": is_high_risk}
