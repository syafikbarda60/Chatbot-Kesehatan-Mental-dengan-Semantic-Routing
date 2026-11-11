# Table usage reference

What every table stores and who reads/writes it. Cross-checked against `apps/backend`,
`apps/mobile`, `packages/`, and `db/` (2026-10-10). Naming follows
[postgresql conventions](../docs/postgresql-conventions.md) (PK `<singular_table>_id`, lowercase
English enum values except `users.role`).

## Accounts & auth

- `users` — every account (`mahasiswa`/`konselor`/`admin`/`pemangku_jabatan`) with password hash,
  name, NIM. Nearly every route; login resolves through `auth_lookup()`, password changes through
  `set_password()`; dev rows from `scripts/seed_dev_users.py`.
- `password_resets` — hashed OTP codes for forgot-password (15 min expiry, single use).
  `routes/account.py` only.

## Chat & private student data

- `sessions` — one chat session per student; `messages.session_id` is client-generated but pinned
  to `(session_id, user_id)` by composite FK. `routes/chat.py`, mobile chat/history drawer.
- `messages` — encrypted chat turns (`route_used` records the LLM route taken).
  `routes/chat.py` and the chatbot services (`history`, `guardrail`, `rag`, `conversational`).
- `journals` — private journal entries; mood values `calm/anxious/focused/tired`.
  `routes/journal.py`, mobile journal/stats/profile.

## Assessment results

- `assessments` — self-assessment attempts (legacy fixed instruments PHQ-9/GAD-7/SRQ plus
  DASS-21 and versioned-instrument submits). Written by `routes/assessment.py`; read by
  `admin.py` / `admin_operations.py` / `dashboard.py` / `iteration3.py` / `iteration4.py` for
  risk monitoring and analytics. The `notify_dass21_admins()` trigger fires on elevated DASS-21.
- `assessment_category_results` — per-category scores per attempt (DASS-21
  depression/anxiety/stress: scaled score + severity). `iteration4.py`, `admin*.py`.

## Instrument authoring (versioned)

- `assessment_instruments` — instrument metadata (code, name, language, kind, norms).
  `iteration4.py`, `backend_enablement.py`.
- `assessment_instrument_versions` — versions (`draft` → `published` → `archived`) with
  `definition_revision` and `scoring_config`; publishing a new version archives the old one.
- `assessment_questions` — items per version (wording, category, position, active).
- `assessment_answer_options` — scored options per question.
- `assessment_dimensions` — dimension rows and interpretation bands per version.
- `assessment_version_reviews` — counselor review gate (`pending`/`revision_requested`/`approved`);
  publish requires an approval for the current `definition_revision`.
- `assessment_review_comments` — reviewer comment thread on a review. `backend_enablement.py`.

All authored through `iteration4.py` (admin) and `backend_enablement.py` (counselor review).

## Safety & support

- `guardrail_logs` — every safety signal with its trigger severity. Written from chat/assessment;
  read by `admin_operations.py` (attention signals), `dashboard.py`, `iteration3/4.py` analytics.
- `hotlines` — crisis contacts with verification lifecycle `verification_required` → `active` →
  `inactive`. Admin CRUD in `admin_operations.py`; guardrail fallback in
  `services/chatbot/guardrail.py`; student list via `GET /guardrail/hotline`.
- `student_support_profiles` — 1:1 (`user_id` PK) structured support/disability info recorded by
  admins. `backend_enablement.py` only.

## Academic scoping

- `faculties`, `academic_units` — academic taxonomy. Managed in `admin.py` / `iteration3.py`;
  scopes analytics and reports.
- `student_academic_profiles` — 1:1 (`user_id` PK) student → faculty/unit. `admin.py`,
  `iteration3.py`, analytics filters.

## Counseling — request/appointment flow (current)

- `counseling_requests` — student's request for counseling (preferred context, status queue).
  `iteration3.py`.
- `counselor_profiles` — 1:1 (`user_id` PK) counselor title/specialization/active flag.
  `iteration3.py`, `iteration4.py`.
- `counselor_availability_rules` — weekly availability windows per counselor; scheduling
  validation in `iteration3.py`.
- `counselor_blocked_periods` — counselor time-off intervals; same validation.
- `counseling_appointments` — confirmed/rescheduled sessions (`starts_at`/`ends_at`). Assigned by
  admins (`iteration3.py`), shown in the multi-counselor calendar (`iteration4.py`).
  `legacy_counseling_booking_id` links back to a legacy booking when the request carried one.
- `counseling_appointment_events` — status-change audit trail per appointment (event type, actor,
  time). Written on appointment updates; returned inside the calendar JSON history.
- `counseling_admin_notes` — admin notes on requests/appointments. `iteration3.py`.
- `counseling_resources` — bookable rooms/resources with capacity. `iteration3.py`,
  `backend_enablement.py`.
- `counseling_resource_blocks` — resource blackout intervals. Same.

## Counseling — legacy slot/booking flow

- `counseling_slots` — counselor-published time slots (was `jadwal_konsultasi`). Served by
  `routes/jadwal.py` (`/jadwal`); read in admin/dashboard history views.
- `counseling_bookings` — student bookings of a slot (was `booking_konsultasi`); booking/cancel
  triggers flip the slot status. `routes/jadwal.py` (`/booking`), history views in
  `admin.py` / `admin_operations.py` / `dashboard.py` / `iteration3.py`.

Superseded for new bookings by the request/appointment flow above (mobile submits
`/counseling/requests`); kept while the legacy `/jadwal` + `/booking` routes and admin history
views still serve it.

## Ops & infrastructure

- `admin_notifications` — deduped admin inbox items (e.g. elevated DASS-21 alerts from
  `notify_dass21_admins()`). `iteration3.py`, `admin_operations.py`.
- `report_export_audits` — audit rows for report exports. `iteration3.py`.
- `documents` — RAG chunks (`content`, `embedding vector(768)`, `metadata`). Written by
  `scripts/embed.py`; matched at chat time via `match_documents()`
  (`services/chatbot/rag.py`).
- `schema_migrations` — applied-migration bookkeeping; the one-shot `migrate` service
  (`docker-compose.yml`) records each file and skips re-runs.

## Unused / stale check (2026-10-10)

All 36 tables have live readers or writers — no dead tables. Notes:

- `counseling_slots` / `counseling_bookings` are the superseded booking flow (above) and the only
  pair with a plausible removal path once the legacy `/jadwal` + `/booking` routes retire.
- `counseling_appointment_events` (audit trail) and `password_resets` (OTP) are narrow,
  write-mostly support tables — small but used.
