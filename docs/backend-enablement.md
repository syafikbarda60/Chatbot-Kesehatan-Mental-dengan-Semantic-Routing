# Backend enablement (B1)

Additive backend work after iteration 3/4 that closed the server gaps identified during the
dashboard migration. Code: `routes/backend_enablement.py` (`/admin` + `/counselor` routers,
registered in `main.py`). Schema: `db/migrations/004_backend_enablement.sql`, applied on
`docker compose up` after `003_iteration4_1.sql`. Legacy DASS routes, question IDs, assessment
history, counseling records, and nullable appointment-resource behavior stay compatible.

## Instrument authoring review

`POST /admin/assessment-instruments` creates metadata, version 1, dimensions, questions, options,
and structured `sum_by_dimension` scoring in one transaction. Draft saves can carry
`expected_revision`; a successful save increments the revision and makes earlier approvals stale.
Admins submit the current revision via
`POST /admin/assessment-instruments/versions/{id}/submit-review`.

Counselors review through `/counselor/instrument-reviews` (`GET` list/detail,
`POST .../comments`, `POST .../request-revision`, `POST .../approve`). The publish validator
requires a current-revision approval for custom instruments; published/archived versions keep the
DB immutability triggers ([postgresql-conventions.md](postgresql-conventions.md)).

## DASS-21 batch editor

The admin edits the standard DASS-21 as one batch of 21 items at `/instruments/dass21`
(`routes/dass21_batch.py`, rules in `core/dass21_batch.py`). A batch is an instrument version
read through its latest review: `published` = APPROVED, a `pending` review = PENDING_VALIDATION,
`revision_requested` on the current revision = REJECTED, otherwise DRAFT.

- `GET /admin/dass21/batch/current` — the open draft, else the published version.
- `PUT /admin/dass21/batch/draft` `{questions, updatedAt?}` — edits a DRAFT/REJECTED in place
  (the revision bump clears the rejection), opens version+1 from an APPROVED one, 409 while
  pending or when `updatedAt` is stale. Only wording is written; categories follow the blueprint.
- `POST /admin/dass21/batch/{id}/submit` — DRAFT only; 422 `{message, errors}` when invalid.
- Counselors decide through the existing `/counselor/instrument-reviews/...` routes; for the
  DASS-21 an approval publishes the version (`publish_approved_dass21_version()`, migration 012).

## Student support & academic structure

- `PUT /admin/students/{id}/profile` updates identity, academic assignment, and the separately
  protected support profile atomically. Support states: `none`, `present`, `unknown`,
  `prefer_not_to_say`; detail is accepted only with `present`. RLS limits those rows to the student,
  admins, and counselors.
- Academic structure (admin-only, `routes/iteration3.py`): faculties
  (`GET`/`POST /admin/academic/faculties`, `PUT /admin/academic/faculties/{id}`) and units
  (`GET`/`POST /admin/academic/units`, `PUT /admin/academic/units/{id}`); deactivate via
  `active=false`, never hard-delete.

## Counseling resources

- `GET`/`POST /admin/counseling/resources` — `physical`/`virtual` with capacity; production labels
  and IDs are never hardcoded.
- `POST /admin/counseling/resources/{id}/blocks` — resource blocks.
- Assignment and rescheduling take an advisory resource lock, reject blocks, and enforce capacity
  alongside the existing counselor/student overlap checks. Weekly availability can be replaced
  atomically; counselor deactivation is rejected while future confirmed/rescheduled appointments
  exist.
- Exact generated slots remain deferred (no approved duration/step policy); availability is
  enforced for concrete appointment intervals instead.

## Hotlines

Lifecycle states: `active`, `verification_required`, `inactive`. Editing `name`/`phone`/`description`
invalidates verification; activation records verifier and time; `DELETE` soft-deactivates
(`inactive`), never hard-deletes. Public guardrail responses select active contacts only, and a
restrictive RLS policy enforces the same rule. Admin list: `GET /admin/hotlines`.

## Analytics

Comparison analytics returns `unique_assessed_students` and `severity_trend`. Small-cohort
suppression stays deferred until an institution-approved minimum cell policy exists; a separate
follow-up aggregate stays deferred because the schema has no authoritative follow-up entity.

## Still open

- Report file export (PDF/PPT/Excel) — no approved renderer or storage/delivery infrastructure;
  the web report preview remains the only supported output.
- Administrator account security — no self-profile update, password change, 2FA, session history,
  or sign-out-all-devices contract (production is read-only plus current-session logout).
- `GET /admin/counseling/calendar/multi` does not return appointment `counseling_resource_id` or resource
  blocks, and `counseling_resource_blocks` has no read endpoint — the UI selects resources and
  relies on save-time validation.
- Hotline API exposes no `service_type`, `operational_hours`, or `coverage` fields (local preview
  only).
