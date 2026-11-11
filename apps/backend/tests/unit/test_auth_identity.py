"""Who a token speaks for. No database, model, or network is used.

Run from apps/backend: python -m unittest discover -s tests/unit -v

Regression guard: get_current_user used to trust the JWT subject without checking it still
existed, and require_role defaulted an unknown subject to "mahasiswa". Together a token for
a deleted user — or any token minted before the database was rebuilt — kept student access
until it expired, and its writes died on the users foreign key instead of reporting an over
session.
"""
import os
import sys
import types
import unittest
from unittest.mock import patch
from uuid import uuid4

os.environ["JWT_SECRET"] = "isolated-auth-identity-test-key-not-for-real-sessions"
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
# Keep the real DB module unloaded: these tests never open a connection.
sys.modules["core.db"] = fake_db

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402

STUDENT = str(uuid4())
ADMIN = str(uuid4())
GHOST = str(uuid4())  # signed token, no such row
ROLES = {STUDENT: "mahasiswa", ADMIN: "admin"}

app = FastAPI()


@app.get("/me")
def me(user=Depends(auth.get_current_user)):
    return {"id": user.id, "role": user.role}


@app.get("/student-only")
def student_only(user=Depends(auth.require_role("mahasiswa"))):
    return {"ok": True}


@app.get("/admin-only")
def admin_only(user=Depends(auth.require_role("admin"))):
    return {"ok": True}


client = TestClient(app)


class TokenIdentityTests(unittest.TestCase):
    def setUp(self):
        self.auth_calls = []
        self.patch = patch.object(auth, "query", side_effect=self._query)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def _query(self, sql, params=(), user_id=None):
        self.auth_calls.append((sql, params, user_id))
        role = ROLES.get(user_id)
        return [{"role": role}] if role else []

    def _get(self, path, user_id):
        token = auth.create_token(user_id, "a@example.com")
        return client.get(path, headers={"Authorization": f"Bearer {token}"})

    def test_known_subject_carries_its_database_role(self):
        res = self._get("/me", ADMIN)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"id": ADMIN, "role": "admin"})

    def test_vanished_subject_is_unauthorized_not_a_downstream_error(self):
        res = self._get("/me", GHOST)
        self.assertEqual(res.status_code, 401, res.text)
        self.assertIn("masuk lagi", res.json()["detail"])

    def test_vanished_subject_cannot_pass_a_student_gate(self):
        # The old fallback graded an unknown subject as "mahasiswa", so this returned 200.
        self.assertEqual(self._get("/student-only", GHOST).status_code, 401)

    def test_role_gate_still_separates_roles(self):
        self.assertEqual(self._get("/student-only", STUDENT).status_code, 200)
        self.assertEqual(self._get("/admin-only", ADMIN).status_code, 200)
        self.assertEqual(self._get("/admin-only", STUDENT).status_code, 403)

    def test_role_is_resolved_once_per_request(self):
        self._get("/admin-only", ADMIN)
        self.assertEqual(len(self.auth_calls), 1, self.auth_calls)
        # Scoped to the token subject, so RLS sees the caller and not a request parameter.
        self.assertEqual(self.auth_calls[0][2], ADMIN)

    def test_malformed_subject_never_reaches_sql(self):
        token = auth.create_token("not-a-uuid", "a@example.com")
        res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(self.auth_calls, [])

    def test_database_outage_is_not_reported_as_an_expired_session(self):
        # Masking it as 401 would sign every user out over a transient pool failure.
        with patch.object(auth, "query", side_effect=RuntimeError("pool timeout")):
            with self.assertRaises(RuntimeError):
                self._get("/me", ADMIN)


if __name__ == "__main__":
    unittest.main()
