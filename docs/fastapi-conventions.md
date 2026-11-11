# FastAPI conventions

Backend API in `apps/backend/`, Python 3.12. Entry point: `main.py`.

## Layout (FastAPI layer only)

```
apps/backend/
├── main.py              # FastAPI app, CORS, router registration, /health manifest
├── auth.py              # Depends-level auth guards (see security-conventions)
├── routes/              # One APIRouter per domain
│   ├── assessment.py    account.py   dashboard.py
│   ├── jadwal.py        journal.py   chat.py
│   ├── admin.py         admin_operations.py
│   ├── iteration3.py    iteration4.py     # additive admin/student platforms
│   └── backend_enablement.py              # B1 admin + counselor routers
├── tests/               # isolated unittest contracts (stub core.db, real JWTs)
└── core/                # Cross-cutting helpers
```

The chatbot logic itself is **not** FastAPI — it lives in `services/chatbot/` and is documented
under [semantic-router-conventions.md](semantic-router-conventions.md) and
[ollama-conventions.md](ollama-conventions.md). Routes only call into it.

## Conventions

- Each `routes/*.py` declares `router = APIRouter(prefix="/x", tags=["X"]),` defines Pydantic
  `BaseModel` request bodies, and is registered in `main.py` via `app.include_router(...)`.
- `routes/chat.py` exposes several routers from one file: `guardrail_router`, `router_router`,
  `rag_router`, `chat_router`.
- Request bodies are typed Pydantic models (`ChatRequest`, `AssessmentRequest`, ...); use
  `Literal[...]` for enums, `Field`/validators for constraints.
- Protect handlers with `user=Depends(get_current_user)`; restrict with
  `Depends(require_role("konselor", "admin", "pemangku_jabatan"))`.
  - **Identity always comes from the JWT.** Never accept a `user_id` field in a request body —
    `ChatRequest` deliberately has none, because a body-supplied id is a client-chosen RLS identity.
    Scope queries with `user_id=user.id`.
  - `admin.py` exports reusable guards: `operator_access` (konselor/admin/pemangku_jabatan) for
    assessment review, `directory_access` (admin/pemangku_jabatan) for identity profiles.
  - `admin_operations.py` uses a single `admin_access = require_role("admin")` for schedules,
    hotlines, attention signals, and analytics. Attention signals are `assessment`, `safety`, or
    `request` (`request` = a student tapped "kabari tim" in the crisis sheet).
  - `iteration3.py` exports `admin_router` (`/admin/*`, `admin`-only: academic scopes, counseling
    queue/appointments, notifications, report audits) and `student_router` (`/counseling/requests`,
    authenticated). `iteration4.py` exports `admin_router` (instrument authoring
    `/admin/assessment-instruments/*`, `/admin/analytics/comparison`,
    `/admin/counseling/calendar/multi`) and `assessment_router`
    (`/assessment/instrument/active`, `/assessment/instrument/submit`).
  - Instrument authoring is draft → validate → publish: standard DASS-21 content is locked (edit via
    a derived custom instrument instead), publish re-runs `validate_dass21_definition` plus DB
    checks, and published versions are immutable (DB triggers). Derived instruments do not inherit
    DASS-21 norms (`norms_enabled=false`).
  - `POST /assessment/instrument/submit` (`mahasiswa`-only) takes `instrument_version_id` +
    `(question_id, option_id)` pairs only, resolves scores server-side through `core/dass21.py`,
    writes `assessments` + `assessment_category_results`, and on elevated categories logs an
    `assessment` guardrail signal and calls `notify_dass21_admins()`. No client-supplied score is
    ever stored.
- `GET /accounts/konselor` returns the student-visible counselor directory via `list_konselor()`
  (public fields only: id, name, role) — students cannot read other `users` rows under RLS.
- Validate path/query input with FastAPI types, not manual parsing: `user_id: UUID`,
  `Query(1, ge=1, le=2147483647)` for page, `Query(20, ge=1, le=100)` for page_size, `Literal[...]` for
  filters, `date`/`time` for schedules. Business rules (date range, `end_time > start_time`) raise
  `HTTPException(422, ...)` before querying.
- Paginated list endpoints return `{entity, total, page, page_size}`; create endpoints return `201` and
  the created row (`{"jadwal": ...}` / `{"hotline": ...}`).
- `admin.py` / `admin_operations.py` keep responses to recorded fields only — never chat content,
  journals, assessment answers, or raw guardrail trigger input.
- Errors: `raise HTTPException(status_code=..., detail="Bahasa Indonesia message")`.
- Responses: plain dicts, `snake_case` keys; insert endpoints return the created row or
  `{entity, message}`. Always cast IDs with `str(user.id)`.
- Streaming endpoint `POST /chat/stream` is real SSE: a metadata frame (`{route, is_high_risk}`)
  first, then `{"token": ...}` frames as the model emits them, then `data: [DONE]`. The user
  message is saved before generation and the reply after it completes — a truncated answer never
  enters history, but the question survives an app kill.
- `POST /chat` returns `{response, route, is_high_risk}` and persists the turn when a `session_id`
  is supplied; `GET /chat/history?session_id=` returns the caller's own decrypted transcript —
  the newest 50 messages, oldest first.
  Both `/chat` and `/chat/stream` generate through `core.chat_stream`, so they cannot drift.
- `POST /chat/report` backs the crisis sheet's "kabari tim" button: it writes an unread
  `guardrail_logs` row (`[LAPORAN PENGGUNA]` prefix) surfaced by the dashboard as a `request`
  attention signal. It stores no message content.

## `/health` is the contract

`main.py`'s `/health` maps `CB-01..CB-14` and `ADMIN-01..ADMIN-04` to the original contract
endpoints. Add/rename one of those → update the manifest. The additive iteration3/iteration4
routers are not part of that manifest.

## Run

Setup and run commands: [development-conventions.md](development-conventions.md). Run from
`apps/backend` (imports are top-level, e.g. `from auth import ...`). Swagger at
`http://localhost:8000/docs`. Env vars: [security-conventions.md](security-conventions.md).
