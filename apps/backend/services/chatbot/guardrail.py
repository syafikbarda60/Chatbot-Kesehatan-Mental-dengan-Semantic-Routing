from semantic_router import Route
from semantic_router import SemanticRouter
from semantic_router.encoders import OllamaEncoder
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

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


def get_hotlines_from_db():
    """CB-03 — Ambil dari tabel hotline (ERD: singular, kolom nama/nomor)."""
    try:
        result = supabase.table("hotline").select("nama, nomor, deskripsi").execute()
        if result.data:
            return result.data
    except Exception:
        pass
    return HARDCODED_HOTLINES


def init_guardrail_router():
    encoder = OllamaEncoder(base_url="http://localhost:11434", name="nomic-embed-text-v2-moe")
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

#     encoder = OllamaEncoder(base_url="http://localhost:11434", name="nomic-embed-text-v2-moe")
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