from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from cryptography.fernet import Fernet
from auth import get_current_user
from dotenv import load_dotenv
import os, json, sys

load_dotenv()

# ── Supabase & encryption ────────────────────────────────────────────────────
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

_raw_key = os.getenv("ENCRYPTION_KEY")
if _raw_key:
    fernet = Fernet(_raw_key.encode())
else:
    # Generate satu kali dan print peringatan — simpan ke .env segera
    _generated = Fernet.generate_key()
    print(
        f"[WARNING] ENCRYPTION_KEY tidak ditemukan di .env. "
        f"Gunakan key berikut:\nENCRYPTION_KEY={_generated.decode()}",
        file=sys.stderr,
    )
    fernet = Fernet(_generated)


def _encrypt(text: str) -> str:
    return fernet.encrypt(text.encode()).decode()


def _decrypt(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


# ── Semantic router & LLM (lazy import agar tidak circular) ─────────────────
def _get_chat_core():
    """Import main.py chat() dan router secara lazy."""
    import importlib, sys
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    mod = importlib.import_module("main")
    return mod.chat, mod.router


router = APIRouter(prefix="/chat" if False else "", tags=["Chat"])

# Sub-routers dibagi prefix agar tidak tumpang tindih
guardrail_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])
router_router = APIRouter(prefix="/router", tags=["Router"])
rag_router = APIRouter(prefix="/rag", tags=["RAG"])
chat_router = APIRouter(prefix="/chat", tags=["Chat"])


# ── Schema ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None


# ── CB-04: checkSafetyGuardrail ──────────────────────────────────────────────

@guardrail_router.post("/check")
def check_safety_guardrail(request: ChatRequest):
    """
    CB-04 — Query similarity search ke semantic-router untuk mendeteksi
    indikasi self-harm sebelum memproses pesan chatbot.
    """
    from routes.guardrail import HARDCODED_RESPONSE
    chat_fn, semantic_router = _get_chat_core()
    result = semantic_router(request.message)
    is_high_risk = result.name == "guardrail"
    return {
        "is_high_risk": is_high_risk,
        "route": result.name,
        "response": HARDCODED_RESPONSE if is_high_risk else None,
    }


# ── CB-05: routeSemanticIntent ───────────────────────────────────────────────

@router_router.post("/intent")
def route_semantic_intent(request: ChatRequest):
    """
    CB-05 — Gunakan semantic-router untuk memilih jalur: edukasi (rag)
    atau emosional (conversational) atau guardrail.
    """
    _, semantic_router = _get_chat_core()
    result = semantic_router(request.message)
    return {"route": result.name or "conversational"}


# ── CB-06: retrieveRAGContext ────────────────────────────────────────────────

@rag_router.post("/context")
def retrieve_rag_context(request: ChatRequest, user=Depends(get_current_user)):
    """
    CB-06 — ANN search pada PostgreSQL pgvector untuk mengambil
    dokumen referensi medis tervalidasi.
    """
    from routes.rag import retrieve_docs
    docs = retrieve_docs(request.message)
    return {
        "context": [
            {"content": d["content"], "metadata": d.get("metadata", {})}
            for d in docs
        ]
    }


# ── CB-07: streamChatResponse ────────────────────────────────────────────────

@chat_router.post("/stream")
def stream_chat_response(request: ChatRequest, user=Depends(get_current_user)):
    """
    CB-07 — Stream respons AI per token via SSE.
    Guardrail check → semantic route → stream dari LLM (conversational/RAG).
    """
    from routes.guardrail import HARDCODED_RESPONSE
    from routes.conversational import stream_conversational_response
    from routes.rag import stream_rag_response

    _, semantic_router = _get_chat_core()
    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"

    def generate():
        # Guardrail: kirim satu shot, tidak perlu stream
        if route == "guardrail":
            yield f"data: {json.dumps({'token': HARDCODED_RESPONSE})}\n\n"
            if request.session_id:
                supabase.table("guardrail_logs").insert({
                    "session_id": request.session_id,
                    "user_id": str(user.id),
                    "triggered_input": request.message,
                }).execute()
            yield f"data: {json.dumps({'done': True, 'is_high_risk': True, 'route': 'guardrail'})}\n\n"
            return

        # Pick stream generator berdasarkan route
        if route == "rag":
            token_gen = stream_rag_response(request.message)
        else:
            token_gen = stream_conversational_response(request.message)

        full_response = []
        for token in token_gen:
            full_response.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        # Save history setelah stream selesai
        if request.session_id:
            complete_text = "".join(full_response)
            supabase.table("messages").insert([
                {
                    "session_id": request.session_id,
                    "user_id": str(user.id),
                    "role": "user",
                    "content": _encrypt(request.message),
                    "route_used": route,
                },
                {
                    "session_id": request.session_id,
                    "user_id": str(user.id),
                    "role": "assistant",
                    "content": _encrypt(complete_text),
                    "route_used": route,
                },
            ]).execute()

        yield f"data: {json.dumps({'done': True, 'is_high_risk': False, 'route': route})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx: disable buffering
        },
    )


# ── CB-08: saveChatHistory ───────────────────────────────────────────────────

@chat_router.post("/history")
def save_chat_history(request: ChatRequest, user=Depends(get_current_user)):
    """
    CB-08 — Simpan log percakapan antara mahasiswa dan chatbot ke dalam
    basis data dengan enkripsi JSONB (Fernet/AES-GCM).
    """
    if not request.session_id:
        return {"status": "skipped", "reason": "no session_id"}

    chat_fn, semantic_router = _get_chat_core()
    result = semantic_router(request.message)
    route_used = result.name or "conversational"
    response_text = chat_fn(request.message)

    # Enkripsi content, simpan sebagai text (sesuai kolom existing)
    encrypted_user_msg = _encrypt(request.message)
    encrypted_bot_msg = _encrypt(response_text)

    supabase.table("messages").insert({
        "session_id": request.session_id,
        "user_id": str(user.id),
        "role": "user",
        "content": encrypted_user_msg,   # text, bukan jsonb
        "route_used": route_used,
    }).execute()

    supabase.table("messages").insert({
        "session_id": request.session_id,
        "user_id": str(user.id),
        "role": "assistant",
        "content": encrypted_bot_msg,   # text, bukan jsonb
        "route_used": route_used,
    }).execute()

    return {"status": "saved", "route": route_used, "response": response_text}


# ── Unified chat endpoint (shortcut CB-04+05+07+08) ─────────────────────────

@chat_router.post("")
def chat_unified(request: ChatRequest, user=Depends(get_current_user)):
    """Unified: guardrail check → route → stream → save history."""
    from routes.guardrail import HARDCODED_RESPONSE
    chat_fn, semantic_router = _get_chat_core()

    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"
    is_high_risk = route == "guardrail"

    if is_high_risk:
        response_text = HARDCODED_RESPONSE
        if request.session_id:
            supabase.table("guardrail_logs").insert({
                "session_id": request.session_id,
                "user_id": str(user.id),
                "triggered_input": request.message,
            }).execute()
    else:
        response_text = chat_fn(request.message)

    if request.session_id:
        supabase.table("messages").insert([
            {
                "session_id": request.session_id,
                "user_id": str(user.id),
                "role": "user",
                "content": _encrypt(request.message),   # text
                "route_used": route,
            },
            {
                "session_id": request.session_id,
                "user_id": str(user.id),
                "role": "assistant",
                "content": _encrypt(response_text),     # text
                "route_used": route,
            },
        ]).execute()

    return {
        "response": response_text,
        "route": route,
        "is_high_risk": is_high_risk,
    }
