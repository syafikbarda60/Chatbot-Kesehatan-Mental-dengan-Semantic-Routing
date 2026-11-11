"""The SSE contract for /chat/stream. No database, model, or network is used.

Run from apps/backend: python -m unittest discover -s tests/unit -v

Regression guard: persisting the turn used to sit outside the generator's try block, so a
failed write (stale JWT whose user_id no longer exists, RLS denial, pool timeout) aborted
the chunked response before its terminating chunk. The client saw
ERR_INCOMPLETE_CHUNKED_ENCODING and discarded an answer it had already received in full.
"""
import contextlib
import os
import sys
import types
import unittest
import unittest.mock

from cryptography.fernet import Fernet

os.environ.setdefault("JWT_SECRET", "isolated-chat-stream-test-key-not-for-real-sessions")
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

USER_ID = "11111111-1111-4111-8111-111111111111"

# core.db is imported for its side effect of opening a connection pool; keep it unloaded.
fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
fake_db.db = lambda *args, **kwargs: contextlib.nullcontext(None)
sys.modules["core.db"] = fake_db

# services.chatbot.core builds a SemanticRouter at import, which calls Ollama for the
# encoder dimensions. services.chatbot.rag pulls in the embedding client the same way.
fake_core = types.ModuleType("services.chatbot.core")
fake_core.semantic_router = lambda message: types.SimpleNamespace(name="conversational")
fake_core.chat_stream = lambda *a, **k: iter(["Aku ", "di ", "sini."])
fake_core.chat = lambda *a, **k: "Aku di sini."
sys.modules["services.chatbot.core"] = fake_core

fake_rag = types.ModuleType("services.chatbot.rag")
fake_rag.retrieve_docs = lambda *a, **k: []
sys.modules["services.chatbot.rag"] = fake_rag

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from auth import AuthUser, get_current_user  # noqa: E402
from routes import chat as chat_route  # noqa: E402


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(chat_route.chat_router)
    app.dependency_overrides[get_current_user] = lambda: AuthUser(id=USER_ID, email="a@example.com")
    return TestClient(app)


class ChatStreamTests(unittest.TestCase):
    def setUp(self):
        # Patch the names routes.chat bound at import, not just sys.modules: when another
        # test file imported routes.chat first, the stubs above never reached it, and these
        # tests silently streamed whatever that file had stubbed in.
        for name, value in {
            "semantic_router": fake_core.semantic_router,
            "chat_stream": fake_core.chat_stream,
            "db": lambda *a, **k: contextlib.nullcontext(None),
        }.items():
            patcher = unittest.mock.patch.object(chat_route, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _post(self, session_id="sess-1"):
        return _client().post("/chat/stream", json={"message": "aku lagi sedih", "session_id": session_id})

    def test_successful_turn_streams_tokens_and_terminates(self):
        persisted = []
        with unittest.mock.patch.object(chat_route, "_persist_user_turn", lambda *a: persisted.append("user")), \
             unittest.mock.patch.object(chat_route, "_persist_assistant_turn", lambda *a: persisted.append("assistant")):
            body = self._post().text
        self.assertIn('"token": "Aku "', body)
        self.assertTrue(body.endswith("data: [DONE]\n\n"), body[-60:])
        # The question is saved before generation (a killed stream keeps it); the reply after.
        self.assertEqual(persisted, ["user", "assistant"])

    def test_failed_user_persist_still_streams(self):
        def boom(*args):
            raise RuntimeError("connection pool exhausted")

        with unittest.mock.patch.object(chat_route, "_persist_user_turn", boom), \
             unittest.mock.patch.object(chat_route, "_persist_assistant_turn", lambda *a: None):
            with self.assertLogs(level="ERROR"):
                body = self._post().text
        self.assertIn('"token": "sini."', body)
        self.assertTrue(body.endswith("data: [DONE]\n\n"), body[-60:])

    def test_failed_persist_still_terminates_the_stream(self):
        def boom(*args):
            raise RuntimeError("insert or update on table \"sessions\" violates foreign key constraint")

        with unittest.mock.patch.object(chat_route, "_persist_user_turn", lambda *a: None), \
             unittest.mock.patch.object(chat_route, "_persist_assistant_turn", boom):
            with self.assertLogs(level="ERROR"):
                body = self._post().text
        # The answer the user already received must survive, and the stream must close
        # cleanly so the client resolves instead of raising a transport error.
        self.assertIn('"token": "sini."', body)
        self.assertTrue(body.endswith("data: [DONE]\n\n"), body[-60:])
        # Failed persistence is not a generation failure: an `error` frame would make the
        # client replace a good answer with its "aku sedang tidak bisa dihubungi" fallback.
        self.assertNotIn('"error"', body)

    def test_no_session_id_skips_persistence_entirely(self):
        def boom(*args):
            raise AssertionError("must not persist without a session_id")

        with unittest.mock.patch.object(chat_route, "_persist_user_turn", boom), \
             unittest.mock.patch.object(chat_route, "_persist_assistant_turn", boom):
            body = self._post(session_id=None).text
        self.assertTrue(body.endswith("data: [DONE]\n\n"), body[-60:])


if __name__ == "__main__":
    unittest.main()
