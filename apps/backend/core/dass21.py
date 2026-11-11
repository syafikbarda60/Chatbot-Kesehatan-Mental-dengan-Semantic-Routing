"""Authoritative DASS-21 scoring rules supplied for Sajiwa Iteration 4.1.

Question wording is deliberately not stored here. The project-supplied Indonesian
wording must be loaded through a migration after the exact source text is provided.
"""
from collections import Counter
from typing import Iterable, Mapping


CATEGORY_ITEMS = {
    "depression": (3, 5, 10, 13, 16, 17, 21),
    "anxiety": (2, 4, 7, 9, 15, 19, 20),
    "stress": (1, 6, 8, 11, 12, 14, 18),
}

RESPONSE_SCORES = (0, 1, 2, 3)

SEVERITY_BANDS = {
    "depression": ((9, "normal"), (13, "mild"), (20, "moderate"), (27, "severe")),
    "anxiety": ((7, "normal"), (9, "mild"), (14, "moderate"), (19, "severe")),
    "stress": ((14, "normal"), (18, "mild"), (25, "moderate"), (33, "severe")),
}


def classify_dass21(category: str, standardized_score: int) -> str:
    if category not in SEVERITY_BANDS:
        raise ValueError("invalid DASS-21 category")
    if standardized_score < 0 or standardized_score > 42:
        raise ValueError("DASS-21 standardized score must be between 0 and 42")
    for upper, label in SEVERITY_BANDS[category]:
        if standardized_score <= upper:
            return label
    return "extremely_severe"


def normalize_subscales(values: Iterable[str]) -> tuple[str, ...]:
    """The subscales a DASS-21 variant offers, in blueprint order.

    A variant administers whole subscales only: the norms hold per subscale of seven items,
    never for a hand-picked handful of items.
    """
    chosen = list(values)
    if not chosen or len(set(chosen)) != len(chosen) or not set(chosen) <= set(CATEGORY_ITEMS):
        raise ValueError("Pilih sedikitnya satu subskala DASS-21 (depression, anxiety, stress) tanpa duplikat")
    return tuple(category for category in CATEGORY_ITEMS if category in chosen)


def score_dass21(
    items: Iterable[Mapping[str, object]], subscales: tuple[str, ...] = tuple(CATEGORY_ITEMS)
) -> dict[str, dict[str, int | str]]:
    """Score trusted server-resolved item positions, categories, and option scores.

    `subscales` narrows the instrument to the subscales a variant offers; each is still
    answered whole and classified on its own official norm.
    """
    resolved = list(items)
    expected = sorted(position for category in subscales for position in CATEGORY_ITEMS[category])
    positions = [int(item["position"]) for item in resolved]
    if sorted(positions) != expected:
        raise ValueError("DASS-21 requires each item of the offered subscales exactly once")
    counts = Counter(str(item["category"]) for item in resolved)
    if counts != Counter({category: 7 for category in subscales}):
        raise ValueError("DASS-21 requires exactly seven items in each category")
    for item in resolved:
        position = int(item["position"])
        category = str(item["category"])
        score = int(item["score"])
        if position not in CATEGORY_ITEMS.get(category, ()):
            raise ValueError("DASS-21 item/category mapping does not match the approved blueprint")
        if score not in RESPONSE_SCORES:
            raise ValueError("DASS-21 response score must be 0, 1, 2, or 3")
    result: dict[str, dict[str, int | str]] = {}
    for category in subscales:
        raw = sum(int(item["score"]) for item in resolved if item["category"] == category)
        standardized = raw * 2
        result[category] = {
            "raw_score": raw,
            "scaled_score": standardized,
            "severity": classify_dass21(category, standardized),
        }
    return result


def validate_dass21_definition(items: Iterable[Mapping[str, object]]) -> list[str]:
    """Validate a definition without requiring the caller to submit responses."""
    rows = list(items)
    issues: list[str] = []
    positions = [int(item["position"]) for item in rows]
    if len(rows) != 21:
        issues.append("DASS-21 harus memiliki tepat 21 item aktif")
    if sorted(positions) != list(range(1, 22)) or len(set(positions)) != len(positions):
        issues.append("Nomor item DASS-21 harus unik dan lengkap dari 1 sampai 21")
    for category, expected in CATEGORY_ITEMS.items():
        actual = {int(item["position"]) for item in rows if item["category"] == category}
        if actual != set(expected):
            issues.append(f"Pemetaan kategori {category} tidak sesuai blueprint DASS-21")
    for item in rows:
        scores = sorted(int(value) for value in item.get("option_scores", []))
        if scores != list(RESPONSE_SCORES):
            issues.append(f"Item {item['position']} harus memiliki nilai respons 0, 1, 2, dan 3")
    return issues
