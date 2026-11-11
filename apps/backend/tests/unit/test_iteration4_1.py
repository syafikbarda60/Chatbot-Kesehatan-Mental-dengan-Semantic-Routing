"""Pure scoring and static integration contracts for Iteration 4.1."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[4]
sys.path.insert(0, str(ROOT / "apps" / "backend"))

from core.dass21 import CATEGORY_ITEMS, RESPONSE_SCORES, classify_dass21, score_dass21


def responses(score: int):
    return [
        {"position": position, "category": category, "score": score}
        for category, positions in CATEGORY_ITEMS.items() for position in positions
    ]


class Dass21ConfigurationTests(unittest.TestCase):
    def test_authoritative_blueprint(self):
        self.assertEqual(CATEGORY_ITEMS["depression"], (3, 5, 10, 13, 16, 17, 21))
        self.assertEqual(CATEGORY_ITEMS["anxiety"], (2, 4, 7, 9, 15, 19, 20))
        self.assertEqual(CATEGORY_ITEMS["stress"], (1, 6, 8, 11, 12, 14, 18))
        flattened = [item for values in CATEGORY_ITEMS.values() for item in values]
        self.assertEqual(sorted(flattened), list(range(1, 22)))
        self.assertEqual(len(set(flattened)), 21)
        self.assertTrue(all(len(values) == 7 for values in CATEGORY_ITEMS.values()))
        self.assertEqual(RESPONSE_SCORES, (0, 1, 2, 3))

    def test_all_zero_and_all_three(self):
        zero = score_dass21(responses(0))
        maximum = score_dass21(responses(3))
        for category in CATEGORY_ITEMS:
            self.assertEqual((zero[category]["raw_score"], zero[category]["scaled_score"]), (0, 0))
            self.assertEqual((maximum[category]["raw_score"], maximum[category]["scaled_score"]), (21, 42))

    def test_mixed_scoring_multiplies_once(self):
        items = responses(0)
        for item in items:
            item["score"] = item["position"] % 4
        result = score_dass21(items)
        for category, positions in CATEGORY_ITEMS.items():
            raw = sum(position % 4 for position in positions)
            self.assertEqual(result[category]["raw_score"], raw)
            self.assertEqual(result[category]["scaled_score"], raw * 2)

    def test_all_severity_boundaries(self):
        boundaries = {
            "depression": [(9,"normal"),(10,"mild"),(13,"mild"),(14,"moderate"),(20,"moderate"),(21,"severe"),(27,"severe"),(28,"extremely_severe")],
            "anxiety": [(7,"normal"),(8,"mild"),(9,"mild"),(10,"moderate"),(14,"moderate"),(15,"severe"),(19,"severe"),(20,"extremely_severe")],
            "stress": [(14,"normal"),(15,"mild"),(18,"mild"),(19,"moderate"),(25,"moderate"),(26,"severe"),(33,"severe"),(34,"extremely_severe")],
        }
        for category, cases in boundaries.items():
            for score, expected in cases:
                with self.subTest(category=category, score=score):
                    self.assertEqual(classify_dass21(category, score), expected)

    def test_invalid_or_duplicate_items_rejected(self):
        invalid = responses(0)
        invalid[-1]["position"] = invalid[0]["position"]
        with self.assertRaises(ValueError):
            score_dass21(invalid)

    def test_missing_item_and_invalid_option_score_rejected(self):
        with self.assertRaises(ValueError):
            score_dass21(responses(0)[:-1])
        invalid_score = responses(0)
        invalid_score[0]["score"] = 4
        with self.assertRaises(ValueError):
            score_dass21(invalid_score)


class Iteration41StaticContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.route = (ROOT / "apps/backend/routes/iteration4.py").read_text(encoding="utf-8").lower()
        cls.mobile = (ROOT / "apps/mobile/app/assessment.tsx").read_text(encoding="utf-8").lower()
        cls.admin_model = (ROOT / "apps/dashboard/features/instruments/model.ts").read_text(encoding="utf-8").lower()
        cls.admin_api = (ROOT / "apps/dashboard/features/instruments/api.ts").read_text(encoding="utf-8").lower()
        cls.admin_detail = (ROOT / "apps/dashboard/features/instruments/InstrumentDetailPage.tsx").read_text(encoding="utf-8").lower()

    def test_client_cannot_supply_scores(self):
        self.assertIn('model_config = configdict(extra="forbid")', self.route)
        self.assertIn("question_id: uuid", self.route)
        self.assertIn("option_id: uuid", self.route)
        self.assertNotIn("class instrumentanswer(basemodel):\n    score", self.route)

    def test_submission_is_student_only_and_server_scored(self):
        self.assertIn('student_access = require_role("mahasiswa")', self.route)
        self.assertIn('depends(student_access)', self.route)
        self.assertIn("score_dass21(resolved, subscales=subscales)", self.route)
        self.assertIn("assessment_category_results", self.route)

    def test_mobile_uses_active_instrument_and_safe_completion(self):
        self.assertIn("apigetactiveassessmentinstrument", self.mobile)
        self.assertIn("apisubmitinstrumentassessment", self.mobile)
        self.assertNotIn("raw_score", self.mobile)
        self.assertNotIn("scaled_score", self.mobile)
        self.assertIn("hasil ini bukan diagnosis", self.mobile)

    def test_standard_lock_and_custom_workflow(self):
        # Editability is draft-only; standard definitions carry the protected notice instead of
        # a free-form editor. Assert the stable names, not the minified expression shape.
        self.assertIn("return detail.version.status==='draft'", self.admin_model)
        self.assertIn("copy.detail.protected", self.admin_detail)
        self.assertIn("/admin/assessment-instruments", self.admin_api)
        self.assertIn("version.instrument_kind==='standard'", self.admin_detail)
        self.assertIn("copy.detail.standardscoring", self.admin_detail)


if __name__ == "__main__":
    unittest.main()
