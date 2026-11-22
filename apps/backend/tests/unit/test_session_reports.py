"""Attendance and session reports (routes/session_reports.py). No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v
"""
import os
import sys
import types
import unittest
from contextlib import contextmanager
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-session-reports-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from psycopg.errors import NoDataFound, ObjectNotInPrerequisiteState  # noqa: E402

import auth  # noqa: E402
from routes import session_reports  # noqa: E402

COUNSELOR = "33333333-3333-4333-8333-333333333333"
STUDENT = "22222222-2222-4222-8222-222222222222"
ADMIN = "44444444-4444-4444-8444-444444444444"
SESSION = "55555555-5555-4555-8555-555555555555"
ROLES = {COUNSELOR: "konselor", STUDENT: "mahasiswa", ADMIN: "admin"}

app = FastAPI()
app.include_router(session_reports.router)
app.include_router(session_reports.admin_router)
client = TestClient(app)

REPORT = {"student": {"summary": "  Kita membahas cara mengatur jadwal belajar.  ", "follow_up": " "},
          "management": {"topic": "akademik", "risk_level": "rendah", "follow_up": "next_session", "notes": "Stabil"}}


class FakeConn:
    def __init__(self, session_status="completed", raise_on_attendance=None):
        self.status, self.error, self.executed = session_status, raise_on_attendance, []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        row = None
        if "record_counseling_attendance" in sql:
            if self.error:
                raise self.error()
            row = {"status": "completed" if params[1] else "no_show"}
        elif sql.startswith("select a.counseling_appointment_id"):
            row = {"counseling_appointment_id": SESSION, "status": self.status} if self.status else None
        elif sql.startswith("insert into"):
            row = {"saved": True}
        return types.SimpleNamespace(fetchone=lambda: row)


def headers(user):
    return {"Authorization": "Bearer " + auth.create_token(user, "x@example.com")}


class SessionReportTests(unittest.TestCase):
    def setUp(self):
        p = patch.object(auth, "query", side_effect=lambda sql, params=(), user_id=None:
                         [{"role": ROLES[user_id], "revoked": False}] if user_id in ROLES else [])
        p.start(); self.addCleanup(p.stop)
        self.conn = FakeConn()

        @contextmanager
        def fake_db_ctx(user_id=None):
            self.db_user = user_id
            yield self.conn
        p = patch.object(session_reports, "db", fake_db_ctx)
        p.start(); self.addCleanup(p.stop)

    def test_students_cannot_record_attendance_or_reports(self):
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/attendance", json={"attended": True}, headers=headers(STUDENT)).status_code, 403)
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/report", json=REPORT, headers=headers(STUDENT)).status_code, 403)
        self.assertEqual(client.get(f"/counseling/sessions/{SESSION}", headers=headers(STUDENT)).status_code, 403)

    def test_counselor_marks_attendance_through_the_database_function(self):
        r = client.put(f"/counseling/sessions/{SESSION}/attendance", json={"attended": False}, headers=headers(COUNSELOR))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["status"], "no_show")
        sql, params = self.conn.executed[-1]
        self.assertIn("record_counseling_attendance", sql)
        self.assertEqual((params, self.db_user), ((SESSION, False), COUNSELOR))

    def test_attendance_errors_from_the_database_map_to_http(self):
        self.conn.error = NoDataFound
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/attendance", json={"attended": True}, headers=headers(COUNSELOR)).status_code, 404)
        self.conn.error = ObjectNotInPrerequisiteState
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/attendance", json={"attended": True}, headers=headers(ADMIN)).status_code, 409)

    def test_report_needs_an_attended_session(self):
        self.conn.status = "confirmed"
        r = client.put(f"/counseling/sessions/{SESSION}/report", json=REPORT, headers=headers(COUNSELOR))
        self.assertEqual(r.status_code, 409)
        self.assertFalse(any(sql.startswith("insert") for sql, _ in self.conn.executed))
        self.conn.status = None   # RLS hid it: not this counselor's session
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/report", json=REPORT, headers=headers(COUNSELOR)).status_code, 404)

    def test_report_saves_both_parts_trimmed_with_the_author(self):
        r = client.put(f"/counseling/sessions/{SESSION}/report", json=REPORT, headers=headers(ADMIN))
        self.assertEqual(r.status_code, 200, r.text)
        inserts = [(sql, params) for sql, params in self.conn.executed if sql.startswith("insert")]
        self.assertIn("counseling_student_reports", inserts[0][0])
        self.assertEqual(inserts[0][1], (SESSION, "Kita membahas cara mengatur jadwal belajar.", None, ADMIN))
        self.assertIn("counseling_management_reports", inserts[1][0])
        self.assertEqual(inserts[1][1], (SESSION, "akademik", "rendah", "next_session", "Stabil", ADMIN))

    def test_report_validation(self):
        blank = {**REPORT, "student": {"summary": "   "}}
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/report", json=blank, headers=headers(COUNSELOR)).status_code, 422)
        bad_risk = {**REPORT, "management": {**REPORT["management"], "risk_level": "kritis"}}
        self.assertEqual(client.put(f"/counseling/sessions/{SESSION}/report", json=bad_risk, headers=headers(COUNSELOR)).status_code, 422)

    def test_only_admins_list_session_reports(self):
        q = "/admin/counseling/session-reports?date_from=2026-11-01&date_to=2026-11-30"
        self.assertEqual(client.get(q, headers=headers(COUNSELOR)).status_code, 403)
        with patch.object(session_reports, "query", return_value=[{"counseling_appointment_id": SESSION}]) as q_mock:
            r = client.get(q, headers=headers(ADMIN))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["total"], 1)
        self.assertEqual(q_mock.call_args.kwargs["user_id"], ADMIN)
        self.assertEqual(client.get("/admin/counseling/session-reports?date_from=2026-11-30&date_to=2026-11-01", headers=headers(ADMIN)).status_code, 422)


if __name__ == "__main__":
    unittest.main()
