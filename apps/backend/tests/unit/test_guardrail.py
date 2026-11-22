"""Keyword crisis detection — the deterministic safety net in front of the LLM.

Rewritten for is_crisis(); the old check_guardrail_keywords() API was replaced when
guardrail.py moved to normalized phrase matching.
"""
import os
import sys
import types
import unittest

os.environ.setdefault("JWT_SECRET", "isolated-guardrail-test-key-not-for-real-sessions")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# guardrail.py reads hotlines on import in some paths; no database in unit tests.
fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
sys.modules["core.db"] = fake_db

from services.chatbot.guardrail import is_crisis, strip_profanity  # noqa: E402


class ProfanityStripTests(unittest.TestCase):
    def test_strips_curses_in_any_spelling(self):
        # leet and letter-elongation variants fold to the canonical token
        for text in ["lu emang anjing banget sih", "4nj1ng", "goblokk", "c0k", "jancuk"]:
            with self.subTest(text=text):
                self.assertEqual(strip_profanity(text), "")

    def test_mixed_message_keeps_its_content(self):
        self.assertEqual(
            strip_profanity("aku stres banget, anjing, tugas numpuk terus"),
            "aku stres tugas numpuk terus",
        )

    def test_everyday_words_are_left_alone(self):
        # whole-token matching only — words that merely contain a token survive
        for text in ["aku makan bakso", "baterai asin", "jangan dibanting"]:
            with self.subTest(text=text):
                self.assertEqual(strip_profanity(text), text)

    def test_crisis_wins_over_profanity(self):
        # stripping runs after the crisis gate; the hotline card must still fire
        self.assertTrue(is_crisis("anjing, gw mau mati"))

    def test_clean_text_and_medical_terms_survive_untouched(self):
        # The strip runs on every chat turn, before retrieval. Rewriting "SSRI" to "sri"
        # or "gangguan" to "ganguan" silently changes what RAG searches for.
        for text in [
            "berapa dosis SSRI untuk minggu pertama?",
            "apa fungsi kuesioner PHQ-9?",
            "jelaskan gangguan kecemasan menyeluruh",
            "aku makan bakso",
            "",
        ]:
            with self.subTest(text=text):
                self.assertEqual(strip_profanity(text), text)

    def test_drops_curses_without_touching_the_rest_of_the_words(self):
        self.assertEqual(
            strip_profanity("gangguan tidur, anjing, makin parah"),
            "gangguan tidur makin parah",
        )


class CrisisDetectionTests(unittest.TestCase):
    def test_detects_explicit_crisis(self):
        for text in [
            "saya mau bunuh diri",
            "saya ingin bunuh diri",
            "cara bunuh diri",
            "saya tidak mau hidup lagi",
            "ingin mati",
            "mau mati",
            "menyakiti diri sendiri",
            "self harm",
            "overdosis",
        ]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))

    def test_detects_suicide_abbreviation_without_matching_word_fragments(self):
        for text in ["Aku pengen bundir sebelum hasil sidang keluar.", "gw kepikiran bUnd1r"]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))
        self.assertFalse(is_crisis("nama foldernya bundirectory"))

    def test_detects_intent_action_and_person_or_body_target(self):
        for text in [
            "Aku ingin mengiris pergelangan tanganku malam ini.",
            "Aku berniat menyakiti dosenku secara fisik besok.",
            "Gue berencana melukai teman sekamar besok.",
            "Saya mau memotong lengan saya.",
        ]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))
        for text in [
            "aku ingin mengiris bawang untuk makan malam",
            "aku berencana memotong rambut besok",
            "aku takut menyakiti perasaan dosenku",
            "aku ingin membantu teman yang terluka",
            "aku mau mengiris bawang lalu menemui dosenku",
        ]:
            with self.subTest(text=text):
                self.assertFalse(is_crisis(text))

    def test_ignores_case_and_punctuation(self):
        for text in ["SAYA MAU BUNUH DIRI", "Saya Mau Bunuh Diri!!!", "sAyA mAu BuNuH dIrI"]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))

    def test_detects_colloquial_crisis(self):
        # slang, alay/leet spelling, letter elongation — the Bahasa Indonesia gap
        for text in [
            "bunuh d1r1",
            "aku mau matiii",
            "gw udah gak kuat idup",
            "cabut nyawa aja",
            "nggak mau bangun lagi",
            "gw pengen mati aja",
            "lebih baik gw mati",
        ]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))

    def test_detects_implicit_wish_to_disappear(self):
        # No explicit "bunuh diri" wording, but the meaning is the same. Missing these is
        # the failure mode docs/semantic-router-conventions.md warns about.
        for text in [
            "Hidupku gak ada artinya, mending aku gak ada.",
            "Hidup ini gak berarti buatku.",
            "aku pengen ngilang aja",
            "aku ingin menghilang selamanya",
            "Aku pengen nggak bangun lagi besok.",
            "Rasanya aku mau loncat dari balkon kos.",
            "Aku udah minum semua obat di lemari.",
            "Aku sudah menyiapkan tali di kamar.",
            "Aku pengen nyudahi semuanya sekarang.",
        ]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))

    def test_farewell_with_a_wish_to_be_gone_gets_a_safety_check(self):
        for text in [
            "Besok kalian tidak akan perlu mengurusku lagi, aku sudah menulis pesan perpisahan.",
            "Aku menulis surat terakhir. Kalian tidak perlu mengurusku lagi.",
        ]:
            with self.subTest(text=text):
                self.assertTrue(is_crisis(text))
        for text in [
            "Aku menulis pesan perpisahan untuk teman yang pindah kampus.",
            "Besok kalian tidak perlu mengurusku lagi karena aku sudah sembuh.",
        ]:
            with self.subTest(text=text):
                self.assertFalse(is_crisis(text))

    def test_negation_does_not_disable_a_danger_signal(self):
        self.assertTrue(is_crisis("aku tidak tahan lagi dan ingin mati"))
        self.assertTrue(is_crisis("aku tidak ingin bunuh diri"))

    def test_ordinary_exhaustion_is_not_a_crisis(self):
        for text in ["aku capek banget", "aku capek ngerjain tugas", "lagi sedih hari ini"]:
            with self.subTest(text=text):
                self.assertFalse(is_crisis(text))

    def test_does_not_fire_on_everyday_phrases(self):
        # A false positive shows the crisis sheet over an ordinary chat, so these matter
        for text in ["mati lampu", "hp mati", "baterai mati", "matiin lampu",
                     "aku capek banget", "lagi sedih hari ini", ""]:
            with self.subTest(text=text):
                self.assertFalse(is_crisis(text))


if __name__ == "__main__":
    unittest.main()
