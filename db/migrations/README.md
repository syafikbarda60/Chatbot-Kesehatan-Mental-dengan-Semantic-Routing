# Sajiwa database migrations

These ordered SQL files upgrade an existing database without recreating its volume.

## Backup before any non-disposable migration

```powershell
$env:PGPASSWORD = "<database-owner-password>"
pg_dump --format=custom --no-owner --file="sajiwa-before-iteration3.dump" --dbname="postgresql://<owner>@<host>:5432/sajiwa"
pg_restore --list "sajiwa-before-iteration3.dump"
```

Apply as the database owner, after reviewing the backup:

```powershell
psql -v ON_ERROR_STOP=1 $env:DATABASE_OWNER_URL -f db/migrations/001_iteration3c.sql
psql -v ON_ERROR_STOP=1 $env:DATABASE_OWNER_URL -f db/migrations/002_iteration4.sql
psql -v ON_ERROR_STOP=1 $env:DATABASE_OWNER_URL -f db/migrations/003_iteration4_1.sql
psql -v ON_ERROR_STOP=1 $env:DATABASE_OWNER_URL -f db/migrations/004_backend_enablement.sql
psql -v ON_ERROR_STOP=1 $env:DATABASE_OWNER_URL -f db/migrations/005_counseling_preferred_slot.sql
```

Each migration records its filename stem in `schema_migrations`, takes an advisory transaction lock, and keeps its DDL additive. Never run migrations using the superuser URL as the application runtime URL.

`002_iteration4.sql` adds versioned assessment definitions, immutable published versions, category result storage, and multi-scope report audit metadata. Its DASS-21 seed is deliberately an empty, non-publishable draft because the repository does not contain an approved clinical question/scoring configuration. Apply `001_iteration3c.sql` first. The application runtime must use the non-superuser `sajiwa_app` role so RLS remains effective.
Skipping already-applied files is the runner's job, not each file's: the `migrate` service in `docker-compose.yml` checks `schema_migrations` before applying one, and stops at the first failure. Individual files are **not** safe to re-run by hand — `003_iteration4_1.sql` aborts with `Canonical DASS-21 draft is not empty; refusing to overwrite existing content` rather than overwrite wording an admin may have edited. Applying manually with the `psql` commands above means checking first:

```powershell
psql $env:DATABASE_OWNER_URL -tAc "select version from schema_migrations order by 1"
```

`002_iteration4.sql` adds versioned assessment definitions, immutable published versions, category result storage, and multi-scope report audit metadata. It seeds a deliberately empty, non-publishable DASS-21 draft; `003_iteration4_1.sql` fills it in with the approved wording and scoring. Apply `001_iteration3c.sql` first. The application runtime must continue using the non-superuser `sajiwa_app` role so RLS remains effective.

`003_iteration4_1.sql` adds standard/custom instrument identity and provenance, records the owner-supplied DASS-21 mapping, response scores, multiplier, and category-specific severity bands, and seeds the exact 21 Indonesian items from the owner-provided Source A DOCX. The migration validates the complete standard draft before setting `authoritative_config=true`; it deliberately leaves the version in `draft` so publication still requires the existing admin confirmation flow. Apply it after `002_iteration4.sql`.

`004_backend_enablement.sql` adds custom dimensions and revision-bound counselor review, sensitive student support profiles, counseling resources and blocks, optional appointment-resource links, and the hotline verification lifecycle. Apply it after `003_iteration4_1.sql`.

`006_counseling_preferred_slot.sql` lets the mobile app book through the counseling request queue: a request may carry the slot the student picked (counselor, start, end), and `counseling_open_slots()` — `SECURITY DEFINER`, returning only free start/end pairs — offers students the sessions an admin could actually assign. Apply it after `005_naming.sql`.

`007_privacy_consent.sql` records when each account accepted the privacy walkthrough (`privacy_consents`, own row only under RLS), so the app asks once per account rather than once per device. Apply it after `006_counseling_preferred_slot.sql`.

`008_counselor_workspace.sql` gives the counselor portal real data. `counselor_case_assignments` is the caseload: assigning an active appointment opens the case (trigger), an admin revokes it, and `counselor_has_case()` (`SECURITY DEFINER`) is the one rule the case-scoped policies on `users`, `student_academic_profiles`, `counseling_requests` and `student_support_profiles` share — the old policy that let every counselor read every support profile is dropped. `counselor_exception_requests` holds counselor time-off requests; an admin approval creates the `counselor_blocked_periods` row and never cancels the overlapping sessions. Apply it after `007_privacy_consent.sql`.

`012_dass21_batch.sql` backs the admin DASS-21 batch editor: a partial unique index allows one open draft per instrument (skipped with a notice if old data already has two), and `publish_approved_dass21_version()` (`SECURITY DEFINER`) lets a counselor's approval of the standard DASS-21 publish it, which RLS would otherwise forbid. Apply it after `011_notifications.sql`.

`sajiwa_app` is the canonical and only runtime role; every migration grants its new objects to it. A grant to a nonexistent role aborts the migration transaction, so `db/init/02_auth.sql` creates it first.
