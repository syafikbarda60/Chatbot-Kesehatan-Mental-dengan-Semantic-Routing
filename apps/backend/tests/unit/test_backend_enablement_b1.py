import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[4]
MIGRATION = (ROOT / "db/migrations/004_backend_enablement.sql").read_text(encoding="utf-8").lower()
ROUTES = (ROOT / "apps/backend/routes/backend_enablement.py").read_text(encoding="utf-8")
ITERATION3 = (ROOT / "apps/backend/routes/iteration3.py").read_text(encoding="utf-8")
ITERATION4 = (ROOT / "apps/backend/routes/iteration4.py").read_text(encoding="utf-8")


class BackendEnablementContracts(unittest.TestCase):
    def test_schema_has_review_support_resource_and_hotline_lifecycle(self):
        for token in ("assessment_dimensions", "assessment_version_reviews", "assessment_review_comments", "student_support_profiles", "counseling_resources", "counseling_resource_blocks", "verification_required"):
            self.assertIn(token, MIGRATION)

    def test_sensitive_tables_enable_rls(self):
        for table in ("assessment_version_reviews", "assessment_review_comments", "student_support_profiles", "counseling_resources"):
            self.assertIn(f"alter table {table} enable row level security", MIGRATION)

    def test_review_is_bound_to_definition_revision(self):
        self.assertIn("expected_revision", ROUTES)
        self.assertIn("definition_revision", ROUTES)
        self.assertIn("status='approved'", ITERATION4)
        self.assertIn("definition_revision=definition_revision+1", ITERATION4)

    def test_resource_capacity_and_deactivation_are_server_enforced(self):
        self.assertIn("used>=item[\"capacity\"]", ITERATION3)
        self.assertIn("janji aktif di masa mendatang", ITERATION3)


if __name__ == "__main__":
    unittest.main()
