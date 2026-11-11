"""Live change notices on WebSocket /realtime. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v

A notice names only the area that changed, never a row: the dashboard refetches through the
REST routes, so their role checks stay the only gate on student data. The token travels in the
first message, not the URL, so it never lands in an access log.
"""
import os
import sys
import time
import types
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-realtime-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI, WebSocketDisconnect  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from routes import realtime  # noqa: E402

ADMIN = "11111111-1111-4111-8111-111111111111"
STUDENT = "22222222-2222-4222-8222-222222222222"
COUNSELOR = "33333333-3333-4333-8333-333333333333"
ROLES = {ADMIN: "admin", STUDENT: "mahasiswa", COUNSELOR: "konselor"}

app = FastAPI()
app.include_router(realtime.router)
client = TestClient(app)


def token(who):
    return auth.create_token(who, "x@example.com")


class RealtimeTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(auth, "query", side_effect=lambda sql, params=(), user_id=None: [{"role": ROLES[user_id]}] if user_id in ROLES else [])
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_staff_hear_which_area_changed_and_nothing_more(self):
        with client.websocket_connect("/realtime") as ws:
            ws.send_json({"type": "auth", "token": token(ADMIN)})
            self.assertEqual(ws.receive_json(), {"type": "ready"})
            realtime.publish("guardrail_logs")
            self.assertEqual(ws.receive_json(), {"type": "changed", "topic": "signals"})

    def test_a_bad_or_missing_token_is_turned_away(self):
        for first in ({"type": "auth", "token": "not-a-jwt"}, {"type": "auth"}, {"hello": 1}):
            with self.subTest(first=first), client.websocket_connect("/realtime") as ws:
                ws.send_json(first)
                with self.assertRaises(WebSocketDisconnect) as closed:
                    ws.receive_json()
                self.assertEqual(closed.exception.code, 4401)

    def test_students_cannot_listen_to_staff_notices(self):
        with client.websocket_connect("/realtime") as ws:
            ws.send_json({"type": "auth", "token": token(STUDENT)})
            with self.assertRaises(WebSocketDisconnect) as closed:
                ws.receive_json()
            self.assertEqual(closed.exception.code, 4403)

    def test_each_staff_area_is_announced_and_private_student_tables_never_are(self):
        expected = {
            "assessment_category_results": "signals",
            "counseling_requests": "requests",
            "counseling_appointments": "schedule",
            "counselor_blocked_periods": "schedule",
            "counselor_exception_requests": "schedule",
            # the bell refetches its own list; the notice says only that some list changed
            "notifications": "notifications",
            "admin_notifications": "notifications",
        }
        with client.websocket_connect("/realtime") as ws:
            ws.send_json({"type": "auth", "token": token(COUNSELOR)})
            ws.receive_json()
            for table, topic in expected.items():
                with self.subTest(table=table):
                    # journals and chat messages are the student's own; staff must not even learn they changed
                    realtime.publish("journals")
                    realtime.publish("messages")
                    realtime.publish(table)
                    self.assertEqual(ws.receive_json(), {"type": "changed", "topic": topic})

    def test_a_session_that_expires_while_connected_is_closed_not_served(self):
        with client.websocket_connect("/realtime") as ws:
            ws.send_json({"type": "auth", "token": token(ADMIN)})
            ws.receive_json()
            a_year_on = time.time() + 365 * 24 * 3600
            with patch.object(realtime.time, "time", return_value=a_year_on):
                realtime.publish("guardrail_logs")
                with self.assertRaises(WebSocketDisconnect) as closed:
                    ws.receive_json()
            self.assertEqual(closed.exception.code, 4401)


if __name__ == "__main__":
    unittest.main()
