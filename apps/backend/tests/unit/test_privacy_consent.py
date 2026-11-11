"""Privacy walkthrough shown once per account. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import pathlib
import sys
import types
import unittest
from contextlib import contextmanager
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-privacy-consent-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from routes import account  # noqa: E402

STUDENT = "22222222-2222-4222-8222-222222222222"
WHEN = "2026-10-16T02:00:00+00:00"

app = FastAPI()
app.include_router(account.router)
client = TestClient(app)


class FakeConn:
    def __init__(self):
        self.executed = []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        return types.SimpleNamespace(fetchone=lambda: {"accepted_at": WHEN})


class PrivacyConsentTests(unittest.TestCase):
    def setUp(self):
        self.stored = []
        self.queries = []
        for target, name, value in (
            (auth, "query", lambda sql, params=(), user_id=None: [{"role": "mahasiswa"}] if user_id == STUDENT else []),
            (account, "query", self._query),
        ):
            patcher = patch.object(target, name, side_effect=value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.conn = FakeConn()

        @contextmanager
        def fake(user_id=None):
            self.db_user = user_id
            yield self.conn
        patcher = patch.object(account, "db", fake)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _query(self, sql, params=(), user_id=None):
        self.queries.append((sql, params, user_id))
        return self.stored

    def _headers(self):
        return {"Authorization": "Bearer " + auth.create_token(STUDENT, "x@example.com")}

    def test_a_new_account_has_not_accepted(self):
        r = client.get("/auth/consent", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["accepted_at"])
        sql, params, user_id = self.queries[-1]
        self.assertIn("from privacy_consents where user_id = %s", sql)
        self.assertEqual((params, user_id), ((STUDENT,), STUDENT))

    def test_an_accepted_account_is_not_asked_again(self):
        self.stored = [{"accepted_at": WHEN}]
        self.assertEqual(client.get("/auth/consent", headers=self._headers()).json()["accepted_at"], WHEN)

    def test_accepting_records_it_for_the_caller_and_keeps_the_first_time(self):
        r = client.post("/auth/consent", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["accepted_at"], WHEN)
        self.assertEqual(self.db_user, STUDENT)
        insert, params = self.conn.executed[0]
        self.assertIn("on conflict (user_id) do nothing", insert)
        self.assertEqual(params, (STUDENT,))

    def test_it_needs_a_signed_in_account(self):
        self.assertEqual(client.get("/auth/consent").status_code, 401)
        self.assertEqual(client.post("/auth/consent").status_code, 401)


class PrivacyConsentMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = pathlib.Path(__file__).resolve().parents[4] / "db" / "migrations" / "007_privacy_consent.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_rows_are_private_to_their_account(self):
        self.assertIn("enable row level security", self.sql)
        self.assertIn("using (app_user_id() = user_id) with check (app_user_id() = user_id)", self.sql)

    def test_it_is_recorded_for_the_migration_runner(self):
        self.assertIn("insert into schema_migrations(version) values ('007_privacy_consent')", self.sql)


if __name__ == "__main__":
    unittest.main()
