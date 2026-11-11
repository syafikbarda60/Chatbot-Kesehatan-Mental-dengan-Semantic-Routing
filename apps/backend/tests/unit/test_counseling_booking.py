"""Students booking counseling from the mobile calendar. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v

The mobile app now books through the Iteration 3 request -> admin assignment flow. A
request may carry the slot the student picked; these guard that the pick can only be a
slot the calendar really offers, and that two students cannot claim the same one.
"""
import os
import pathlib
import sys
import types
import unittest
from contextlib import contextmanager
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-counseling-booking-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from routes import iteration3  # noqa: E402

STUDENT = "22222222-2222-4222-8222-222222222222"
COUNSELOR = "33333333-3333-4333-8333-333333333333"
ROLES = {STUDENT: "mahasiswa", COUNSELOR: "konselor"}
START, END = "2026-10-12T03:00:00+00:00", "2026-10-12T04:00:00+00:00"  # Senin 10.00–11.00 WIB

app = FastAPI()
app.include_router(iteration3.student_router)
client = TestClient(app)


class FakeConn:
    """Records statements; answers the role lookup, the open-slot check, and the insert."""

    def __init__(self, role="mahasiswa", slot_open=True):
        self.role, self.slot_open, self.executed = role, slot_open, []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        result = None
        if "select role from users" in sql:
            result = {"role": self.role}
        elif "from counseling_open_slots" in sql:
            result = {"?column?": 1} if self.slot_open else None
        elif "insert into counseling_requests" in sql:
            result = {"counseling_request_id": "r1", "status": "requested"}
        return types.SimpleNamespace(fetchone=lambda: result)

    def statements(self, needle):
        return [i for i, (sql, _) in enumerate(self.executed) if needle in sql]


