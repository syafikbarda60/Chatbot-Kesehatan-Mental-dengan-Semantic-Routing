"""
Sanctuary Backend — FastAPI Application Entry Point
Semua 14 endpoint CB-01..CB-14 terdaftar di sini.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

# ── Import routers ────────────────────────────────────────────────────────────
from routes.assessment import router as assessment_router
from routes.account import router as account_router
from routes.dashboard import router as dashboard_router
from routes.jadwal import router as jadwal_router
from routes.journal import router as journal_router

# Chat sub-routers (CB-04..CB-08)
from routes.chat import (
    guardrail_router,   # /guardrail/check (CB-04)
    router_router,      # /router/intent   (CB-05)
    rag_router,         # /rag/context     (CB-06)
    chat_router,        # /chat/stream, /chat/history, /chat (CB-07,08)
)

# Guardrail hotline endpoint (CB-03) — mount langsung di app karena prefix beda
from fastapi import APIRouter
from services.chatbot.guardrail import get_hotlines_from_db

hotline_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])

@hotline_router.get("/hotline")
def get_emergency_hotline():
    """CB-03 — Ambil daftar kontak layanan darurat (hotline) dari basis data."""
    return {"hotlines": get_hotlines_from_db()}


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sanctuary — Mental Health Chatbot API",
    description=(
        "Backend API untuk aplikasi Sanctuary. Mencakup CB-01..CB-14: "
        "asesmen, chatbot, guardrail, auth, dashboard, dan manajemen akun."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──────────────────────────────────────────────────────────
app.include_router(assessment_router)   # /assessment/submit, /assessment/notify-risk
app.include_router(hotline_router)      # /guardrail/hotline (CB-03)
app.include_router(guardrail_router)    # /guardrail/check   (CB-04)
app.include_router(router_router)       # /router/intent     (CB-05)
app.include_router(rag_router)          # /rag/context       (CB-06)
app.include_router(chat_router)         # /chat/stream, /chat/history, /chat
app.include_router(account_router)      # /auth/login, /auth/me, /accounts
app.include_router(dashboard_router)    # /dashboard/data    (CB-10)
app.include_router(jadwal_router)       # /jadwal, /booking
app.include_router(journal_router)      # /journal (self-journaling)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Sanctuary Backend", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "endpoints": {
            "CB-01": "POST /assessment/submit",
            "CB-02": "POST /assessment/notify-risk",
            "CB-03": "GET  /guardrail/hotline",
            "CB-04": "POST /guardrail/check",
            "CB-05": "POST /router/intent",
            "CB-06": "POST /rag/context",
            "CB-07": "POST /chat/stream",
            "CB-08": "POST /chat/history",
            "CB-09": "POST /auth/login",
            "CB-10": "GET  /dashboard/data",
            "CB-11": "GET  /accounts",
            "CB-12": "POST /accounts",
            "CB-13": "PUT  /accounts/{user_id}",
            "CB-14": "DELETE /accounts/{user_id}",
        }
    }