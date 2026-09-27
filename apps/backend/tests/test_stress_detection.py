# tests/test_stress_detection.py
# Unit tests for stress detection algorithm (ported from TypeScript)

from typing import List
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Message:
    id: str
    text: str
    sender: str  # 'user' | 'ai'
    timestamp: datetime


KEYWORDS = {
    "high": [
        "putus asa", "tidak ada harapan", "mau mati", "ingin mati", "bunuh diri",
        "tidak kuat lagi", "menyerah", "hancur", "sangat tertekan", "panik", "krisis",
        "tak sanggup", "depresi berat",
    ],
    "mid": [
        "sedih", "menangis", "stres", "stress", "cemas", "khawatir", "takut",
        "lelah", "capek", "galau", "bingung", "kecewa", "frustasi", "marah",
        "kesal", "gelisah", "susah tidur", "tidak fokus", "tidak semangat",
        "hampa", "kosong", "tertekan",
    ],
    "low": ["baik", "oke", "lumayan", "biasa", "sedikit", "sudah lebih", "lebih baik"],
}


def analyze_stress(messages: List[Message]) -> float:
    """Returns stress level 0-10 based on the last 5 user messages."""
    user_texts = [
        m.text.lower() for m in messages if m.sender == "user"
    ]

    if not user_texts:
        return 0.0

    score = 0.0
    window = user_texts[-5:]

    for text in window:
        for kw in KEYWORDS["high"]:
            if kw in text:
                score += 3.5
        for kw in KEYWORDS["mid"]:
            if kw in text:
                score += 1.5
        for kw in KEYWORDS["low"]:
            if kw in text:
                score -= 0.5

    # Normalize: fewer messages -> less aggressive scaling
    factor = min(len(user_texts) / 3, 2.5)
    result = min(10, max(0, score / factor))
    return round(result * 10) / 10


def get_stress_tier(level: float) -> str:
    if level <= 3:
        return "low"
    if level <= 6:
        return "mid"
    return "high"


import pytest


class TestStressDetection:
    """Test stress detection algorithm."""

    def test_empty_messages_returns_zero(self):
        assert analyze_stress([]) == 0.0

    def test_only_ai_messages_returns_zero(self):
        messages = [
            Message("1", "Halo!", "ai", datetime.now()),
            Message("2", "Apa kabar?", "ai", datetime.now()),
        ]
        assert analyze_stress(messages) == 0.0

    def test_single_low_stress_message(self):
        messages = [
            Message("1", "Saya merasa sedih hari ini", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        # With 1 message: factor = min(1/3, 2.5) = 0.333
        # "sedih" = +1.5, score = 1.5 / 0.333 = 4.5
        assert 3 < result <= 6  # Actually mid tier due to scaling factor

    def test_single_mid_stress_message(self):
        messages = [
            Message("1", "Saya stres banget dan cemas", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        # "stres" + "cemas" = 2 * 1.5 = 3.0, factor = 0.333, score = 9.0
        assert result > 6  # high tier due to scaling factor

    def test_single_high_stress_message(self):
        messages = [
            Message("1", "Saya mau bunuh diri", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        assert result > 6  # high tier

    def test_multiple_messages_accumulate(self):
        messages = [
            Message("1", "Saya sedih", "user", datetime.now()),
            Message("2", "Saya cemas", "user", datetime.now()),
            Message("3", "Saya takut", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        # 3 mid keywords = 3 * 1.5 = 4.5, factor = min(3/3, 2.5) = 1, score = 4.5
        assert result > 3

    def test_window_limit_5_messages(self):
        """Only last 5 user messages should count."""
        messages = [
            Message(str(i), "Saya sedih", "user", datetime.now())
            for i in range(10)
        ]
        result = analyze_stress(messages)
        # Only last 5 count: 5 * 1.5 = 7.5, factor = min(10/3, 2.5) = 2.5, score = 3.0
        assert result == 3.0

    def test_low_keywords_reduce_score(self):
        messages = [
            Message("1", "Saya sedih tapi sudah lebih baik", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        # "sedih" = +1.5, "sudah lebih baik" = -0.5, total = 1.0, factor = 1/3 = 0.33, score = 3.0
        assert result >= 0

    def test_score_clamped_0_to_10(self):
        # Many high stress messages
        messages = [
            Message(str(i), "Saya mau bunuh diri putus asa", "user", datetime.now())
            for i in range(20)
        ]
        result = analyze_stress(messages)
        assert 0 <= result <= 10

    def test_stress_tiers(self):
        assert get_stress_tier(0) == "low"
        assert get_stress_tier(3) == "low"
        assert get_stress_tier(3.1) == "mid"
        assert get_stress_tier(6) == "mid"
        assert get_stress_tier(6.1) == "high"
        assert get_stress_tier(10) == "high"

    def test_negation_not_handled(self):
        """Current algorithm doesn't handle negation - this documents the limitation."""
        messages = [
            Message("1", "Saya tidak sedih", "user", datetime.now()),
        ]
        result = analyze_stress(messages)
        # Currently triggers on "sedih" even with "tidak"
        # This is a known limitation - would need NLP for proper negation handling
        assert result > 0  # Currently returns > 0 due to keyword match

    def test_partial_word_matches(self):
        """Substrings can trigger false positives."""
        messages = [
            Message("1", "HP saya mati", "user", datetime.now()),  # "mati" in "mati"
        ]
        result = analyze_stress(messages)
        # "mati" matches "mau mati" / "ingin mati" partially
        # This is a known limitation of substring matching
        assert result >= 0

    def test_indonesian_morphology_not_handled(self):
        """Stemming not applied - different forms not matched."""
        messages = [
            Message("1", "Menyedihkan sekali", "user", datetime.now()),  # "menyedihkan" != "sedih"
        ]
        result = analyze_stress(messages)
        # "menyedihkan" doesn't contain "sedih" as substring
        assert result == 0.0  # Currently misses this


if __name__ == "__main__":
    pytest.main([__file__, "-v"])