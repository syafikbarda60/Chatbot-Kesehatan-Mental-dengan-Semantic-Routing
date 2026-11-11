"""Static API contracts for Iteration 4 when live FastAPI/PostgreSQL are unavailable."""
import unittest
from pathlib import Path


class Iteration4ApiContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).parents[4]
        cls.route = (root / "apps" / "backend" / "routes" / "iteration4.py").read_text(encoding="utf-8").lower()
        cls.client = (root / "packages" / "api-client" / "src" / "iteration4.ts").read_text(encoding="utf-8").lower()

    def test_admin_guard_and_student_active_read(self):
        self.assertIn('admin_access = require_role("admin")', self.route)
        self.assertIn('depends(admin_access)', self.route)
        self.assertIn('depends(get_current_user)', self.route)

    def test_multi_select_uses_parameterized_any_or_semantics(self):
        self.assertIn("=any(%s::uuid[])", self.route)
        self.assertNotIn("join(faculty", self.route)
        self.assertIn("repeatedquery('faculty_id'", self.client)
        self.assertIn("repeatedquery('academic_unit_id'", self.client)

    def test_comparison_precedence_is_deterministic(self):
        unit_branch = self.route.index("if unit_ids:")
        faculty_branch = self.route.index("elif faculty_ids:")
        university_branch = self.route.index('mode, selected, id_column, label_column = "university"')
        self.assertLess(unit_branch, faculty_branch)
        self.assertLess(faculty_branch, university_branch)

    def test_publish_requires_authoritative_configuration(self):
        self.assertIn('not version["authoritative_config"]', self.route)
        self.assertIn("scoring_config", self.route)
        self.assertIn("expected_question_count", self.route)

    def test_private_source_content_is_not_selected(self):
        for prohibited in ("messages.content", "journals.content", "select g.triggered_input", "answers from assessments"):
            self.assertNotIn(prohibited, self.route)


if __name__ == "__main__":
    unittest.main()
