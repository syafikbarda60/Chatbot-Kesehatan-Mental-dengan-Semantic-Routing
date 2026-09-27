# tests/test_guardrail.py
# Unit tests for guardrail safety system

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.chatbot.guardrail import (
    check_guardrail_keywords,
    check_guardrail,
    GUARDRAIL_KEYWORDS,
    HARDCODED_RESPONSE,
)


class TestGuardrailKeywords:
    """Test keyword-based guardrail detection."""

    def test_suicide_keywords_detected(self):
        """Test that explicit suicide keywords are detected."""
        test_cases = [
            "saya mau bunuh diri",
            "saya ingin bunuh diri",
            "cara bunuh diri",
            "saya tidak mau hidup lagi",
            "ingin mati",
            "mau mati",
            "menyakiti diri sendiri",
            "luka diri",
            "self harm",
            "memotong diri",
            "minum obat banyak",
            "overdosis",
            "tidak ada gunanya hidup",
            "putus asa total",
            "krisis suicida",
        ]
        for text in test_cases:
            assert check_guardrail_keywords(text), f"Failed to detect: {text}"

    def test_suicide_keywords_case_insensitive(self):
        """Test case insensitivity."""
        assert check_guardrail_keywords("SAYA MAU BUNUH DIRI")
        assert check_guardrail_keywords("Saya Mau Bunuh Diri")
        assert check_guardrail_keywords("sAyA mAu BuNuH dIrI")

    def test_word_boundaries(self):
        """Test that keywords match word boundaries, not substrings."""
        # These should NOT trigger (substring matches)
        assert not check_guardrail_keywords("mati lampu")  # "mati" alone
        assert not check_guardrail_keywords("hp mati")
        assert not check_guardrail_keywords("baterai mati")
        assert not check_guardrail_keywords("matiin lampu")
        
        # These SHOULD trigger (full keyword matches)
        assert check_guardrail_keywords("saya mau mati")
        assert check_guardrail_keywords("ingin mati sekarang")

    def test_homophone_variations(self):
        """Test Indonesian variations."""
        assert check_guardrail_keywords("mau bunuh diri")
        assert check_guardrail_keywords("mau bunuh diri sendiri")
        assert check_guardrail_keywords("mau bunuh diriku")

    def test_non_triggering_text(self):
        """Test normal conversation doesn't trigger."""
        normal_texts = [
            "halo, apa kabar?",
            "saya sedih hari ini",
            "saya stres dengan tugas kuliah",
            "aku butuh teman bicara",
            "terima kasih sudah mendengarkan",
            "apa gejala depresi?",
            "bagaimana cara mengatasi cemas?",
        ]
        for text in normal_texts:
            assert not check_guardrail_keywords(text), f"False positive: {text}"


class TestCombinedGuardrail:
    """Test combined semantic + keyword guardrail."""

    def test_semantic_guardrail_priority(self):
        """When semantic router returns guardrail, combined should return True."""
        is_high_risk, route = check_guardrail("saya mau bunuh diri", "guardrail")
        assert is_high_risk is True
        assert route == "guardrail"

    def test_keyword_fallback_when_semantic_miss(self):
        """Keyword fallback should catch when semantic misses."""
        is_high_risk, route = check_guardrail("cara bunuh diri yang efektif", "conversational")
        assert is_high_risk is True
        assert route == "guardrail_keyword"

    def test_no_false_positive_on_normal(self):
        """Normal text should not trigger either check."""
        is_high_risk, route = check_guardrail("saya sedih banget", "conversational")
        assert is_high_risk is False
        assert route == "conversational"

    def test_rag_route_not_overridden_by_keywords(self):
        """RAG route should be overridden if keywords detected."""
        is_high_risk, route = check_guardrail("apa cara bunuh diri?", "rag")
        assert is_high_risk is True
        assert route == "guardrail_keyword"


class TestGuardrailConstants:
    """Test guardrail constants."""

    def test_hardcoded_response_exists(self):
        assert HARDCODED_RESPONSE is not None
        assert len(HARDCODED_RESPONSE) > 0
        assert "119 ext 8" in HARDCODED_RESPONSE
        assert "Yayasan Pulih" in HARDCODED_RESPONSE

    def test_keywords_list_not_empty(self):
        assert len(GUARDRAIL_KEYWORDS) > 0
        assert "bunuh diri" in GUARDRAIL_KEYWORDS


if __name__ == "__main__":
    pytest.main([__file__, "-v"])