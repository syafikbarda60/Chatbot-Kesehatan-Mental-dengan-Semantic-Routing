"""Static safety checks for the additive Iteration 4.1 migration."""
import unittest
from pathlib import Path


class Iteration41MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = (Path(__file__).parents[4] / "db/migrations/003_iteration4_1.sql").read_text(encoding="utf-8").lower()

    def test_is_additive_and_preserves_history(self):
        for forbidden in ("drop table", "drop column", "truncate ", "delete from assessments", "update assessments set"):
            self.assertNotIn(forbidden, self.sql)
        self.assertIn("add column if not exists language", self.sql)
        self.assertIn("instrument_kind", self.sql)
        self.assertIn("derived_from_instrument_id", self.sql)

    def test_complete_configuration_is_authoritative_but_not_published(self):
        for value in ("3,5,10,13,16,17,21", "2,4,7,9,15,19,20", "1,6,8,11,12,14,18"):
            self.assertIn(value, self.sql.replace(" ", ""))
        self.assertIn("'standardization_multiplier',2", self.sql.replace(" ", ""))
        self.assertIn("insert into assessment_questions", self.sql)
        self.assertIn("set authoritative_config=true", self.sql)
        self.assertNotIn("set status='published'", self.sql)

    def test_notification_excludes_sensitive_content(self):
        self.assertIn("notify_dass21_admins", self.sql)
        function = self.sql.split("create or replace function notify_dass21_admins", 1)[1].split("grant execute", 1)[0]
        for prohibited in ("messages", "journals", "triggered_input", "assessment_answer_options"):
            self.assertNotIn(prohibited, function)


if __name__ == "__main__":
    unittest.main()
