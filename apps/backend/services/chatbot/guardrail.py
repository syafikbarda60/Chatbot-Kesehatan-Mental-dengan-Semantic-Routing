from semantic_router import Route
import re

from core.db import query

# ── Deterministic crisis detection ───────────────────────────────────────────
# The semantic router is fuzzy: in testing it missed "aku udah minum obat banyak",
# "aku pegang pisau sekarang", and "aku mau loncat dari gedung" and sent all three
# to the LLM. Safety must not depend on embedding distance, so every message is
# checked against this list first (core.semantic_router) and only then routed.
#
# Bias is deliberate: a false positive shows a student the hotline card, which is
# harmless. A false negative means a student in crisis talks to an LLM.
CRISIS_PHRASES = (
    # ending life
    "bunuh diri", "bunuhdiri", "bunuh diriku", "membunuh diriku", "bunuh diri ku",
    "akhiri hidup", "akhiri hidupku", "mengakhiri hidup", "mengakhiri semuanya",
    "akhiri semuanya", "akhir segalanya", "sudahi hidupku",
    "mati aja", "mau mati", "ingin mati", "pengen mati", "pengin mati", "pgn mati",
    "mau meninggal", "ingin meninggal", "pengen meninggal",
    "mending mati", "mendingan mati", "lebih baik mati", "lebih baik aku mati",
    "gak mau hidup", "ga mau hidup", "nggak mau hidup", "tidak mau hidup", "gamau hidup",
    "gak pengen hidup", "gak ingin hidup", "tidak ingin hidup",
    "tidak kuat hidup", "gak kuat hidup", "nggak kuat hidup", "udah gak kuat hidup",
    "tidak sanggup hidup", "gak sanggup hidup", "gak sanggup lagi",
    "gantung diri", "menggantung diri",
    "loncat dari gedung", "melompat dari gedung", "loncat dari jembatan",
    "lompat dari gedung", "terjun dari gedung",
    # active self-harm
    "menyakiti diri", "menyakiti diriku", "melukai diri", "melukai diriku",
    "nyakitin diri", "nyakiti diri", "sakiti diri", "nyakitin diri sendiri",
    "self harm", "selfharm", "nyayat", "menyayat", "mengiris tangan", "nyayat tangan",
    "pegang pisau", "memegang pisau", "pegang gunting", "pegang silet", "pegang obat",
    "minum obat banyak", "minum obat berlebihan", "minum obat sekaligus",
    "overdosis", "overdose", "minum racun",
    # harm to others
    "membunuh orang", "mau membunuh", "ingin membunuh", "membunuh seseorang",
    "menyakiti orang", "melukai orang", "melukai keluarga", "menyakiti keluarga",
    # colloquial / slang (variants collapse in _normalize, one form each is enough)
    "cabut nyawa", "kebelet mati", "capek hidup", "cape hidup", "ujung tanduk",
    "nggak mau bangun lagi", "udah nyerah",
)

# Leet/alay folds, applied before phrase matching ("bunuh d1r1" → "bunuh diri").
_LEET = str.maketrans("134570", "ieasto")

# Slang → formal, keyed on the run-collapsed form (see _normalize order).
_SLANG = {
    "idup": "hidup",
    "gw": "aku", "gue": "aku", "gua": "aku", "aq": "aku",
    "ga": "tidak", "gak": "tidak", "nga": "tidak", "ngak": "tidak",
    "mokad": "mati", "modar": "mati",
    "udah": "sudah", "uda": "sudah", "dah": "sudah",
    "pgn": "ingin", "pengen": "ingin", "pengin": "ingin",
}


