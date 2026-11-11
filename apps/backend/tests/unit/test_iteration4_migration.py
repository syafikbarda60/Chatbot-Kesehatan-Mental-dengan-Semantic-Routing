import unittest
from pathlib import Path


class Iteration4MigrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = (Path(__file__).parents[4] / "db" / "migrations" / "002_iteration4.sql").read_text(encoding="utf-8").lower()

    def test_additive_only(self):
        for value in ("drop table", "drop column", "truncate ", "delete from assessments", "delete from users"):
            self.assertNotIn(value, self.sql)

    def test_versioned_definition_tables_and_link(self):
        for table in (
            "assessment_instruments", "assessment_instrument_versions", "assessment_questions",
            "assessment_answer_options", "assessment_category_results",
        ):
            self.assertIn("create table if not exists " + table, self.sql)
            self.assertIn("alter table " + table + " enable row level security", self.sql)
        self.assertIn("add column if not exists instrument_version_id", self.sql)

    def test_published_immutability_is_database_enforced(self):
        self.assertIn("reject_published_assessment_definition_change", self.sql)
        self.assertIn("assessment_version_immutable", self.sql)
        self.assertIn("assessment_question_immutable", self.sql)
        self.assertIn("assessment_option_immutable", self.sql)

    def test_seed_is_non_publishable_draft(self):
        self.assertIn("'draft',21,false", self.sql)
        self.assertNotIn("insert into assessment_questions", self.sql)

    def test_historical_rows_are_not_reinterpreted(self):
        self.assertNotIn("update assessments set", self.sql)
        self.assertNotIn("alter column score", self.sql)
        self.assertNotIn("alter column severity", self.sql)


if __name__ == "__main__":
    unittest.main()
