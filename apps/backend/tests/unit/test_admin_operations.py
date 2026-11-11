"""Isolated contracts for admin-only operational endpoints; no database is opened."""
import os
import sys
import types
import unittest
from unittest.mock import patch

os.environ["JWT_SECRET"] = "isolated-operations-test-key-not-for-real-sessions"
fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = lambda *args, **kwargs: []
sys.modules["core.db"] = fake_db

from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth
from routes import admin_operations

ADMIN = "11111111-1111-4111-8111-111111111111"
COUNSELOR = "22222222-2222-4222-8222-222222222222"
STUDENT = "33333333-3333-4333-8333-333333333333"
ROLES = {ADMIN: "admin", COUNSELOR: "konselor", STUDENT: "mahasiswa"}
app = FastAPI()
app.include_router(admin_operations.router)
client = TestClient(app)


class AdminOperationsTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.auth_patch = patch.object(auth, "query", side_effect=self.auth_query)
        self.data_patch = patch.object(admin_operations, "query", side_effect=self.data_query)
        self.auth_patch.start(); self.data_patch.start()

    def tearDown(self):
        self.auth_patch.stop(); self.data_patch.stop()

    def auth_query(self, sql, params=(), user_id=None):
        return [{"role": ROLES.get(user_id, "mahasiswa")}]

    def data_query(self, sql, params=(), user_id=None):
        self.calls.append((sql, params, user_id))
        normalized = " ".join(sql.lower().split())
        if "group by 1" in normalized and "guardrail_logs" in normalized:
            return [{"signal_type": "safety", "total": 1, "unread": 1}]
        if "select g.guardrail_log_id" in normalized:
            return [{"guardrail_log_id": ADMIN, "user_id": STUDENT, "assessment_id": None, "is_read": False,
                     "notified_at": "2026-09-24T00:00:00Z", "name": "Synthetic", "nim": None,
                     "signal_type": "safety"}]
        if "from counseling_slots j" in normalized and "left join lateral" in normalized:
            return [{"counseling_slot_id": ADMIN, "counselor_id": COUNSELOR, "counselor_name": "Counselor",
                     "date": "2026-09-28", "start_time": "09:00", "end_time": "10:00",
                     "status": "available", "counseling_booking_id": None, "booking_status": None}]
        if "from users where user_id" in normalized:
            return [{"user_id": COUNSELOR}]
        if "insert into counseling_slots" in normalized:
            return [{"counseling_slot_id": ADMIN, "counselor_id": COUNSELOR, "date": "2026-09-28",
                     "start_time": "09:00", "end_time": "10:00", "status": "available"}]
        if "returning counseling_slot_id" in normalized:
            return [{"counseling_slot_id": ADMIN}]
        if "from hotlines" in normalized:
            return [{"hotline_id": ADMIN, "name": "Synthetic Hotline", "phone": "118",
                     "description": None, "created_at": "2026-01-01T00:00:00Z"}]
        if "returning hotline_id" in normalized:
            return [{"hotline_id": ADMIN, "name": "Synthetic Hotline", "phone": "118",
                     "description": None, "created_at": "2026-01-01T00:00:00Z"}]
        if "severity, count(*)" in normalized:
            return [{"severity": "severe", "count": 2}]
        if "taken_at::date" in normalized:
            return [{"date": "2026-09-24", "count": 2}]
        if "b.status, count(*)" in normalized:
            return [{"status": "pending", "count": 1}]
        if "count(*) as count from users" in normalized:
            return [{"count": 5}]
        return [{"guardrail_log_id": ADMIN}]

    def headers(self, identity=ADMIN):
        return {"Authorization": "Bearer " + auth.create_token(identity, "fixture@example.com")}

    def test_all_operational_routes_require_admin(self):
        paths = ["/admin/attention", "/admin/schedules", "/admin/hotlines", "/admin/analytics"]
        for identity in (COUNSELOR, STUDENT):
            for path in paths:
                with self.subTest(identity=identity, path=path):
                    self.assertEqual(client.get(path, headers=self.headers(identity)).status_code, 403)
        self.assertEqual(self.calls, [])

    def test_attention_excludes_raw_content(self):
        response = client.get("/admin/attention?signal=safety&unread_only=true", headers=self.headers())
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertNotIn("triggered_input", str(body))
        self.assertNotIn("session_id", str(body))
        self.assertEqual(body["signals"][0]["signal_type"], "safety")
        self.assertTrue(all(call[2] == ADMIN for call in self.calls))

    def test_schedule_list_and_create_are_parameterized(self):
        response = client.get("/admin/schedules", headers=self.headers())
        self.assertEqual(response.status_code, 200)
        response = client.post("/admin/schedules", headers=self.headers(), json={
            "counselor_id": COUNSELOR, "date": "2026-09-28",
            "start_time": "09:00:00", "end_time": "10:00:00",
        })
        self.assertEqual(response.status_code, 201)
        sql, params, identity = self.calls[-1]
        self.assertNotIn(COUNSELOR, sql)
        self.assertEqual(params[0], COUNSELOR)
        self.assertEqual(identity, ADMIN)

    def test_invalid_schedule_range_rejected_before_query(self):
        response = client.post("/admin/schedules", headers=self.headers(), json={
            "counselor_id": COUNSELOR, "date": "2026-09-28",
            "start_time": "10:00:00", "end_time": "09:00:00",
        })
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.calls, [])

    def test_hotline_crud_uses_existing_columns_only(self):
        self.assertEqual(client.get("/admin/hotlines", headers=self.headers()).status_code, 200)
        response = client.post("/admin/hotlines", headers=self.headers(), json={"name": "Synthetic Hotline", "phone": "118", "description": "Fixture"})
        self.assertEqual(response.status_code, 201)
        for sql, _, _ in self.calls:
            for forbidden in ("password", "token", "journal", "message", "triggered_input"):
                self.assertNotIn(forbidden, sql.lower())

    def test_hotline_content_edit_invalidates_explicit_active_verification(self):
        response = client.put(
            f"/admin/hotlines/{ADMIN}",
            headers=self.headers(),
            json={"name": "Updated Hotline", "verification_status": "active"},
        )
        self.assertEqual(response.status_code, 200)
        sql, params, identity = self.calls[-1]
        self.assertEqual(sql.count("%s"), len(params))
        self.assertEqual(params[3], "verification_required")
        self.assertEqual(params[4], "verification_required")
        self.assertEqual(params[5], "verification_required")
        self.assertEqual(identity, ADMIN)

    def test_analytics_returns_aggregates_only(self):
        response = client.get("/admin/analytics?date_from=2026-09-01&date_to=2026-09-30", headers=self.headers())
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["assessment_total"], 2)
        self.assertEqual(body["booking_total"], 1)
        for forbidden in ("name", "email", "nim", "user_id"):
            self.assertNotIn(forbidden, str(body).lower())


if __name__ == "__main__":
    unittest.main()
