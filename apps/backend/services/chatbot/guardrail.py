from semantic_router import Route
from semantic_router import SemanticRouter
from semantic_router.encoders import OllamaEncoder
from core.db import query
from dotenv import load_dotenv
import os
import re

load_dotenv()

guardrail_route = Route(
    name="guardrail",
    utterances=[
        "saya ingin mengakhiri hidup saya",
        "saya mau bunuh diri",
        "saya tidak mau hidup lagi",
        "lebih baik saya mati saja",
        "saya ingin menyakiti diri sendiri",
        "saya sudah tidak kuat lagi hidup",
        "hidup saya tidak ada gunanya",
        "saya mau menghilang selamanya",
        "saya ingin membunuh seseorang",
        "saya mau menyakiti orang lain",
        "saya ingin melukai keluarga saya",
        "saya sedang memegang pisau",
        "saya sudah minum obat banyak",
        "tolong saya mau mati sekarang",
    ]
)

HARDCODED_RESPONSE = """Saya mendengar kamu, dan saya sangat khawatir dengan kondisimu sekarang.

Kamu tidak sendirian. Tolong segera hubungi:
• Into The Light Indonesia: 119 ext 8
• Yayasan Pulih: (021) 788-42580
• IGD rumah sakit terdekat

Apakah kamu aman sekarang?"""

HARDCODED_HOTLINES = [
    {"nama": "Into The Light Indonesia", "nomor": "119 ext 8"},
    {"nama": "Yayasan Pulih", "nomor": "(021) 788-42580"},
    {"nama": "IGD Rumah Sakit Terdekat", "nomor": "118"},
]

GUARDRAIL_KEYWORDS = [
    "bunuh diri", "mau mati", "ingin mati", "mengakhiri hidup", "tidak mau hidup",
    "menyakiti diri", "luka diri", "self harm", "memotong diri", "minum obat banyak",
    "overdosis", "mau bunuh", "ingin bunuh", "menghilang selamanya", "tidak ada gunanya",
    "putus asa total", "krisis suicida", "ingin meninggal", "pilih mati",
    "cara bunuh diri", "cara mati", "mencari cara mati", "persiapan bunuh diri",
]

def check_guardrail_keywords(text: str) -> bool:
    """Keyword-based safety net for guardrail detection.
    Returns True if high-risk keywords detected.
    """
    text_lower = text.lower()
    for keyword in GUARDRAIL_KEYWORDS:
        if re.search(rf'\b{re.escape(keyword)}\b', text_lower):
            return True
    return False


def check_guardrail(text: str, semantic_result_name: str = None) -> tuple[bool, str]:
    """
    Combined guardrail check: semantic router + keyword fallback.
    Returns (is_high_risk, route_name).
    """
    if semantic_result_name == "guardrail":
        return True, "guardrail"
    
    if check_guardrail_keywords(text):
        return True, "guardrail_keyword"
    
    return False, semantic_result_name or "conversational"


def get_hotlines_from_db():
    """CB-03 — Ambil dari tabel hotline (ERD: singular, kolom nama/nomor)."""
    try:
        rows = query("select nama, nomor, deskripsi from hotline")
        if rows:
            return rows
    except Exception:
        pass
    return HARDCODED_HOTLINES


def init_guardrail_router():
    encoder = OllamaEncoder(base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), name="nomic-embed-text-v2-moe")
    router = SemanticRouter(
        routes=[guardrail_route],
        encoder=encoder,
        auto_sync="local"
    )
    return router

# test
# if __name__ == "__main__":
#     from semantic_router import SemanticRouter
#     from semantic_router.encoders import OllamaEncoder

#     encoder = OllamaEncoder(base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), name="nomic-embed-text-v2-moe")
#     router = SemanticRouter(routes=[guardrail_route], encoder=encoder)

#     router = SemanticRouter(
#         routes=[guardrail_route], 
#         encoder=encoder,
#         auto_sync="local" 
#     )
    

    
#     tests = [
#         "saya mau bunuh diri",
#         "apa itu depresi?",
#         "saya sedih banget hari ini",
#         "saya tidak mau hidup lagi",
#     ]

#     for t in tests:
#         result = router(t)
#         print(f"[{result.name}] {t}")