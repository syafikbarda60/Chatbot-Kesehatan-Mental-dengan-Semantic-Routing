"""DOCX extraction and chunking for the RAG corpus.

Ingestion is a script, not request code, so the two things worth pinning are: importing it
must never touch the database (it used to ingest the whole corpus at import), and extracting
a DOCX must keep paragraph and table-row order. Chunk quality itself is measured end to end
by `tests/integration/rag_retrieval_eval.py`, not guessed here.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import tempfile
import unittest

os.environ.setdefault("JWT_SECRET", "isolated-embedding-test-key-not-for-real")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# scripts/embed.py must be importable without touching a database or the network.
from scripts import embed  # noqa: E402


class ChunkTextTests(unittest.TestCase):
    def test_importing_the_script_writes_nothing(self):
        # The old module-level loop ingested `docs/*.docx` on import; importing it from a
        # test (or any tool) silently duplicated the corpus.
        self.assertTrue(callable(embed.main))
        self.assertNotIn("embed_and_upload", vars(embed))

    def test_never_exceeds_the_size_limit(self):
        chunks = embed.chunk_text("kalimat pendek. " * 200, size=500, overlap=50)
        self.assertTrue(chunks)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 500)

    def test_carries_the_documented_overlap(self):
        text = " ".join(f"kata{i:04d}" for i in range(300))
        chunks = embed.chunk_text(text, size=200, overlap=50)
        self.assertGreater(len(chunks), 1)
        for previous, following in zip(chunks, chunks[1:]):
            self.assertTrue(following.startswith(previous[-50:]), (previous[-60:], following[:60]))

    def test_empty_and_short_inputs(self):
        self.assertEqual(embed.chunk_text("", size=500, overlap=50), [])
        self.assertEqual(embed.chunk_text("   \n  ", size=500, overlap=50), [])
        self.assertEqual(embed.chunk_text("satu kalimat", size=500, overlap=50), ["satu kalimat"])

    def test_long_words_that_cannot_be_backed_off_still_terminate(self):
        chunks = embed.chunk_text("x" * 1200, size=500, overlap=50)
        self.assertEqual([len(chunk) for chunk in chunks], [500, 500, 300])


class ExtractTextTests(unittest.TestCase):
    def test_paragraphs_and_table_rows_keep_their_order(self):
        from docx import Document

        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "fixture.docx")
            document = Document()
            document.add_paragraph("Sebelum tabel")
            table = document.add_table(rows=2, cols=2)
            table.cell(0, 0).text = "Gejala Utama"
            table.cell(0, 1).text = "Gejala Tambahan"
            table.cell(1, 0).text = "Afek depresif"
            table.cell(1, 1).text = "Tidur terganggu"
            document.add_paragraph("Sesudah tabel")
            document.save(path)

            text = embed.extract_text_docx(path)

        lines = [line for line in text.splitlines() if line.strip()]
        self.assertEqual(lines, [
            "Sebelum tabel",
            "Gejala Utama | Gejala Tambahan",
            "Afek depresif | Tidur terganggu",
            "Sesudah tabel",
        ])


if __name__ == "__main__":
    unittest.main()
