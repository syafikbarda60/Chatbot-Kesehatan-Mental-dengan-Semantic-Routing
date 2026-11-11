"""DASS-21 batch workflow for the admin editor. No database, model, or network.

Run from apps/backend: python -m unittest discover -s tests/unit -v

The server owns the batch lifecycle: a published version is never edited (saving it starts the
next version), a batch awaiting a counselor is frozen, a stale page is refused, and only a
complete draft can be submitted.
"""
import os
import sys
import types
import unittest
from contextlib import contextmanager
from datetime import datetime, timezone
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-dass21-batch-test-key-for-hmac")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

fake_db = sys.modules.get("core.db") or types.ModuleType("core.db")
fake_db.query = getattr(fake_db, "query", lambda *a, **k: [])
fake_db.db = getattr(fake_db, "db", lambda *a, **k: None)
sys.modules["core.db"] = fake_db

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from core.dass21 import CATEGORY_ITEMS  # noqa: E402
from core.dass21_batch import batch_status, validate_dass21_questions  # noqa: E402
from routes import backend_enablement, dass21_batch  # noqa: E402

ADMIN = "11111111-1111-4111-8111-111111111111"
COUNSELOR = "33333333-3333-4333-8333-333333333333"
ROLES = {ADMIN: "admin", COUNSELOR: "konselor"}
SAVED_AT = datetime(2026, 11, 1, 8, 30, 15, 123456, tzinfo=timezone.utc)

app = FastAPI()
app.include_router(dass21_batch.admin_router)
app.include_router(backend_enablement.counselor_router)
client = TestClient(app)

BLUEPRINT = {position: category for category, items in CATEGORY_ITEMS.items() for position in items}


def questions(text="Saya merasa tegang"):
    return [{"position": p, "text": text, "category": BLUEPRINT[p]} for p in range(1, 22)]


def payload(text="Saya merasa tegang", **extra):
    return {"questions": [{"orderNumber": q["position"], "text": q["text"], "category": q["category"].upper()}
                          for q in questions(text)], **extra}


class FakeConn:
    """Answers the batch routes' lookups from one in-memory version and its latest review."""

    def __init__(self, status="draft", review=None, revision=3, wording="Saya merasa tegang", empty=False):
        self.version = {"instrument_version_id": "v1", "version_number": 1, "status": status,
                        "definition_revision": revision, "updated_at": SAVED_AT}
        self.review, self.wording, self.empty, self.executed = review, wording, empty, []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        one, many = None, []
        if "from assessment_instruments where" in sql:
            one = {"instrument_id": "i1"}
        elif "from assessment_instrument_versions" in sql and "status='published'" in sql:
            one = {"instrument_version_id": "v0"}
        elif "from assessment_instrument_versions" in sql and sql.startswith("select"):
            one = self.version
        elif "from assessment_version_reviews" in sql and sql.startswith("select"):
            one = self.review
        elif sql.startswith("insert into assessment_questions"):
            self.empty = False
        elif "from assessment_questions" in sql and sql.startswith("select") and self.empty and params == ("v1",):
            many = []
        elif "from assessment_questions" in sql and sql.startswith("select"):
            many = [{"assessment_question_id": f"q{p}", "position": p, "wording": self.wording,
                     "category": BLUEPRINT[p], "option_scores": [0, 1, 2, 3]} for p in range(1, 22)]
            one = many[0]
        elif sql.startswith("insert into assessment_instrument_versions"):
            one = {"instrument_version_id": "v2"}
        return types.SimpleNamespace(fetchone=lambda: one, fetchall=lambda: many)

    def sql(self, needle):
        return [s for s, _ in self.executed if needle in s]


class BatchStatusTests(unittest.TestCase):
    def test_a_published_version_is_approved(self):
        self.assertEqual(batch_status("published", 1, None), "APPROVED")

    def test_a_draft_without_a_review_is_a_draft(self):
        self.assertEqual(batch_status("draft", 1, None), "DRAFT")

    def test_a_pending_review_freezes_the_draft(self):
        self.assertEqual(batch_status("draft", 2, {"status": "pending", "definition_revision": 2}), "PENDING_VALIDATION")

    def test_a_rejection_holds_until_the_draft_is_saved_again(self):
        rejected = {"status": "revision_requested", "definition_revision": 2}
        self.assertEqual(batch_status("draft", 2, rejected), "REJECTED")
        self.assertEqual(batch_status("draft", 3, rejected), "DRAFT")


