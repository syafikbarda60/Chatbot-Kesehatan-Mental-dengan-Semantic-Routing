import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[4]
AUTH_INIT = (ROOT / "db/init/02_auth.sql").read_text(encoding="utf-8").lower()
MIGRATION_002 = (ROOT / "db/migrations/002_iteration4.sql").read_text(encoding="utf-8").lower()
MIGRATION_003 = (ROOT / "db/migrations/003_iteration4_1.sql").read_text(encoding="utf-8").lower()
MIGRATION_004 = (ROOT / "db/migrations/004_backend_enablement.sql").read_text(encoding="utf-8").lower()


class RuntimeRoleGrantContracts(unittest.TestCase):
    def test_auth_initialization_creates_the_runtime_role(self):
        self.assertIn("create role sajiwa_app login password 'sajiwa_app' nosuperuser", AUTH_INIT)
        self.assertNotIn("sanctuary", AUTH_INIT)

    def test_migrations_grant_to_the_runtime_role(self):
        self.assertIn("assessment_category_results to sajiwa_app", MIGRATION_002)
        self.assertIn("notify_dass21_admins(uuid) to sajiwa_app", MIGRATION_003)

    def test_migration_004_requires_and_grants_the_runtime_role(self):
        self.assertIn("counseling_resource_blocks to sajiwa_app", MIGRATION_004)
        self.assertIn("runtime role sajiwa_app must exist", MIGRATION_004)
        for migration in (MIGRATION_002, MIGRATION_003, MIGRATION_004):
            self.assertNotIn("sanctuary", migration)


if __name__ == "__main__":
    unittest.main()
