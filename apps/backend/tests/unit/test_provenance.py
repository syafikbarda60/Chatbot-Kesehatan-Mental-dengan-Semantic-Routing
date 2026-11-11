"""Provenance questions are answered from the corpus, never by the model.

Asked "sumber informasi yang kamu gunakan dari mana?", Sajiwa answered "aku telah membaca banyak
buku pengembangan diri" and "punya pengalaman menangani klien" — both invented. Prompt rules
were tried and the 8B model kept fabricating, so this is a deterministic route like guardrail:
the reply names the documents actually in the corpus and states what Sajiwa is not.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest

os.environ.setdefault("JWT_SECRET", "isolated-provenance-test-key-not-for-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
sys.modules["core.db"] = fake_db
sys.modules.pop("services.chatbot.provenance", None)

import services.chatbot.provenance as provenance  # noqa: E402


class ProvenanceReplyTests(unittest.TestCase):
    def test_names_the_documents_in_the_corpus(self):
        provenance.query = lambda *a, **k: [
            {"citation": "Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)"}
        ]
        reply = provenance.provenance_reply()
        self.assertIn("Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)", reply)

    def test_never_claims_experience_or_a_clinical_credential(self):
        provenance.query = lambda *a, **k: []
        reply = provenance.provenance_reply().lower()
        self.assertIn("asisten ai", reply)
        self.assertIn("bukan psikolog", reply)
        self.assertIn("tidak punya pengalaman", reply)

    def test_falls_back_to_a_generic_source_phrase_when_the_corpus_is_empty(self):
        provenance.query = lambda *a, **k: []
        reply = provenance.provenance_reply()
        self.assertNotIn("None", reply)
        self.assertIn("dokumen", reply.lower())

    def test_the_router_recognises_the_way_students_ask(self):
        for phrase in ("sumbernya dari mana?", "kamu dapat informasi dari mana?",
                       "kamu punya pengalaman menangani klien?"):
            self.assertIn(phrase, provenance.provenance_route.utterances)


if __name__ == "__main__":
    unittest.main()