def _normalize(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", text.lower().translate(_LEET)).strip()
    # ponytail: run-collapse reads real doubles as elongation ("menggantung"→"mengantung"),
    # harmless because phrases go through the same normalization; upgrade to a stemmer
    # only if real traffic shows misses.
    text = re.sub(r"(.)\1+", r"\1", text)
    text = " ".join(_SLANG.get(word, word) for word in text.split())
    return re.sub(r"\s+", " ", text).strip()


_NORMALIZED_CRISIS = tuple(_normalize(p) for p in CRISIS_PHRASES)


def is_crisis(text: str) -> bool:
    """True if the message clearly signals self-harm, suicide, or harm to others."""
    if not text:
        return False
    normalized = _normalize(text)
    return any(phrase in normalized for phrase in _NORMALIZED_CRISIS)


# ── Profanity (Indonesian + Javanese only) ────────────────────────────────────
# Measured 2026-10-05 (scripts/profanity_probe.py): llama3.2 handles English
# swearing gracefully on its own but MIRRORS Indonesian/Javanese curses back at
# the student. So those tokens are stripped before the message reaches the model;
# English cursing is deliberately absent — the LLM absorbs it. Re-checked
# 2026-10-29 on llama3-8b-instruct:Q4_K_M: English still OK. The strip itself is
# unconditional, so it does not depend on which model answers.
PROFANITY = (
    # Indonesian
    "anjing", "bangsat", "kontol", "memek", "pepek", "goblok", "tolol", "babi",
    "asu", "tai", "kampret", "bajingan", "perek", "lonte", "ngentot",
    # Javanese
    "jancok", "jancuk", "cok", "cuk", "kimak", "ndasmu", "ndase", "taik",
)

# Filler that makes curse-only messages non-empty ("lu emang anjing banget sih");
# dropped with the curses so whatever remains is actual content.
_FILLER = frozenset({
    "lu", "lo", "loe", "elo", "emang", "memang", "sih", "deh", "dong", "aja",
    "banget", "woi", "woy", "hei", "bro", "cuy", "nih", "tuh", "lho",
})

_DROP = frozenset(PROFANITY) | _FILLER

PROFANITY_REPLY = "Maaf, aku tidak paham maksudmu. Kamu ingin bercerita tentang sesuatu?"


def strip_profanity(text: str) -> str:
    """Remove curse and filler tokens, keeping the real content.

    Pure-curse input becomes "" (the caller replies PROFANITY_REPLY); mixed input keeps
    its content minus the cursing so the model cannot mirror it back. Whole-token
    matching only — everyday words that merely contain a token are untouched.
    """
    return " ".join(word for word in _normalize(text).split() if word not in _DROP)

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
        "aku pengen mati aja",
        "gue udah gak kuat hidup",
        "aku udah minum obat banyak",
        "aku pegang pisau sekarang",
        "aku mau loncat dari gedung",
        "mending aku mati",
        "aku mau membunuh diriku",
        "aku pengen nyakitin diri sendiri",
        "saya berencana mengakhiri semuanya",
        "aku gak mau hidup lagi",
        # colloquial
        "gw pengen mati aja",
        "udah gak kuat idup",
        "rasanya mau nyakitin diri",
        "aku capek hidup",
        "mau cabut nyawa",
        "gw udah nyerah semuanya",
        "nggak mau bangun lagi",
        "rasanya udah diujung tanduk",
        "aku pengen ngilang aja",
        "lebih baik gw mati",
    ]
)

HARDCODED_RESPONSE = """Saya mendengar kamu, dan saya sangat khawatir dengan kondisimu sekarang.

Kamu tidak sendirian. Tolong segera hubungi:
- **Into The Light Indonesia**: 119 ext 8
- **Yayasan Pulih**: (021) 788-42580
- **IGD rumah sakit terdekat**

Apakah kamu aman sekarang?"""

HARDCODED_HOTLINES = [
    {"name": "Into The Light Indonesia", "phone": "119 ext 8"},
    {"name": "Yayasan Pulih", "phone": "(021) 788-42580"},
    {"name": "IGD Rumah Sakit Terdekat", "phone": "118"},
]


def get_hotlines_from_db():
    try:
        rows = query("select name, phone, description from hotlines where verification_status='active'")
        if rows:
            return rows
    except Exception:
        pass
    return HARDCODED_HOTLINES
