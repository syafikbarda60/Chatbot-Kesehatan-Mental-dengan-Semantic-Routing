"""Deterministic answers about where Sajiwa's knowledge comes from.

Left to the model, this question produced inventions: "aku telah membaca banyak buku
pengembangan diri", "punya pengalaman menangani klien", "dari APA dan situs kesehatan".
Prompt rules did not hold, so provenance is decided here — the model is never asked.

Same shape as guardrail: a route, a fixed reply, no generation.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
from semantic_router import Route

from core.db import query

PROVENANCE_ROUTE = "provenance"

provenance_route = Route(
    name=PROVENANCE_ROUTE,
    utterances=[
        "sumbernya dari mana?",
        "kamu dapat informasi dari mana?",
        "sumber informasi yang kamu gunakan dari mana?",
        "kamu tahu itu dari mana?",
        "referensinya apa saja?",
        "jawabanmu berdasarkan apa?",
        "kamu pakai buku apa?",
        "kamu punya pengalaman menangani klien?",
        "kamu psikolog?",
        "apa kamu psikolog atau dokter?",
        "kamu manusia atau ai?",
    ],
)

# Used only when the corpus has no citations; naming none is better than inventing one.
FALLBACK_SOURCES = "dokumen pedoman kesehatan mental di basis pengetahuanku"

PROVENANCE_REPLY = (
    "Aku asisten AI, bukan psikolog, dan tidak punya pengalaman menangani klien. "
    "Untuk topik kesehatan mental, jawabanku diambil dari {sources}. "
    "Di luar itu aku menjawab dari pemahaman umum, jadi bisa keliru — jangan jadikan "
    "dasar diagnosis."
)


def _sources() -> str:
    rows = query(
        "select distinct metadata->>'citation' as citation from documents "
        "where metadata->>'citation' is not null order by citation"
    )
    names = [row["citation"] for row in rows if row.get("citation")]
    return ", ".join(names) or FALLBACK_SOURCES


def provenance_reply() -> str:
    """What is actually in the corpus, and what Sajiwa is not."""
    return PROVENANCE_REPLY.format(sources=_sources())
