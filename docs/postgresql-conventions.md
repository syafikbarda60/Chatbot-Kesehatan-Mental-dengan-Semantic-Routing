# PostgreSQL conventions

Database is **PostgreSQL 17 + pgvector**, run locally by Docker (`docker-compose.yml`). Access is
through **psycopg 3 with hand-written SQL, no ORM**. Schema, RLS, and pgvector topics live here;
container lifecycle is in [docker-conventions.md](docker-conventions.md).

## Schema source of truth

- **`db/init/01_schema.sql`** — tables, indexes, RLS policies, `match_documents()`.
- **`db/init/02_auth.sql`** — `sajiwa_app` role, `password_hash`, `password_resets`,
  `auth_lookup()`, `set_password()`.
- **`db/init/03_mobile_app.sql`** — `list_konselor()`: a `SECURITY DEFINER` counselor directory
  (id, name, role) for students, who cannot read other `users` rows under RLS.
- **`db/migrations/*.sql`** — additive changes after the baseline, applied in order by the one-shot
  `migrate` service on every `docker compose up` and recorded in `schema_migrations`.
- Applied by `docker compose up`: `db/init` once on an empty volume, then migrations. To change the
  schema, add a migration; `docker compose down -v && docker compose up -d` rebuilds from scratch.

## Extensions

```sql
create extension if not exists vector;     -- pgvector, documents.embedding
create extension if not exists pgcrypto;   -- gen_random_uuid() etc.
```

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Account + `role` + `password_hash` (oauth was removed with Supabase) |
| `assessments` | PHQ-9 / GAD-7 / SRQ / DASS-21 results, `score`, `severity`, optional `instrument_version_id` |
| `assessment_instruments` | Versioned instrument identity (`standard`/`custom`, language, provenance) |
| `assessment_instrument_versions` | `draft`/`published`/`archived` versions, `scoring_config` jsonb, one published per instrument |
| `assessment_questions`, `assessment_answer_options` | Item wording, category, position; answer labels + scores |
| `assessment_category_results` | Per-category raw/scaled score + severity for a DASS-21 submission |
| `guardrail_logs` | High-risk trigger log (chat + assessments) |
| `messages` | Encrypted chat turns (`route_used`); belongs to a `sessions` row |
| `sessions` | Chat session owner, title, lifetime; `messages.session_id` is client-generated but pinned to `(session_id, user_id)` by FK |
| `documents` | RAG chunks: `content`, `embedding vector(768)`, `metadata` |
| `hotlines` | Crisis contact list |
| `journals` | Private student journal entries |
| `counseling_slots` | Counselor availability slots |
| `counseling_bookings` | Student bookings |
| `password_resets` | OTP reset codes (bcrypt hash, 15 min expiry) |
| `faculties`, `academic_units`, `student_academic_profiles` | Academic scope for filtered analytics/reports |
| `admin_notifications` | Server-generated admin inbox items (deduped by `dedupe_key`) |
| `counselor_profiles`, `counselor_availability_rules`, `counselor_blocked_periods` | Counselor roster and scheduling |
| `counseling_requests`, `counseling_appointments`, `counseling_appointment_events`, `counseling_admin_notes` | Counseling request → appointment workflow, event history, admin notes |
| `counseling_resources`, `counseling_resource_blocks` | B1 rooms/equipment and their blocked periods |
| `student_support_profiles` | Separately protected support profile (`none`/`present`/`unknown`/`prefer_not_to_say`) |
| `counselor_case_assignments` | Counselor caseload; case-scoped RLS reads through `counselor_has_case()` |
| `counselor_exception_requests` | Counselor time-off requests; admin approval creates the blocked period |
| `report_export_audits` | Audit trail for report exports (scope, actor, timestamp) |

## Conventions

- `snake_case` for every table and column.
- Primary keys: surrogate UUIDs named `<singular_table>_id` (`journal_id`,
  `counseling_booking_id`, `guardrail_log_id`, `user_id`, `message_id`), `default gen_random_uuid()`.
  FKs to `users` are role-named (`student_id`, `counselor_id`) or `*_user_id` for named actors;
  row-lifecycle audit keeps `created_by` / `updated_by` / `published_by` / `verified_by`.
