"""The conversation list behind the chat history drawer. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

os.environ.setdefault("JWT_SECRET", "isolated-chat-sessions-test-key-not-for-real-sessions")
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# Same isolation as test_chat_stream: no pool, no Ollama-backed router at import.
fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db
for name, attrs in {
    "services.chatbot.core": {
        "semantic_router": lambda m: types.SimpleNamespace(name="conversational"),
        "chat_stream": lambda *a, **k: iter([]),
        "chat": lambda *a, **k: "",
    },
    "services.chatbot.rag": {"retrieve_docs": lambda *a, **k: []},
}.items():
    if name not in sys.modules:
        module = types.ModuleType(name)
        for attr, value in attrs.items():
            setattr(module, attr, value)
        sys.modules[name] = module

from auth import AuthUser  # noqa: E402
from core.security import encrypt_text  # noqa: E402
from routes import chat as chat_route  # noqa: E402

USER = AuthUser(id="11111111-1111-4111-8111-111111111111", email="a@example.com", role="mahasiswa")


def row(session_id, first_message, last="2026-10-04T10:00:00Z"):
    return {"session_id": session_id, "started_at": "2026-10-04T09:00:00Z",
            "last_message_at": last, "first_message": first_message}


class ChatSessionsTests(unittest.TestCase):
    def _list(self, rows, limit=30):
        calls = []

        def fake_query(sql, params=(), user_id=None):
            calls.append((sql, params, user_id))
            return rows

        with patch.object(chat_route, "query", side_effect=fake_query):
            result = chat_route.chat_sessions(limit=limit, user=USER)
        return result["sessions"], calls

    def test_list_is_the_callers_own_newest_first(self):
        _, calls = self._list([])
        sql, params, user_id = calls[0]
        # Explicit owner filter on top of RLS, and RLS keyed on the JWT identity.
        self.assertIn("where s.user_id = %s", sql)
        self.assertEqual(params[0], USER.id)
        self.assertEqual(user_id, USER.id)
        self.assertIn("order by last_message_at desc", sql)

    def test_preview_is_the_decrypted_first_message_tidied(self):
        long = "aku   lagi\ncapek\tbanget " + "x" * 200
        sessions, _ = self._list([row("s1", encrypt_text(long))])
        self.assertEqual(sessions[0]["session_id"], "s1")
        preview = sessions[0]["preview"]
        self.assertTrue(preview.startswith("aku lagi capek banget x"))
        self.assertEqual(len(preview), chat_route.SESSION_PREVIEW_CHARS)

    def test_undecryptable_or_missing_opening_still_lists_the_conversation(self):
        sessions, _ = self._list([row("foreign-key", "gAAAAA-not-a-valid-token"), row("no-user-turn-yet", None)])
        self.assertEqual([s["session_id"] for s in sessions], ["foreign-key", "no-user-turn-yet"])
        self.assertEqual([s["preview"] for s in sessions], [None, None])

    def test_limit_is_clamped(self):
        for asked, sent in ((0, 1), (-5, 1), (30, 30), (10_000, 100)):
            with self.subTest(asked=asked):
                _, calls = self._list([], limit=asked)
                self.assertEqual(calls[0][1][1], sent)


class PersistTurnTests(unittest.TestCase):
    def test_the_users_words_are_never_written_in_plaintext(self):
        executed = []

        class FakeConn:
            def execute(self, sql, params=()):
                executed.append((sql, params))

            def cursor(self):
                conn = self

                class Cursor:
                    def executemany(self, sql, rows):
                        for params in rows:
                            conn.execute(sql, params)

                return Cursor()

        secret = "aku tidak kuat lagi dengan semua ini"
        request = chat_route.ChatRequest(message=secret, session_id="s1")
        chat_route._persist_turn(FakeConn(), request, USER.id, "conversational", "balasan", is_high_risk=True)

        self.assertTrue(executed)
        for sql, params in executed:
            with self.subTest(sql=sql.split("(")[0]):
                # sessions used to carry message[:80] as its title; every table must get
                # ciphertext or nothing.
                self.assertNotIn(secret, [p for p in params if isinstance(p, str)])
                self.assertFalse(any(isinstance(p, str) and secret[:20] in p for p in params))


if __name__ == "__main__":
    unittest.main()