class CounselingBookingTests(unittest.TestCase):
    def setUp(self):
        self.queries = []
        for target, name, value in (
            (auth, "query", lambda sql, params=(), user_id=None: [{"role": ROLES[user_id]}] if user_id in ROLES else []),
            (iteration3, "query", self._query),
        ):
            patcher = patch.object(target, name, side_effect=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _query(self, sql, params=(), user_id=None):
        self.queries.append((sql, params, user_id))
        return []

    def _with_conn(self, conn):
        @contextmanager
        def fake(user_id=None):
            yield conn
        patcher = patch.object(iteration3, "db", fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return conn

    def _headers(self, who=STUDENT):
        return {"Authorization": "Bearer " + auth.create_token(who, "x@example.com")}

    def _book(self, **slot):
        body = {"preferred_counselor_id": COUNSELOR, "preferred_starts_at": START, "preferred_ends_at": END}
        body.update(slot)
        return client.post("/counseling/requests", headers=self._headers(), json=body)

    # ── /counseling/slots ──────────────────────────────────────────

    def test_slots_come_from_the_shared_slot_function_scoped_to_the_caller(self):
        r = client.get(f"/counseling/slots?counselor_id={COUNSELOR}&date_from=2026-10-05&date_to=2026-12-03", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["session_minutes"], iteration3.SESSION_MINUTES)
        sql, params, user_id = self.queries[-1]
        self.assertIn("counseling_open_slots", sql)
        self.assertEqual(params, (COUNSELOR, iteration3.date(2026, 10, 5), iteration3.date(2026, 12, 3), iteration3.SESSION_MINUTES))
        self.assertEqual(user_id, STUDENT)

    def test_slot_range_is_bounded_before_touching_the_database(self):
        for frm, to in (("2026-10-05", "2026-12-31"), ("2026-10-10", "2026-10-05")):
            with self.subTest(frm=frm, to=to):
                r = client.get(f"/counseling/slots?counselor_id={COUNSELOR}&date_from={frm}&date_to={to}", headers=self._headers())
                self.assertEqual(r.status_code, 422)
        self.assertEqual(self.queries, [])

    # ── POST /counseling/requests with a picked slot ───────────────

    def test_an_offered_slot_is_requested_under_the_counselor_lock(self):
        conn = self._with_conn(FakeConn())
        r = self._book()
        self.assertEqual(r.status_code, 201, r.text)
        lock, check, insert = conn.statements("pg_advisory_xact_lock"), conn.statements("counseling_open_slots"), conn.statements("insert into")
        # Lock, then check, then insert: the same lock assign takes, so neither another
        # student nor an admin assignment can take the slot in between.
        self.assertTrue(lock and check and insert)
        self.assertLess(lock[0], check[0])
        self.assertLess(check[0], insert[0])
        self.assertEqual(conn.executed[lock[0]][1], ("appointment:" + COUNSELOR,))
        params = conn.executed[insert[0]][1]
        self.assertEqual(params[0], STUDENT)
        self.assertEqual(params[2], COUNSELOR)

    def test_a_slot_the_calendar_does_not_offer_is_refused(self):
        conn = self._with_conn(FakeConn(slot_open=False))
        r = self._book()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(conn.statements("insert into"), [])

    def test_the_check_matches_the_exact_session_not_any_overlap(self):
        conn = self._with_conn(FakeConn())
        self._book()
        sql, params = conn.executed[conn.statements("counseling_open_slots")[0]]
        self.assertIn("where starts_at=%s and ends_at=%s", sql)
        self.assertEqual(params[3], iteration3.SESSION_MINUTES)

    def test_half_a_slot_is_rejected_before_the_database(self):
        conn = self._with_conn(FakeConn())
        for missing in ("preferred_counselor_id", "preferred_starts_at", "preferred_ends_at"):
            with self.subTest(missing=missing):
                self.assertEqual(self._book(**{missing: None}).status_code, 422)
        self.assertEqual(conn.executed, [])

    def test_a_time_without_a_timezone_is_rejected(self):
        self._with_conn(FakeConn())
        self.assertEqual(self._book(preferred_starts_at="2026-10-12T10:00:00", preferred_ends_at="2026-10-12T11:00:00").status_code, 422)

    def test_a_plain_request_without_a_slot_still_works(self):
        conn = self._with_conn(FakeConn())
        r = client.post("/counseling/requests", headers=self._headers(), json={"preferred_context": "butuh teman cerita"})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(conn.statements("counseling_open_slots"), [])
        self.assertEqual(conn.executed[conn.statements("insert into")[0]][1][2:], (None, None, None))

    def test_only_students_can_request(self):
        conn = self._with_conn(FakeConn(role="konselor"))
        self.assertEqual(self._book().status_code, 403)
        self.assertEqual(conn.statements("insert into"), [])

    # ── GET /counseling/requests ───────────────────────────────────

    def test_own_requests_are_scoped_and_name_counselors_without_reading_users(self):
        r = client.get("/counseling/requests", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        sql, params, user_id = self.queries[-1]
        self.assertIn("where cr.student_id=%s", sql)
        self.assertEqual((params, user_id), ((STUDENT,), STUDENT))
        # users RLS would return NULL names to a student; the directory function is the way.
        self.assertIn("list_konselor()", sql)
        self.assertNotIn("join users", sql)


class SlotFunctionMigrationTests(unittest.TestCase):
    """The SQL function behind both endpoints, read from the migration that defines it."""

    @classmethod
    def setUpClass(cls):
        path = pathlib.Path(__file__).resolve().parents[4] / "db" / "migrations" / "006_counseling_preferred_slot.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_it_reveals_only_free_times(self):
        returns = self.sql.split("returns table", 1)[1].split(")", 1)[0]
        self.assertEqual(returns.split(), ["(starts_at", "timestamptz,", "ends_at", "timestamptz"])

    def test_it_runs_as_definer_and_the_app_role_may_call_it(self):
        self.assertIn("security definer", self.sql)
        self.assertIn("set search_path = public", self.sql)
        self.assertIn("grant execute on function counseling_open_slots(uuid, date, date, int) to sajiwa_app", self.sql)

    def test_it_excludes_everything_assign_would_reject(self):
        for source in ("counselor_blocked_periods", "counseling_appointments", "status = 'requested'", "starts_at > now()"):
            with self.subTest(source=source):
                self.assertIn(source, self.sql)

    def test_it_bounds_its_own_work(self):
        self.assertIn("p_to - p_from between 0 and 92", self.sql)

    def test_it_is_recorded_for_the_migration_runner(self):
        self.assertIn("insert into schema_migrations(version) values ('006_counseling_preferred_slot')", self.sql)


if __name__ == "__main__":
    unittest.main()
