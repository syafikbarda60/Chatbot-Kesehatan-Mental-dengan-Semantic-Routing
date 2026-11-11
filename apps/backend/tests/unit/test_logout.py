"""MASVS-AUTH-1: logout revokes the token server-side. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-logout-test-key")
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
app = FastAPI()
app.include_router(account.router)
client = TestClient(app)


class LogoutTests(unittest.TestCase):
    def setUp(self):
        self.revoked = set()

        def auth_query(sql, params=(), user_id=None):
            jti, uid = params
            return [{"role": "mahasiswa", "revoked": jti in self.revoked}] if uid == STUDENT else []

        def account_query(sql, params=(), user_id=None):
            if sql.startswith("insert into revoked_tokens"):
                self.revoked.add(params[0])
            return []

        for target, fn in ((auth, auth_query), (account, account_query)):
            p = patch.object(target, "query", side_effect=fn)
            p.start()
            self.addCleanup(p.stop)

    def test_token_is_refused_after_logout_but_a_new_login_still_works(self):
        old = {"Authorization": "Bearer " + auth.create_token(STUDENT, "x@example.com")}
        self.assertEqual(client.get("/auth/me", headers=old).status_code != 401, True)
        self.assertEqual(client.post("/auth/logout", headers=old).status_code, 200)
        self.assertEqual(client.get("/auth/me", headers=old).status_code, 401)
        self.assertEqual(client.post("/auth/logout", headers=old).status_code, 401)
        fresh = {"Authorization": "Bearer " + auth.create_token(STUDENT, "x@example.com")}
        self.assertNotEqual(client.get("/auth/me", headers=fresh).status_code, 401)

    def test_tokens_expire_within_a_day_by_default(self):
        self.assertLessEqual(auth.EXPIRES_IN, 24 * 3600)


if __name__ == "__main__":
    unittest.main()
