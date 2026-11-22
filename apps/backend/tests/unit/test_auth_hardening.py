"""MASVS-AUTH-1 / MASVS-CODE-4 hardening: login and OTP throttling, password floor, field bounds.
No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-hardening-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from routes import account, assessment, journal  # noqa: E402

STUDENT = "33333333-3333-4333-8333-333333333333"
app = FastAPI()
for r in (account.router, assessment.router, journal.router):
    app.include_router(r)
app.dependency_overrides[auth.get_current_user] = lambda: auth.AuthUser(id=STUDENT, email="s@example.com", role="mahasiswa")
client = TestClient(app)
USER = {"user_id": STUDENT, "email": "s@example.com", "name": "S", "nim": None, "role": "mahasiswa", "password_hash": "x"}


class ThrottleTests(unittest.TestCase):
    def setUp(self):
        account._fails.clear()

    def login(self, pw, email="s@example.com"):
        with patch.object(account, "query", return_value=[USER]), \
             patch.object(account, "_verify", side_effect=lambda p, h: p == "benar-sekali"):
            return client.post("/auth/login", json={"email": email, "password": pw}).status_code

    def test_sixth_wrong_password_is_throttled(self):
        self.assertEqual([self.login("salah") for _ in range(5)], [401] * 5)
        self.assertEqual(self.login("salah"), 429)
        self.assertEqual(self.login("benar-sekali"), 429, "the right password must wait too")

    def test_other_email_is_not_affected(self):
        for _ in range(5):
            self.login("salah")
        self.assertEqual(self.login("salah", "lain@example.com"), 401)

    def test_success_resets_the_count(self):
        for _ in range(4):
            self.login("salah")
        self.assertEqual(self.login("benar-sekali"), 200)
        self.assertEqual([self.login("salah") for _ in range(5)], [401] * 5)

    def test_wrong_otp_is_throttled(self):
        body = {"email": "s@example.com", "otp": "000000", "new_password": "SandiBaru-2026"}
        with patch.object(account, "query", return_value=[]):
            codes = [client.post("/auth/reset-password/confirm", json=body).status_code for _ in range(6)]
        self.assertEqual(codes, [400] * 5 + [429])


class BoundsTests(unittest.TestCase):
    def test_register_rejects_short_password_and_long_nim(self):
        base = {"email": "baru@example.com", "password": "SandiUji-2026", "name": "Baru"}
        self.assertEqual(client.post("/auth/register", json={**base, "password": "1"}).status_code, 422)
        self.assertEqual(client.post("/auth/register", json={**base, "nim": "9" * 40}).status_code, 422)

    def test_journal_id_must_be_a_uuid(self):
        self.assertEqual(client.patch("/journal/bukan-uuid", json={"content": "x"}).status_code, 422)
        self.assertEqual(client.delete("/journal/bukan-uuid").status_code, 422)

    def test_assessment_score_is_bounded(self):
        body = {"answers": [{"question_id": 1, "score": 999}], "instrument_type": "PHQ-9"}
        self.assertEqual(client.post("/assessment/submit", json=body).status_code, 422)

    def test_notify_risk_files_for_the_caller_not_the_body(self):
        seen = []
        with patch.object(assessment, "query", side_effect=lambda sql, params=(), user_id=None: seen.append(params) or []):
            r = client.post("/assessment/notify-risk", json={"user_id": "orang-lain", "assessment_id": "a", "score": 0})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(seen[0][0], STUDENT)


if __name__ == "__main__":
    unittest.main()
