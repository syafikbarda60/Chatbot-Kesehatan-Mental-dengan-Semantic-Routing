import unittest
from pathlib import Path
class MigrationContracts(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql=(Path(__file__).parents[4]/"db"/"migrations"/"001_iteration3c.sql").read_text(encoding="utf-8").lower()
 def test_additive_only(self):
  for value in ("drop table","drop column","truncate ","alter table users"):
   self.assertNotIn(value,self.sql)
 def test_expected_rls(self):
  for table in ("faculties","academic_units","student_academic_profiles","admin_notifications","counseling_requests","counseling_appointments","counseling_admin_notes","report_export_audits"):
   self.assertIn("alter table "+table+" enable row level security",self.sql)
 def test_conflict_constraints(self):
  self.assertIn("exclude_active_counselor_overlap",self.sql);self.assertIn("exclude_active_student_overlap",self.sql);self.assertIn("exclude_active_availability_overlap",self.sql)
 def test_full_reference_seed(self):
  self.assertEqual(self.sql.count("'study_program','s1'"),53)
 def test_notification_privacy(self):
  trigger=self.sql[self.sql.index("create or replace function notify_iteration3_admins"):]
  for value in ("triggered_input","answers","messages.content","journals.content"):
   self.assertNotIn(value,trigger)
if __name__=="__main__":unittest.main()
