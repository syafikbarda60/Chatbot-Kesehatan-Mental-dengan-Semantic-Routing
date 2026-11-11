# Counselor portal backend handoff

The counselor portal is implemented under `/counselor` with a strict counselor role guard. Local preview mode supplies deterministic synthetic data. Production requests use only counselor-scoped contracts; the frontend never falls back to administrator endpoints.

## Contracts already integrated

| Capability | Method and path | Frontend use |
| --- | --- | --- |
| Review queue | `GET /counselor/instrument-reviews` | Counselor review directory and assignment ordering |
| Review detail | `GET /counselor/instrument-reviews/{review_id}` | Version metadata, dimensions, questions, scoring, comments |
| Review comment | `POST /counselor/instrument-reviews/{review_id}/comments` | General or question-linked feedback |
| Approve revision | `POST /counselor/instrument-reviews/{review_id}/approve` | Revision-bound approval after confirmation |
| Request revision | `POST /counselor/instrument-reviews/{review_id}/request-revision` | Revision-bound decision with required feedback |

Review decisions send `expected_revision`. The UI blocks decisions when the submitted and current revisions differ.

## Required production contracts

These routes are typed in the frontend and simulated only in explicit local preview mode. Until implemented, production failures remain visible and no administrator capability is borrowed.

### Assigned cases

`GET /counselor/cases` must return only students connected to the authenticated counselor by an active assignment or counseling session. `GET /counselor/cases/{student_id}` must enforce the same relationship at query time.

The response should expose safe summaries only: student identity and academic placement, service context, a normalized risk summary, derived assessment category/severity summaries, and sessions belonging to the current counselor. It must omit raw assessment answers, chat content, journals, and notes authored by other counselors.

### Personal calendar

`GET /counselor/calendar?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` should return the authenticated counselor's appointments, recurring availability, and exception requests. Appointment resources should include name and `physical` or `virtual` type. Resource assignment and appointment mutation remain administrator-owned.

### Exception requests

`POST /counselor/exception-requests` should accept `date`, `full_day`, optional `start_time` and `end_time`, `reason`, and `note`. The backend should derive counselor identity from the token, calculate affected appointments, create a pending request, and leave existing appointments unchanged until an administrator decides it. Return the created exception with `pending`, `approved`, or `rejected` history and the administrator decision note.

### Profile and recurring availability

The current portal treats counselor profile and recurring availability as read-only. Add dedicated self-service contracts before enabling mutations. Do not reuse `/admin/users`, `/admin/counselors`, or admin counseling endpoints.

## Authorization and privacy acceptance criteria

- Every counselor query derives counselor identity from the authenticated token.
- A counselor cannot select another counselor ID in request parameters or bodies.
- Case detail returns 404 or 403 when no counselor/student relationship exists.
- Instrument review operations enforce reviewer assignment or documented open-review policy.
- Revision decisions are atomic and reject stale `expected_revision` values.
- Logs must not include raw assessment answers, notes, tokens, or student free text.
- Aggregate or summary fields must be produced server-side rather than by over-fetching private records.
- RLS and route checks should both enforce the same ownership boundary.

## Validation scenarios

Test two counselors with non-overlapping caseloads, direct URL access to an unrelated student, a stale instrument decision, an exception overlapping an appointment, and a rejected exception. Confirm the admin workflow can decide exceptions without changing the counselor's historical request record.
