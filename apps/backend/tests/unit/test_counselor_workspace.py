"""Counselor workspace: caseload, calendar, schedule exceptions. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v

The counselor comes from the token and every case query is scoped to that counselor's active
assignments; exceptions are filed by the counselor and decided only by an admin, and an
approval never cancels the sessions it overlaps.
"""
import os
import pathlib
import sys
import types
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-counselor-workspace-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from routes import counselor  # noqa: E402

COUNSELOR = "33333333-3333-4333-8333-333333333333"
OTHER = "44444444-4444-4444-8444-444444444444"
ADMIN = "11111111-1111-4111-8111-111111111111"
STUDENT = "22222222-2222-4222-8222-222222222222"
ROLES = {COUNSELOR: "konselor", OTHER: "konselor", ADMIN: "admin", STUDENT: "mahasiswa"}

app = FastAPI()
app.include_router(counselor.router)
app.include_router(counselor.admin_router)
client = TestClient(app)

TOMORROW = (datetime.now(timezone(timedelta(hours=7))) + timedelta(days=1)).date().isoformat()


def case_row(**over):
    row = {"counselor_case_assignment_id": "c1", "student_id": STUDENT, "student_name": "Mahasiswa", "nim": "1",
           "faculty_name": None, "academic_unit_name": None, "context": None, "instrument_type": "DASS-21",
           "assessment_severity": "severe", "assessment_at": None, "last_session_at": None, "next_session_at": None,
           "categories": [{"category": "depression", "severity": "extremely_severe"}, {"category": "stress", "severity": "mild"}]}
    row.update(over)
    return row


class FakeConn:
    """Records statements and answers the few lookups the exception routes make."""

    def __init__(self, overlapping=False, affected=(), request=None):
        self.overlapping, self.affected, self.request, self.executed = overlapping, list(affected), request, []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        one, many = None, []
        if "from counselor_exception_requests where counselor_id" in sql:
            one = {"?column?": 1} if self.overlapping else None
        elif "select counseling_appointment_id from counseling_appointments" in sql:
            many = [{"counseling_appointment_id": a} for a in self.affected]
        elif "insert into counselor_exception_requests" in sql:
            one = {"counselor_exception_request_id": "e1"}
        elif "insert into counselor_blocked_periods" in sql:
            one = {"counselor_blocked_period_id": "b1"}
        elif "for update" in sql:
            one = self.request
        elif sql.startswith("select "):
            one = {"counselor_exception_request_id": "e1", "status": "pending"}
        return types.SimpleNamespace(fetchone=lambda: one, fetchall=lambda: many)

    def sql(self, needle):
        return [(s, p) for s, p in self.executed if needle in s]


class CounselorWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.queries, self.answer = [], lambda sql: []
        for target, name, value in (
            (auth, "query", lambda sql, params=(), user_id=None: [{"role": ROLES[user_id]}] if user_id in ROLES else []),
            (counselor, "query", self._query),
        ):
            patcher = patch.object(target, name, side_effect=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _query(self, sql, params=(), user_id=None):
        self.queries.append((sql, params, user_id))
        return self.answer(sql)

    def _with_conn(self, conn):
        @contextmanager
        def fake(user_id=None):
            yield conn
        patcher = patch.object(counselor, "db", fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return conn

    def _headers(self, who=COUNSELOR):
        return {"Authorization": "Bearer " + auth.create_token(who, "x@example.com")}

    # ── access ─────────────────────────────────────────────────────

    def test_only_counselors_reach_the_workspace(self):
        for who in (ADMIN, STUDENT):
            with self.subTest(who=who):
                self.assertEqual(client.get("/counselor/cases", headers=self._headers(who)).status_code, 403)
        self.assertEqual(self.queries, [])

    def test_cases_are_scoped_to_the_token_counselor(self):
        self.answer = lambda sql: [case_row(next_session_at="2026-10-20T03:00:00+00:00")]
        r = client.get("/counselor/cases", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        sql, params, user_id = self.queries[0]
        self.assertIn("ca.status='active'", sql)
        self.assertEqual((params[0], user_id), (COUNSELOR, COUNSELOR))
        case = r.json()["cases"][0]
        # The worst category decides the risk; the summary carries category and severity only
        self.assertEqual(case["risk"], "critical")
        self.assertEqual(case["assessment_summary"], "DASS-21: depresi sangat berat, stres ringan")
        self.assertEqual(case["follow_up_status"], "planned")
        self.assertNotIn("categories", case)

    def test_an_unrelated_student_is_not_found_and_nothing_else_is_read(self):
        r = client.get(f"/counselor/cases/{STUDENT}", headers=self._headers(OTHER))
        self.assertEqual(r.status_code, 404)
        self.assertEqual(len(self.queries), 1)
        self.assertEqual(self.queries[0][1], (OTHER, STUDENT, STUDENT))

    def test_case_detail_never_selects_raw_answers_or_support_details(self):
        self.answer = lambda sql: [case_row()] if "counselor_case_assignments" in sql else []
        r = client.get(f"/counselor/cases/{STUDENT}", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        everything = " ".join(sql for sql, _, _ in self.queries)
        for secret in ("answers", "condition_details", "disability_details", "triggered_input", "messages", "journals"):
            self.assertNotIn(secret, everything)
        sessions = [sql for sql, _, _ in self.queries if "from counseling_appointments a left join" in sql]
        self.assertIn("a.counselor_id=%s", sessions[0])

    def test_calendar_range_is_bounded_before_touching_the_database(self):
        r = client.get("/counselor/calendar?date_from=2026-10-01&date_to=2027-03-01", headers=self._headers())
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.queries, [])

    # ── exception requests ─────────────────────────────────────────

    def _exception(self, **over):
        body = {"date": TOMORROW, "full_day": False, "start_time": "09:00", "end_time": "12:00", "reason": "Cuti", "note": ""}
        body.update(over)
        return client.post("/counselor/exception-requests", headers=self._headers(), json=body)

    def test_an_exception_records_the_sessions_it_overlaps_under_the_schedule_lock(self):
        conn = self._with_conn(FakeConn(affected=["a1"]))
        r = self._exception(counselor_id=OTHER)  # an id in the body is ignored
        self.assertEqual(r.status_code, 201, r.text)
        lock = conn.sql("pg_advisory_xact_lock")
        self.assertEqual(lock[0][1], ("appointment:" + COUNSELOR,))
        insert = conn.sql("insert into counselor_exception_requests")[0][1]
        self.assertEqual(insert[0], COUNSELOR)
        self.assertEqual(insert[-1], ["a1"])
        start, end = insert[1], insert[2]
        self.assertEqual((start.hour, end.hour, start.utcoffset()), (9, 12, timedelta(hours=7)))
        self.assertFalse(conn.sql("update counseling_appointments"))

    def test_an_overlapping_open_exception_is_refused(self):
        conn = self._with_conn(FakeConn(overlapping=True))
        self.assertEqual(self._exception().status_code, 409)
        self.assertFalse(conn.sql("insert into"))

    def test_invalid_intervals_are_refused(self):
        self._with_conn(FakeConn())
        for over in ({"end_time": "08:00"}, {"date": "2020-01-01"}, {"reason": "  "}):
            with self.subTest(over=over):
                self.assertEqual(self._exception(**over).status_code, 422)

    def test_a_full_day_exception_covers_the_whole_jakarta_day(self):
        conn = self._with_conn(FakeConn())
        self.assertEqual(self._exception(full_day=True, start_time=None, end_time=None).status_code, 201)
        start, end = conn.sql("insert into counselor_exception_requests")[0][1][1:3]
        self.assertEqual(end - start, timedelta(days=1))
        self.assertEqual((start.hour, start.utcoffset()), (0, timedelta(hours=7)))

    # ── admin decision ─────────────────────────────────────────────

    def _pending_request(self, status="pending"):
        now = datetime.now(timezone.utc)
        return {"counselor_exception_request_id": "e1", "counselor_id": COUNSELOR, "status": status,
                "starts_at": now + timedelta(days=1), "ends_at": now + timedelta(days=1, hours=2), "reason": "Cuti"}

    def test_counselors_cannot_decide_exceptions(self):
        r = client.post("/admin/counseling/exception-requests/" + COUNSELOR + "/approve", headers=self._headers(), json={})
        self.assertEqual(r.status_code, 403)

    def test_approval_blocks_the_time_but_cancels_nothing(self):
        conn = self._with_conn(FakeConn(affected=["a1", "a2"], request=self._pending_request()))
        r = client.post("/admin/counseling/exception-requests/" + COUNSELOR + "/approve", headers=self._headers(ADMIN), json={"decision_note": "ok"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(conn.sql("insert into counselor_blocked_periods"))
        update = conn.sql("update counselor_exception_requests set status='approved'")[0][1]
        self.assertEqual(update[3], ["a1", "a2"])
        self.assertFalse(conn.sql("update counseling_appointments"))

    def test_a_decided_request_cannot_be_decided_again(self):
        for action in ("approve", "reject"):
            with self.subTest(action=action):
                conn = self._with_conn(FakeConn(request=self._pending_request("approved")))
                r = client.post(f"/admin/counseling/exception-requests/{COUNSELOR}/{action}", headers=self._headers(ADMIN), json={"decision_note": "x"})
                self.assertEqual(r.status_code, 409)
                self.assertFalse(conn.sql("insert into") + conn.sql("update "))

    def test_rejection_needs_a_reason(self):
        self._with_conn(FakeConn(request=self._pending_request()))
        r = client.post(f"/admin/counseling/exception-requests/{COUNSELOR}/reject", headers=self._headers(ADMIN), json={"decision_note": " "})
        self.assertEqual(r.status_code, 422)


class CounselorWorkspaceMigration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = pathlib.Path(__file__).resolve().parents[4] / "db" / "migrations" / "008_counselor_workspace.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_broad_support_profile_read_is_replaced_by_the_case_rule(self):
        self.assertIn("drop policy if exists counselor_read_support_profiles", self.sql)
        self.assertIn("counselor_has_case(user_id)", self.sql)

    def test_case_check_and_exception_insert_are_locked_down(self):
        self.assertIn("security definer", self.sql)
        self.assertIn("status = 'pending' and reviewed_at is null and counselor_blocked_period_id is null", self.sql)

    def test_migration_is_recorded(self):
        self.assertIn("insert into schema_migrations(version) values ('008_counselor_workspace')", self.sql)


if __name__ == "__main__":
    unittest.main()
