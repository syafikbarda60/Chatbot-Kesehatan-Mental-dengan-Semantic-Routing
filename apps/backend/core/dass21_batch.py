"""The admin DASS-21 batch lifecycle: DRAFT -> PENDING_VALIDATION -> APPROVED | REJECTED.

A batch is an instrument version seen through its latest counselor review; nothing new is
stored. The dashboard mirrors `validate_dass21_questions` in features/dass21/model.ts —
change both together.
"""
from collections import Counter
from typing import Iterable, Mapping, Optional

CATEGORY_LABELS = {"depression": "Depresi", "anxiety": "Kecemasan", "stress": "Stres"}
TEXT_MAX = 500


def batch_status(version_status: str, definition_revision: int, review: Optional[Mapping[str, object]]) -> str:
    """Published means approved. A rejection only holds for the revision it judged:
    saving bumps the revision, which turns the batch back into a plain draft."""
    if version_status != "draft":
        return "APPROVED"
    if review and review["status"] == "pending":
        return "PENDING_VALIDATION"
    if review and review["status"] == "revision_requested" and review["definition_revision"] == definition_revision:
        return "REJECTED"
    return "DRAFT"


def validate_dass21_questions(questions: Iterable[Mapping[str, object]]) -> list[str]:
    """Submit-time rules: 21 items numbered 1-21 once each, none blank, seven per category."""
    rows = list(questions)
    errors: list[str] = []
    if len(rows) != 21:
        errors.append(f"Harus tepat 21 soal (sekarang {len(rows)})")
    positions = [int(row["position"]) for row in rows]
    if len(set(positions)) != len(positions) or not set(positions) <= set(range(1, 22)):
        errors.append("Nomor soal harus 1–21 tanpa duplikat")
    errors.extend(f"Soal {row['position']} belum diisi" for row in rows if not str(row["text"]).strip())
    counts = Counter(str(row["category"]) for row in rows)
    for category, label in CATEGORY_LABELS.items():
        count = counts[category]
        if count < 7:
            errors.append(f"Kategori {label} baru {count} dari 7 soal")
        elif count > 7:
            errors.append(f"Kategori {label} berisi {count} soal, harus 7")
    return errors