class ValidateQuestionsTests(unittest.TestCase):
    def test_the_complete_blueprint_is_valid(self):
        self.assertEqual(validate_dass21_questions(questions()), [])

    def test_blank_text_is_named_by_its_number(self):
        rows = questions()
        rows[4]["text"] = "   "
        self.assertEqual(validate_dass21_questions(rows), ["Soal 5 belum diisi"])

    def test_a_short_category_says_how_many_it_has(self):
        rows = [q for q in questions() if q["position"] != 18]
        self.assertIn("Kategori Stres baru 6 dari 7 soal", validate_dass21_questions(rows))
        self.assertIn("Harus tepat 21 soal (sekarang 20)", validate_dass21_questions(rows))

    def test_numbers_must_be_one_to_twenty_one_without_repeats(self):
        rows = questions()
        rows[1]["position"] = 1
        self.assertIn("Nomor soal harus 1–21 tanpa duplikat", validate_dass21_questions(rows))


class BatchRouteTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(auth, "query", side_effect=lambda sql, params=(), user_id=None: [{"role": ROLES[user_id]}])
        patcher.start()
        self.addCleanup(patcher.stop)

    def _with_conn(self, conn):
        @contextmanager
        def fake(user_id=None):
            yield conn
        patcher = patch.object(dass21_batch, "db", fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return conn

    def _headers(self, who=ADMIN):
        return {"Authorization": "Bearer " + auth.create_token(who, "x@example.com")}

    def test_only_admins_edit_or_submit(self):
        conn = self._with_conn(FakeConn())
        h = self._headers(COUNSELOR)
        self.assertEqual(client.get("/admin/dass21/batch/current", headers=h).status_code, 403)
        self.assertEqual(client.put("/admin/dass21/batch/draft", json=payload(), headers=h).status_code, 403)
        self.assertEqual(client.post("/admin/dass21/batch/v1/submit", headers=h).status_code, 403)
        self.assertEqual(conn.executed, [])

    def test_current_batch_carries_status_version_and_upper_case_categories(self):
        self._with_conn(FakeConn(review={"status": "revision_requested", "definition_revision": 3,
                                         "decision_comment": "Soal 2 kurang jelas"}))
        r = client.get("/admin/dass21/batch/current", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual((body["id"], body["version"], body["status"]), ("v1", 1, "REJECTED"))
        self.assertEqual(body["reviewNote"], "Soal 2 kurang jelas")
        self.assertEqual(len(body["questions"]), 21)
        self.assertEqual(body["questions"][2], {"id": "q3", "orderNumber": 3, "text": "Saya merasa tegang", "category": "DEPRESSION"})

    def test_saving_a_draft_updates_it_in_place_and_bumps_the_revision(self):
        conn = self._with_conn(FakeConn())
        r = client.put("/admin/dass21/batch/draft", json=payload("  Teks baru  "), headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(conn.sql("insert into assessment_instrument_versions"), [])
        updates = [(s, p) for s, p in conn.executed if s.startswith("update assessment_questions")]
        self.assertEqual(len(updates), 21)
        self.assertEqual(updates[0][1][0], "Teks baru")
        self.assertTrue(conn.sql("definition_revision=definition_revision+1"))

    def test_saving_an_approved_batch_starts_the_next_version_and_leaves_it_alone(self):
        conn = self._with_conn(FakeConn(status="published"))
        r = client.put("/admin/dass21/batch/draft", json=payload("Teks baru"), headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(conn.sql("insert into assessment_instrument_versions")), 1)
        writes = [p for s, p in conn.executed if s.startswith("update assessment_questions")]
        self.assertTrue(writes)
        self.assertTrue(all("v2" in p for p in writes))

    def test_a_batch_awaiting_a_counselor_cannot_be_saved(self):
        conn = self._with_conn(FakeConn(review={"status": "pending", "definition_revision": 3}))
        r = client.put("/admin/dass21/batch/draft", json=payload(), headers=self._headers())
        self.assertEqual(r.status_code, 409)
        self.assertEqual([s for s, _ in conn.executed if s.startswith("update")], [])

    def test_a_stale_page_is_refused(self):
        conn = self._with_conn(FakeConn())
        r = client.put("/admin/dass21/batch/draft", json=payload(updatedAt="2026-10-01T00:00:00+00:00"), headers=self._headers())
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["detail"], "Data sudah diubah oleh pengguna lain, muat ulang halaman.")
        self.assertEqual([s for s, _ in conn.executed if s.startswith("update")], [])

    def test_the_timestamp_the_server_sent_is_accepted_back(self):
        self._with_conn(FakeConn())
        r = client.put("/admin/dass21/batch/draft", json=payload(updatedAt=SAVED_AT.isoformat()), headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)

    def test_client_status_version_and_ids_are_ignored(self):
        conn = self._with_conn(FakeConn(status="published"))
        body = payload(status="DRAFT", version=9, id="v1")
        body["questions"][0]["id"] = "forged"
        r = client.put("/admin/dass21/batch/draft", json=body, headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(conn.sql("insert into assessment_instrument_versions")), 1)

    def test_save_needs_exactly_twenty_one_unique_numbers(self):
        self._with_conn(FakeConn())
        short = payload()
        short["questions"].pop()
        self.assertEqual(client.put("/admin/dass21/batch/draft", json=short, headers=self._headers()).status_code, 422)
        repeated = payload()
        repeated["questions"][1]["orderNumber"] = 1
        self.assertEqual(client.put("/admin/dass21/batch/draft", json=repeated, headers=self._headers()).status_code, 422)

    def test_submitting_a_valid_draft_opens_a_pending_review(self):
        conn = self._with_conn(FakeConn())
        r = client.post("/admin/dass21/batch/v1/submit", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        inserted = [p for s, p in conn.executed if s.startswith("insert into assessment_version_reviews")]
        self.assertEqual(inserted, [("v1", 3, ADMIN)])

    def test_an_incomplete_draft_is_refused_with_its_errors(self):
        conn = self._with_conn(FakeConn(wording=" "))
        r = client.post("/admin/dass21/batch/v1/submit", headers=self._headers())
        self.assertEqual(r.status_code, 422)
        self.assertIn("Soal 1 belum diisi", r.json()["detail"]["errors"])
        self.assertEqual(conn.sql("insert into assessment_version_reviews"), [])

    def test_only_a_draft_can_be_submitted(self):
        for conn in (FakeConn(status="published"), FakeConn(review={"status": "pending", "definition_revision": 3})):
            with self.subTest(status=conn.version["status"]):
                self._with_conn(conn)
                self.assertEqual(client.post("/admin/dass21/batch/v1/submit", headers=self._headers()).status_code, 409)
                self.assertEqual(conn.sql("insert into assessment_version_reviews"), [])

    def test_an_empty_draft_shows_the_published_items(self):
        conn = self._with_conn(FakeConn(empty=True))
        r = client.get("/admin/dass21/batch/current", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((r.json()["status"], len(r.json()["questions"])), ("DRAFT", 21))
        self.assertEqual([s for s, _ in conn.executed if s.startswith(("insert", "update"))], [])

    def test_submitting_an_empty_draft_copies_the_published_items_first(self):
        conn = self._with_conn(FakeConn(empty=True))
        r = client.post("/admin/dass21/batch/v1/submit", headers=self._headers())
        self.assertEqual(r.status_code, 200, r.text)
        copies = [p for s, p in conn.executed if s.startswith("insert into assessment_questions")]
        self.assertEqual(copies, [("v1", "v1", "v0")])
        # The scoring configuration comes along, or the published version could not be scored
        config = [p for s, p in conn.executed if s.startswith("update assessment_instrument_versions") and "scoring_config" in s]
        self.assertEqual(config, [("v0", "v1")])
        self.assertEqual(len(conn.sql("insert into assessment_version_reviews")), 1)

    def test_submitting_a_batch_that_is_no_longer_current_is_refused(self):
        self._with_conn(FakeConn())
        self.assertEqual(client.post("/admin/dass21/batch/v0/submit", headers=self._headers()).status_code, 409)


class ReviewDecisionTests(unittest.TestCase):
    """The existing counselor review route: an approval of the DASS-21 is its publication."""

    def setUp(self):
        patcher = patch.object(auth, "query", side_effect=lambda sql, params=(), user_id=None: [{"role": ROLES[user_id]}])
        patcher.start()
        self.addCleanup(patcher.stop)
        self.executed = []

        def execute(sql, params=()):
            self.executed.append(sql)
            row = {"status": "pending", "definition_revision": 3, "current_revision": 3, "instrument_version_id": "v1"}
            return types.SimpleNamespace(fetchone=lambda: row, fetchall=lambda: [row])

        @contextmanager
        def fake(user_id=None):
            yield types.SimpleNamespace(execute=execute)
        patcher = patch.object(backend_enablement, "db", fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.headers = {"Authorization": "Bearer " + auth.create_token(COUNSELOR, "x@example.com")}

    def test_approving_publishes_the_reviewed_version(self):
        r = client.post("/counselor/instrument-reviews/00000000-0000-4000-8000-000000000001/approve",
                        json={"expected_revision": 3}, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(any("publish_approved_dass21_version" in s for s in self.executed))

    def test_a_rejection_needs_a_note_and_publishes_nothing(self):
        url = "/counselor/instrument-reviews/00000000-0000-4000-8000-000000000001/request-revision"
        self.assertEqual(client.post(url, json={"expected_revision": 3}, headers=self.headers).status_code, 422)
        r = client.post(url, json={"expected_revision": 3, "comment": "Soal 2 kurang jelas"}, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(any("publish_approved_dass21_version" in s for s in self.executed))


if __name__ == "__main__":
    unittest.main()