- Timestamps: `timestamptz default now()`; mutable rows use `updated_at` maintained by a
  `set_updated_at()` trigger.
- Enumerated columns use `check` constraints with lowercase English values
  (`available`/`booked`/`pending`/`calm`, …) — `users.role` values stay Indonesian product
  vocabulary (`mahasiswa`, `konselor`, `pemangku_jabatan`).
  Roles `mahasiswa | konselor | admin | pemangku_jabatan`; legacy `assessments.severity` is
  `minimal | mild | moderate | severe`, while `assessment_category_results.severity` adds
  `normal` and `extremely_severe` (DASS-21 bands).
- `users` is the root identity table; child tables reference `users(user_id)`. There is no
  `auth.users`.
- Rows owned by a session pin both ids: `messages(session_id, user_id)` references
  `sessions(session_id, user_id)`. A client-supplied `session_id` is therefore safe to group on —
  it cannot attach a row to another student's session.
- Booking side effects (`counseling_slots` → `booked` / back to `available`) are `SECURITY DEFINER` triggers,
  because the student who books cannot update the counselor's slot row directly.
- Instrument definitions are versioned: instrument → version (`draft`/`published`/`archived`, one
  published via partial unique index) → questions → answer options. `reject_published_*` triggers
  block update/delete of published or archived definitions and their questions/options; publishing
  archives the previous published version.
- `notify_dass21_admins(uuid)` is `SECURITY DEFINER`: it verifies the assessment belongs to
  `app_user_id()` and writes one admin notification per elevated DASS-21 submission with a
  category:severity summary only (no answers, wording, or guardrail text).
- Vector search: `documents.content`, `documents.embedding vector(768)`, `documents.metadata jsonb`;
  HNSW index; queries via `match_documents(query_embedding, match_threshold, match_count)`.

## Row Level Security

- RLS is enabled on every table. The backend connects as the **non-superuser** role
  `sajiwa_app`; `sajiwa` is a superuser and bypasses RLS entirely, so never point
  `DATABASE_URL` at it.
- Request identity is set per transaction by `core/db.py`:
  ```python
  with db(user.id) as conn:          # conn = one transaction, RLS identity set
      conn.execute("...", (...))
  ```
  which runs `select set_config('app.current_user_id', <uuid>, true)`.
- Policies read it through `app_user_id()`; policies that need a role call
  `current_user_role()`, which is `SECURITY DEFINER` to avoid infinite recursion on `users`.
- Anonymous requests have an empty setting, so `app_user_id()` is `NULL` and only `using (true)`
  policies (public `hotlines`, `documents` reads, `password_resets`) match.
- Iteration3/4 tables follow the same model: instrument authoring is admin-managed, non-admin roles
  can read active instruments plus *published* versions/questions/options,
  `assessment_category_results` lets a student insert/select their own rows (`konselor`/`admin` can
  read them), and counseling/academic tables are scoped by role.
- **Never build SQL by string concatenation.** Pass parameters (`%s`); `ORDER BY`/column names must
  come from a fixed whitelist, never from request data.

## Query patterns (from Python)

```python
from core.db import query

query(
    "select assessment_id, instrument_type, score, severity, taken_at "
    "from assessments where user_id = %s order by taken_at desc",
    (user.id,),
    user_id=user.id,
)
```

- `query()` / `execute()` each open their own transaction. Use `with db(user_id) as conn:` when
  several statements must share one transaction (multi-row inserts).
- Wrap dict/list values for `jsonb` columns in `psycopg.types.json.Jsonb`.
- Vector parameters are passed as `str(embedding)` and cast in SQL: `%s::vector`.

## Self-check

`db/test_rls.sql` asserts RLS isolation, anonymous lockout, and the auth functions against the
running database. Run it after any schema or policy change:

```bash
docker exec -i -e PGPASSWORD=sajiwa_app sajiwa-db \
  psql -v ON_ERROR_STOP=1 -U sajiwa_app -d sajiwa < db/test_rls.sql
```
