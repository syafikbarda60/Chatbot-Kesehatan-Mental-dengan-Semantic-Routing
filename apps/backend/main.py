from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routes.assessment import router as assessment_router
from routes.account import router as account_router
from routes.dashboard import router as dashboard_router
from routes.jadwal import router as jadwal_router
from routes.journal import router as journal_router
from routes.admin import router as admin_router
from routes.admin_operations import router as admin_operations_router

from routes.chat import (
    guardrail_router,
    router_router,
    rag_router,
    chat_router,
)

from fastapi import APIRouter
from services.chatbot.guardrail import get_hotlines_from_db

hotline_router = APIRouter(prefix="/guardrail", tags=["Guardrail"])

@hotline_router.get("/hotline")
def get_emergency_hotline():
    return {"hotlines": get_hotlines_from_db()}


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assessment_router)
app.include_router(hotline_router)
app.include_router(guardrail_router)
app.include_router(router_router)
app.include_router(rag_router)
app.include_router(chat_router)
app.include_router(account_router)
app.include_router(dashboard_router)
app.include_router(jadwal_router)
app.include_router(journal_router)
app.include_router(admin_router)
app.include_router(admin_operations_router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Sanctuary Backend", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "endpoints": {
            "ADMIN-01": "GET /admin/assessments",
            "ADMIN-02": "GET /admin/users/{user_id}",
            "ADMIN-03": "GET /admin/users/{user_id}/assessments",
            "ADMIN-04": "GET /admin/users/{user_id}/bookings",
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
