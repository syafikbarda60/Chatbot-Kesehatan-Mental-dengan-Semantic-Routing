"""Contracts for prompt-history assembly. No database, model, or network is used.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())

fake_db = types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
# Keep the real DB module unloaded: these tests never open a connection.
sys.modules["core.db"] = fake_db

from core.security import encrypt_text
from services.chatbot import history

A = "11111111-1111-4111-8111-111111111111"


class PromptHistoryTests(unittest.TestCase):
    def setUp(self):
        self.calls = []

    def _rows(self, rows):
        def fake_query(sql, params=(), user_id=None):
            self.calls.append((sql, params, user_id))
            return rows
        return patch.object(history, "query", side_effect=fake_query)

    def test_no_session_or_user_never_queries(self):
        for session_id, user_id in ((None, A), ("s1", None), ("", A)):
            with self._rows([]):
                self.assertEqual(history.load_history(session_id, user_id), [])
        self.assertEqual(self.calls, [])

    def test_crisis_rows_are_filtered_out_and_identity_is_scoped(self):
        with self._rows([]):
            history.load_history("s1", A)
        sql, params, user_id = self.calls[0]
        # The safety filter must be in SQL: nothing downstream can un-fetch a crisis row.
        self.assertIn("route_used is distinct from %s", sql)
        self.assertEqual(params[1], "guardrail")
        self.assertIn("limit %s", sql)
        self.assertEqual(params[2], history.HISTORY_TURNS)
        # RLS is keyed on the JWT identity, never on the request body.
        self.assertEqual(user_id, A)

    def test_newest_first_query_is_reordered_for_the_prompt(self):
        rows = [
            {"role": "assistant", "content": encrypt_text("tiga")},
            {"role": "user", "content": encrypt_text("dua")},
            {"role": "assistant", "content": encrypt_text("satu")},
        ]
        with self._rows(rows):
            out = history.load_history("s1", A)
        self.assertEqual([m.content for m in out], ["satu", "dua", "tiga"])
        self.assertIsInstance(out[0], history.AIMessage)
        self.assertIsInstance(out[1], history.HumanMessage)

    def test_unreadable_row_is_skipped_not_fatal(self):
        rows = [
            {"role": "assistant", "content": "not-a-fernet-token"},
            {"role": "user", "content": encrypt_text("halo")},
        ]
        with self._rows(rows):
            out = history.load_history("s1", A)
        self.assertEqual([m.content for m in out], ["halo"])

    def test_char_cap_drops_older_turns_first(self):
        recent = "r" * (history.HISTORY_CHAR_CAP - 10)
        rows = [
            {"role": "assistant", "content": encrypt_text(recent)},
            {"role": "user", "content": encrypt_text("x" * 100)},
        ]
        with self._rows(rows):
            out = history.load_history("s1", A)
        # The oversized oldest turn stops assembly; the newest turn is never dropped.
        self.assertEqual([m.content for m in out], [recent])

    def test_trailing_unanswered_user_turn_is_dropped(self):
        rows = [
            {"role": "user", "content": encrypt_text("pertanyaan yang belum dijawab")},
            {"role": "assistant", "content": encrypt_text("jawaban sebelumnya")},
            {"role": "user", "content": encrypt_text("pertanyaan lama")},
        ]
        with self._rows(rows):
            out = history.load_history("s1", A)
        # A killed stream leaves the newest row unanswered; the retry re-adds it as the
        # current HumanMessage, so it must not also be prepended here.
        self.assertEqual([m.content for m in out], ["pertanyaan lama", "jawaban sebelumnya"])
        self.assertIsInstance(out[0], history.HumanMessage)


if __name__ == "__main__":
    unittest.main()
