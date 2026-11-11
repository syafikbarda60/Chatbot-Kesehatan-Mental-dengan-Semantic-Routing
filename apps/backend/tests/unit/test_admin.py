"""Isolated API contract tests. No live database, AI, or application data is used.

Run from apps/backend: python -m unittest discover -s tests/unit -v
Requires FastAPI, httpx, PyJWT, python-dotenv in the test environment.
"""
import os
import sys
import types
import unittest
from unittest.mock import patch
from uuid import UUID

os.environ["JWT_SECRET"] = "isolated-contract-test-key-not-for-real-sessions"
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
fake_db = types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
# Keep the real DB module unloaded: these tests never open a connection.
sys.modules["core.db"] = fake_db

from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth
from routes import admin

ADMIN = "11111111-1111-4111-8111-111111111111"
STUDENT = "22222222-2222-4222-8222-222222222222"
COUNSELOR = "33333333-3333-4333-8333-333333333333"
STAKEHOLDER = "44444444-4444-4444-8444-444444444444"
ROLES = {ADMIN: "admin", STUDENT: "mahasiswa", COUNSELOR: "konselor", STAKEHOLDER: "pemangku_jabatan"}
app = FastAPI()
app.include_router(admin.router)
client = TestClient(app)


class AdminContractTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.auth_patch = patch.object(auth, "query", side_effect=self.auth_query)
        self.data_patch = patch.object(admin, "query", side_effect=self.data_query)
        self.auth_patch.start()
        self.data_patch.start()

    def tearDown(self):
        self.auth_patch.stop()
        self.data_patch.stop()

    def auth_query(self, sql, params=(), user_id=None):
        return [{"role": ROLES.get(user_id, "mahasiswa")}]

    def data_query(self, sql, params=(), user_id=None):
        self.calls.append((sql, params, user_id))
        if "count(*)" in sql:
            return [{"total": 1}]
        if "from users" in sql:
            if params[0] != STUDENT:
                return []
            return [{"user_id": STUDENT, "name": "Test Student", "email": "test@example.com",
                     "nim": None, "role": "mahasiswa", "created_at": "2026-09-01T00:00:00Z"}]
        if "counseling_bookings" in sql:
            return [{"counseling_booking_id": ADMIN, "status": "pending", "date": "2026-09-23",
                     "start_time": "09:00:00", "end_time": "10:00:00"}]
        return [{"assessment_id": ADMIN, "user_id": STUDENT, "instrument_type": "PHQ-9",
                 "score": 15, "severity": "severe", "taken_at": "2026-09-23T00:00:00Z",
                 "name": None if user_id == COUNSELOR else "Test Student", "nim": None}]

    def get(self, path, identity=ADMIN):
        headers = {} if identity is None else {"Authorization": "Bearer " + auth.create_token(identity, "test@example.com")}
        return client.get(path, headers=headers)

    def test_every_endpoint_requires_authentication(self):
        for path in ["/admin/assessments", f"/admin/users/{STUDENT}",
                     f"/admin/users/{STUDENT}/assessments", f"/admin/users/{STUDENT}/bookings"]:
            with self.subTest(path=path):
                self.assertIn(self.get(path, None).status_code, (401, 403))
        self.assertEqual(self.calls, [])

    def test_student_denied_every_admin_endpoint(self):
        for path in ["/admin/assessments", f"/admin/users/{STUDENT}",
                     f"/admin/users/{STUDENT}/assessments", f"/admin/users/{STUDENT}/bookings"]:
            self.assertEqual(self.get(path, STUDENT).status_code, 403)
        self.assertEqual(self.calls, [])

    def test_counselor_cannot_read_directory_profile(self):
        self.assertEqual(self.get(f"/admin/users/{STUDENT}", COUNSELOR).status_code, 403)

    def test_counselor_can_review_results_without_identity(self):
        response = self.get("/admin/assessments", COUNSELOR)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["assessments"][0]["name"])
        self.assertTrue(all(call[2] == COUNSELOR for call in self.calls))
        self.assertIn("left join users", self.calls[-1][0])

    def test_admin_and_stakeholder_profile(self):
        for uid in (ADMIN, STAKEHOLDER):
            response = self.get(f"/admin/users/{STUDENT}", uid)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["user"]["user_id"], STUDENT)
            self.assertNotIn("password_hash", self.calls[-1][0])

    def test_unknown_user_404(self):
        self.assertEqual(self.get(f"/admin/users/{ADMIN}").status_code, 404)

    def test_uuid_validation(self):
        self.assertEqual(self.get("/admin/users/not-a-uuid/assessments").status_code, 422)

    def test_filter_validation(self):
        # instrument is a free-form code now (versioned instruments), so unknown values just
        # return no rows; the remaining filters are still validated.
        for query in ["severity=critical", "page=0", "page_size=101",
                      "date_from=invalid", "date_from=2026-09-30&date_to=2026-09-01"]:
            with self.subTest(query=query):
                self.assertEqual(self.get("/admin/assessments?" + query).status_code, 422)
        self.assertEqual(self.get("/admin/assessments?instrument=DASS-21").status_code, 200)

    def test_search_parameterized_and_literal(self):
        response = client.get("/admin/assessments", params={"search": "'; DROP TABLE users; --%_"},
                              headers={"Authorization": "Bearer " + auth.create_token(ADMIN, "test@example.com")})
        self.assertEqual(response.status_code, 200)
        sql, params, identity = self.calls[-1]
        self.assertNotIn("DROP TABLE", sql)
        self.assertIn("\\%\\_", params[9])
        self.assertEqual(identity, ADMIN)

    def test_pagination_and_filters(self):
        response = self.get("/admin/assessments?severity=severe&instrument=PHQ-9&page=3&page_size=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.calls[-1][1][-2:], (10, 20))
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["page"], 3)

    def test_history_is_scoped_to_target_and_operator(self):
        for suffix in ("assessments", "bookings"):
            response = self.get(f"/admin/users/{STUDENT}/{suffix}", COUNSELOR)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.calls[-1][1][0], STUDENT)
            self.assertEqual(self.calls[-1][2], COUNSELOR)

    def test_oversized_pages_rejected(self):
        for path in ["/admin/assessments", f"/admin/users/{STUDENT}/assessments", f"/admin/users/{STUDENT}/bookings"]:
            self.assertEqual(self.get(path + "?page=2147483648").status_code, 422)
        self.assertEqual(self.calls, [])

    def test_undated_assessments_sort_last(self):
        for path in ["/admin/assessments", f"/admin/users/{STUDENT}/assessments"]:
            self.get(path)
            self.assertIn("taken_at desc nulls last", self.calls[-1][0].lower())

    def test_queries_do_not_access_sensitive_content(self):
        self.get("/admin/assessments")
        self.get(f"/admin/users/{STUDENT}")
        self.get(f"/admin/users/{STUDENT}/assessments")
        self.get(f"/admin/users/{STUDENT}/bookings")
        for sql, _, _ in self.calls:
            for forbidden in ("password_hash", "triggered_input", "journals", "messages", "answers", "auth_lookup", "security definer"):
                self.assertNotIn(forbidden, sql.lower())


if __name__ == "__main__":
    unittest.main()
