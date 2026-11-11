"""Static and isolated contracts for additive Iteration 3C."""
import os,sys,types,unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
os.environ["JWT_SECRET"]="iteration3-test-key"
fake=types.ModuleType("core.db")
fake.query=lambda *a,**k:[]
@contextmanager
def fake_context(*a,**k): yield None
fake.db=fake_context
sys.modules["core.db"]=fake
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth
from routes import iteration3

ADMIN="11111111-1111-4111-8111-111111111111"
STUDENT="22222222-2222-4222-8222-222222222222"
app=FastAPI();app.include_router(iteration3.admin_router)
client=TestClient(app)

class Iteration3Contracts(unittest.TestCase):
 def setUp(self):
  self.calls=[]
  self.auth_patch=patch.object(auth,"query",side_effect=lambda sql,params=(),user_id=None:[{"role":"admin" if user_id==ADMIN else "mahasiswa"}])
  self.data_patch=patch.object(iteration3,"query",side_effect=self.data)
  self.auth_patch.start();self.data_patch.start()
 def tearDown(self): self.auth_patch.stop();self.data_patch.stop()
 def data(self,sql,params=(),user_id=None):
  self.calls.append((sql,params,user_id))
  if "count(*) total" in sql:return [{"total":1}]
  if "from admin_notifications" in sql:return [{"admin_notification_id":ADMIN,"category":"safety","title":"Signal requires review","context":"No raw content","entity_type":"guardrail_log","entity_id":STUDENT,"target_path":"/attention","read_at":None,"created_at":"2026-01-01T00:00:00Z"}]
  if "from faculties f" in sql:return [{"faculty_id":ADMIN,"code":"FT","name":"Fakultas Teknik","active":True,"source_url":None,"unit_count":1,"student_count":1}]
  if "insert into student_academic_profiles" in sql:return [{"user_id":STUDENT,"faculty_id":ADMIN,"academic_unit_id":None}]
  return []
 def headers(self,identity=ADMIN):return {"Authorization":"Bearer "+auth.create_token(identity,"fixture@example.test")}
 def test_admin_authorization(self):
  self.assertEqual(client.get("/admin/academic/faculties",headers=self.headers(STUDENT)).status_code,403)
  self.assertEqual(self.calls,[])
 def test_academic_list_is_parameterized_and_rls_scoped(self):
  response=client.get("/admin/academic/faculties",headers=self.headers())
  self.assertEqual(response.status_code,200);self.assertEqual(response.json()["total"],1)
  self.assertTrue(all(call[2]==ADMIN for call in self.calls))
 def test_unit_requires_faculty(self):
  response=client.put(f"/admin/students/{STUDENT}/academic-profile",headers=self.headers(),json={"academic_unit_id":ADMIN})
  self.assertEqual(response.status_code,422);self.assertEqual(self.calls,[])
 def test_notification_privacy_contract(self):
  body=client.get("/admin/notifications",headers=self.headers()).json()
  rendered=str(body).lower()
  for prohibited in ("triggered_input","answers","password_hash","journal","message_content"):
   self.assertNotIn(prohibited,rendered)
 def test_sql_uses_placeholders(self):
  client.get("/admin/academic/units?faculty_id="+ADMIN,headers=self.headers())
  sql,params,_=self.calls[-1]
  self.assertNotIn(ADMIN,sql);self.assertIn(ADMIN,params)

class MigrationContracts(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.sql=(Path(__file__).parents[4]/"db"/"migrations"/"001_iteration3c.sql").read_text(encoding="utf-8").lower()
 def test_no_destructive_statements(self):
  for statement in ("drop table","drop column","truncate ","delete from users","alter table users"):
   self.assertNotIn(statement,self.sql)
 def test_rls_and_conflict_constraints(self):
  for table in ("faculties","academic_units","student_academic_profiles","admin_notifications","counseling_requests","counseling_appointments","counseling_admin_notes","report_export_audits"):
   self.assertIn("alter table "+table+" enable row level security",self.sql)
  self.assertIn("exclude_active_counselor_overlap",self.sql)
  self.assertIn("exclude_active_student_overlap",self.sql)
 def test_notifications_do_not_copy_sensitive_source_fields(self):
  trigger=self.sql[self.sql.index("create or replace function notify_iteration3_admins"):]
  for prohibited in ("triggered_input","answers","messages.content","journals.content"):
   self.assertNotIn(prohibited,trigger)

if __name__=="__main__":unittest.main()
