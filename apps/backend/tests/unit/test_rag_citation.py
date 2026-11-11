"""The RAG prompt must name the document it drew its answer from.

Asked "sumbernya dari mana?", the model used to have nothing to answer with: build_messages
passed only the chunk text and dropped metadata, so provenance was invented from the weights
("buku pengembangan diri, situs web kesehatan, APA"). The source is part of the prompt now.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest

os.environ.setdefault("JWT_SECRET", "isolated-rag-citation-test-key-not-for-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# rag.py reaches the database only through core.db.query, which is unused here.
fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
sys.modules["core.db"] = fake_db

# test_chat_stream stubs the whole rag module; drop it so this file tests the real one.
sys.modules.pop("services.chatbot.rag", None)

from services.chatbot.rag import build_messages  # noqa: E402

import services.chatbot.rag as rag  # noqa: E402


class RagCitationTests(unittest.TestCase):
    def _system_prompt(self, metadata):
        rag.retrieve_docs = lambda *a, **k: [{"content": "GEJALA MAYOR DAN MINOR", "metadata": metadata}]
        messages = build_messages("apa itu depresi?")
        self.assertIsNotNone(messages, "retrieval returned a chunk, so a prompt must exist")
        return messages[0].content

    def test_prompt_names_the_citation_instead_of_the_filename(self):
        prompt = self._system_prompt({
            "source": "Buku Depresi REVISI FINAL.docx",
            "chunk": 3,
            "citation": "Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)",
        })
        self.assertIn("Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)", prompt)
        self.assertNotIn(".docx", prompt, "the internal filename must not reach the model")

    def test_falls_back_to_the_filename_when_a_chunk_has_no_citation(self):
        prompt = self._system_prompt({"source": "Buku Lain.docx", "chunk": 0})
        self.assertIn("Buku Lain.docx", prompt)

    def test_tells_the_model_to_name_the_source_when_answering(self):
        prompt = self._system_prompt({"source": "a.docx", "chunk": 0, "citation": "Laporan A (2024)"})
        self.assertIn("sumber", prompt.lower())
