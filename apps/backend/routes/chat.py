from fastapi import APIRouter, Depends
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
from services.chatbot.rag import retrieve_docs

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

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
def stream_chat_response(request: ChatRequest, user=Depends(get_current_user)):
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

@chat_router.post("/history")
def save_chat_history(request: ChatRequest, user=Depends(get_current_user)):
    if not request.session_id:
        return {"status": "skipped", "reason": "no session_id"}

    result = semantic_router(request.message)
    route_used = result.name or "conversational"
    response_text = chat_fn(request.message)

    encrypted_user_msg = encrypt_text(request.message)
    encrypted_bot_msg = encrypt_text(response_text)

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
