from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from auth import get_current_user
from dotenv import load_dotenv
import os, json

from core.security import encrypt_text, decrypt_text
from services.chatbot.core import chat as chat_fn, semantic_router
from services.chatbot.guardrail import HARDCODED_RESPONSE
from services.chatbot.rag import retrieve_docs, stream_rag_response
from services.chatbot.conversational import stream_conversational_response
load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

def _ensure_session(session_id: str, user_id: str):
    try:
        supabase.table("chat_sessions").upsert({"session_id": session_id, "user_id": user_id}).execute()
    except Exception:
        pass

def _generate_session_title(session_id: str, first_message: str):
    try:
        res = supabase.table("chat_sessions").select("title").eq("session_id", session_id).execute()
        if res.data and not res.data[0].get("title"):
            prompt = f"Buatkan satu judul singkat (maksimal 5 kata) untuk percakapan yang diawali dengan pesan berikut: '{first_message}'. Hanya keluarkan judulnya saja tanpa tanda kutip atau penjelasan tambahan."
            title = chat_fn(prompt).strip(' \n\'"')
            supabase.table("chat_sessions").update({"title": title}).eq("session_id", session_id).execute()
    except Exception:
        pass

router = APIRouter(prefix="/chat" if False else "", tags=["Chat"])

# Sub-routers dibagi prefix agar tidak tumpang tindih
guardrail_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])
router_router = APIRouter(prefix="/router", tags=["Router"])
rag_router = APIRouter(prefix="/rag", tags=["RAG"])
chat_router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None

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

@chat_router.post("/stream")
def stream_chat_response(request: ChatRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"

    def generate():
        # Guardrail: kirim satu shot, tidak perlu stream
        if route == "guardrail":
            yield f"data: {json.dumps({'token': HARDCODED_RESPONSE})}\n\n"
            if request.session_id:
                _ensure_session(request.session_id, str(user.id))
                supabase.table("guardrail_logs").insert({
                    "session_id": request.session_id,
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
            _ensure_session(request.session_id, str(user.id))
            background_tasks.add_task(_generate_session_title, request.session_id, request.message)
            complete_text = "".join(full_response)
            supabase.table("messages").insert([
                {
                    "session_id": request.session_id,
                    "user_id": str(user.id),
                    "role": "user",
                    "content": encrypt_text(request.message),
                    "route_used": route,
                },
                {
                    "session_id": request.session_id,
                    "user_id": str(user.id),
                    "role": "assistant",
                    "content": encrypt_text(complete_text),
                    "route_used": route,
                },
            ]).execute()

        yield f"data: {json.dumps({'done': True, 'is_high_risk': False, 'route': route})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@chat_router.get("/sessions")
def get_chat_sessions(user=Depends(get_current_user)):
    res = supabase.table("chat_sessions").select("*").eq("user_id", str(user.id)).order("started_at", desc=True).execute()
    return {"sessions": res.data}

@chat_router.get("/history/{session_id}")
def get_chat_history(session_id: str, user=Depends(get_current_user)):
    res = supabase.table("messages").select("*").eq("session_id", session_id).eq("user_id", str(user.id)).order("created_at").execute()
    messages = []
    for m in res.data:
        try:
            m["content"] = decrypt_text(m["content"])
        except Exception:
            pass
        messages.append(m)
    return {"messages": messages}

@chat_router.post("/history")
def save_chat_history(request: ChatRequest, user=Depends(get_current_user)):
    if not request.session_id:
        return {"status": "skipped", "reason": "no session_id"}

    result = semantic_router(request.message)
    route_used = result.name or "conversational"
    response_text = chat_fn(request.message)

    encrypted_user_msg = encrypt_text(request.message)
    encrypted_bot_msg = encrypt_text(response_text)

    _ensure_session(request.session_id, str(user.id))

    supabase.table("messages").insert({
        "session_id": request.session_id,
        "user_id": str(user.id),
        "role": "user",
        "content": encrypted_user_msg,
        "route_used": route_used,
    }).execute()

    supabase.table("messages").insert({
        "session_id": request.session_id,
        "user_id": str(user.id),
        "role": "assistant",
        "content": encrypted_bot_msg,
        "route_used": route_used,
    }).execute()

    return {"status": "saved", "route": route_used, "response": response_text}

@chat_router.post("")
def chat_unified(request: ChatRequest, user=Depends(get_current_user)):
    route_result = semantic_router(request.message)
    route = route_result.name or "conversational"
    is_high_risk = route == "guardrail"

    if is_high_risk:
        response_text = HARDCODED_RESPONSE
        if request.session_id:
            _ensure_session(request.session_id, str(user.id))
            supabase.table("guardrail_logs").insert({
                "session_id": request.session_id,
                "triggered_input": request.message,
            }).execute()
    else:
        response_text = chat_fn(request.message)

    if request.session_id:
        _ensure_session(request.session_id, str(user.id))
        supabase.table("messages").insert([
            {
                "session_id": request.session_id,
                "user_id": str(user.id),
                "role": "user",
                "content": encrypt_text(request.message),
                "route_used": route,
            },
            {
                "session_id": request.session_id,
                "user_id": str(user.id),
                "role": "assistant",
                "content": encrypt_text(response_text),
                "route_used": route,
            },
        ]).execute()

    return {
        "response": response_text,
        "route": route,
        "is_high_risk": is_high_risk,
    }
