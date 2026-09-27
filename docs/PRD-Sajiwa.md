# Product Requirements Document (PRD)

## Sajiwa — AI-Powered Mental Health Support System

| Field | Value |
|---|---|
| Product Name | Sajiwa |
| Document Type | Product Requirements Document (as-is baseline) |
| Version | 1.0.0 |
| Status | Baseline — documents implemented system state |
| Last Updated | 2026-09-14 |
| Repository | `prototype` (monorepo) |

> This document describes the system **as currently implemented**. It is a
> baseline specification, not an aspirational roadmap. Items that are
> advertised but not implemented are captured under
> [Section 15 — Known Gaps & Limitations](#15-known-gaps--limitations).

---

## 1. Executive Summary

Sajiwa is a mental health support platform designed for university
environments. It combines an AI conversational companion for students
(`mahasiswa`) with a counselor and administrator console for risk monitoring,
counseling scheduling, and account management.

The system is delivered as a TypeScript monorepo containing two Expo/React
Native clients (a student mobile app and an operator web console) and a
FastAPI backend. The AI layer uses retrieval-augmented generation (RAG) and a
semantic intent router to classify each incoming message into one of three
routes: **guardrail** (crisis intervention), **RAG** (psychoeducational
answers), or **conversational** (empathetic dialogue). A keyword-based stress
detector runs client-side to surface a non-clinical wellness indicator during
chat.

The product's central design constraint is **safety**: crisis language must
trigger an immediate, deterministic intervention with emergency contacts
rather than relying on generative output.

---

## 2. Background & Problem Statement

### 2.1 Problem

University students face elevated rates of stress, anxiety, and depression,
yet access to campus counseling is limited by stigma, wait times, and
availability. Counselors also lack early-warning signals to identify students
who need intervention.

### 2.2 Proposed Solution

Sajiwa provides:

1. A low-friction, always-available AI companion for students to reflect and
   seek psychoeducational guidance.
2. Deterministic crisis detection with immediate escalation and hotline
   referral.
3. A counselor/admin console for monitoring risk signals, managing
   availability, and handling consultation bookings.

### 2.3 Product Principles

- **Safety first.** Crisis detection must be deterministic and cannot depend
  on machine-generated text.
- **Privacy by default.** User message content is encrypted at rest; access is
  scoped per user.
- **Support, not diagnosis.** The AI validates feelings and provides
  information; it does not diagnose or prescribe.
- **Non-clinical UX.** Wellness indicators use supportive language, not
  clinical scores.

---

## 3. Product Goals & Success Metrics

### 3.1 Goals

| ID | Goal |
|---|---|
| G1 | Provide immediate, safe conversational support for students. |
| G2 | Detect and escalate high-risk language reliably. |
| G3 | Give counselors/admins operational visibility and scheduling tools. |
| G4 | Support self-reflection through journaling and assessments. |

### 3.2 Success Metrics (Instrumentation Status)

| Metric | Definition | Instrumentation |
|---|---|---|
| Guardrail trigger rate | Guardrail routes / total chat messages | Logged (`guardrail_logs`) |
| Chat engagement | Sessions per active student | Derivable (`chat_sessions`) |
| Journaling adoption | Students with >= 1 journal entry per week | Derivable (`journals`) |
| Assessment completion | Submitted assessments per week | Derivable (`assessments`) |
| Booking throughput | Bookings processed per week | Derivable (`booking_konsultasi`) |
| Response latency | End-to-end chat response time | Partially available (structured logs) |

> Note: No analytics dashboard/event pipeline exists yet; metrics are derivable
> from transactional tables but are not aggregated into a reporting product.

---

## 4. Target Users & Personas

### 4.1 Roles

Roles are enforced in `apps/backend/auth.py` (`require_role`) and constrained
by a database `CHECK` in `users.role`.

| Role | Primary Surface | Description |
|---|---|---|
| `mahasiswa` (Student) | Mobile app | End user seeking support. |
| `konselor` (Counselor) | Web console + limited mobile | Manages availability and consultations. |
| `admin` (Administrator) | Web console | Full account and booking management. |
| `pemangku_jabatan` (Stakeholder/Authority) | Web console | Monitoring and account oversight. |

### 4.2 Personas

**P1 — "Alya", 20, undergraduate student.** Experiences academic stress and
occasional anxiety. Wants a private, non-judgmental space to talk, and easy
access to a counselor when needed. Uses the mobile app.

**P2 — "Budi", 35, campus counselor.** Needs to see incoming bookings, manage
consultation availability, and know which students present elevated risk.
Uses the web console.

**P3 — "Dr. Sari", 45, head of student affairs (`pemangku_jabatan`).** Needs
aggregate visibility into mental health trends and user accounts without
handling day-to-day sessions.

---

## 5. Scope

### 5.1 In Scope (Implemented)

- Student authentication (email/password) with OTP-based password reset.
- AI chat with streaming responses over three routes (guardrail / RAG /
  conversational).
- Keyword-based client-side stress detection and a supportive wellness
  indicator.
- Deterministic crisis (guardrail) response with hotline referral.
- Self-journaling (create, read, update, delete) with mood tagging.
- Assessment submission and severity scoring (backend).
- Counselor availability management and student booking.
- Counselor/admin console: system overview, consultation queue, availability
  management, account management.
- Emergency hotline directory.

### 5.2 Out of Scope (Current Baseline)

- Native push notifications.
- Real-time chat between students and human counselors.
- Payment or insurance integration.
- Telehealth video/voice sessions.
- Clinical diagnosis or treatment recommendation.
- Third-party identity providers (Google/Apple buttons are non-functional).
- Multi-language support beyond Indonesian UI.

### 5.3 Known Gaps

See [Section 15](#15-known-gaps--limitations).

---

## 6. Functional Requirements by Role

Legend: **FR** = functional requirement. Priority uses MoSCoW
(Must / Should / Could / Won't).

### 6.1 Shared — Authentication

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-A1 | A user can register with name, NIM (optional), email, and password (min 8 chars). Registration forces role `mahasiswa`. | Must | `POST /auth/register`, `apps/mobile/app/register.tsx` |
| FR-A2 | A user can log in with email and password; a session returns access + refresh tokens and profile. | Must | `POST /auth/login`, `apps/mobile/app/index.tsx`, `apps/dashboard/app/index.tsx` |
| FR-A3 | Access token can be refreshed using a refresh token. | Must | `POST /auth/refresh`, `packages/api-client/src/api.ts` |
| FR-A4 | A user can request a password reset OTP by email and confirm with OTP + new password. | Should | `POST /auth/reset-password/request`, `POST /auth/reset-password/confirm` |
| FR-A5 | The mobile app permits only `mahasiswa` to proceed; the dashboard permits `admin`, `pemangku_jabatan`, `konselor`. | Must | `apps/mobile/app/index.tsx`, `apps/dashboard/app/index.tsx` |
| FR-A6 | Unauthorized (401) responses trigger a token refresh and retry once, then forced logout. | Must | `packages/api-client/src/api.ts` |

**Acceptance criteria (FR-A5):** A successful login by a non-`mahasiswa` user
on mobile results in logout with a rejection message and no navigation to the
home screen.

### 6.2 Student (`mahasiswa`) — Mobile App

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-S1 | Home shows a time-based greeting, daily date, and quick navigation tiles. | Should | `apps/mobile/app/home.tsx` |
| FR-S2 | Home supports inline mood journaling (Calm / Anxious / Focused / Tired) and displays a 7-day mood trend. | Should | `apps/mobile/app/home.tsx` |
| FR-S3 | Student can chat with the AI; responses stream token-by-token. | Must | `apps/mobile/app/chat.tsx`, `POST /chat/stream` |
| FR-S4 | Chat displays a wellness indicator derived from stress detection. | Should | `apps/mobile/components/chat/StressBar.tsx` |
| FR-S5 | Chat offers quick-reply suggestions that adapt to stress tier. | Could | `apps/mobile/components/chat/QuickReply.tsx` |
| FR-S6 | High stress opens a support modal with emergency contacts and a report action. | Must | `apps/mobile/components/chat/AlertModal.tsx` |
| FR-S7 | Student can view past chat sessions and reopen them. | Should | `apps/mobile/app/chat-history.tsx`, `GET /chat/sessions`, `GET /chat/history/{session_id}` |
| FR-S8 | Student can create, list, view, edit, and delete journal entries with a mood tag. | Should | `apps/mobile/app/journal*.tsx`, `/journal` endpoints |
| FR-S9 | Student can view weekly wellbeing reports derived from journals. | Could | `apps/mobile/app/stats.tsx` |
| FR-S10 | Student can browse counselors and available slots and create a booking. | Should | `apps/mobile/app/schedule.tsx`, `GET /jadwal`, `POST /booking` |
| FR-S11 | Student can view emergency hotlines and dial them. | Must | `apps/mobile/app/hotline.tsx`, `GET /guardrail/hotline` |
| FR-S12 | Student can view profile, activity counts, and log out. | Should | `apps/mobile/app/profile.tsx` |

**Acceptance criteria (FR-S3):** Sending a message appends the user message and
an AI placeholder immediately; tokens render incrementally; the stream ends
with a metadata event including `is_high_risk` and `route`.

**Acceptance criteria (FR-S6):** When the stress tier is high (>= 7), the modal
displays at minimum three contacts (Into The Light Indonesia `119 ext 8`,
Yayasan Pulih `(021) 788-42580`, nearest hospital ER `118`).

### 6.3 Counselor (`konselor`)

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-C1 | Counselor can create availability slots (date, start, end). | Must | `POST /jadwal`, `apps/dashboard/app/(dashboard)/availability-new.tsx` |
| FR-C2 | Counselor can list and cancel their own slots. | Must | `GET /jadwal/saya`, `PATCH /jadwal/{jadwal_id}` |
| FR-C3 | Counselor can view incoming bookings. | Must | `GET /booking/masuk` |
| FR-C4 | Counselor can approve or reject bookings. | Must | `PATCH /booking/{booking_id}`, `apps/dashboard/app/(dashboard)/schedule.tsx` |
| FR-C5 | Counselor can view dashboard metrics. | Should | `GET /dashboard/data` |
| FR-C6 | Counselor can view the counselor directory. | Could | `GET /accounts/konselor` |

### 6.4 Administrator (`admin`) / Stakeholder (`pemangku_jabatan`)

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-D1 | Admin can list all users. | Must | `GET /accounts` |
| FR-D2 | Admin can create users with an assigned role. | Must | `POST /accounts` |
| FR-D3 | Admin can update a user's name, NIM, or role. | Must | `PUT /accounts/{user_id}` |
| FR-D4 | Admin can delete a user (profile + auth). | Must | `DELETE /accounts/{user_id}` |
| FR-D5 | Admin can view all bookings enriched with student/counselor/slot data. | Must | `GET /booking/admin` |
| FR-D6 | Admin can view aggregate metrics (assessments, severity distribution, trend, guardrail count, pending bookings). | Must | `GET /dashboard/data`, `apps/dashboard/app/(dashboard)/index.tsx` |

### 6.5 AI Chat Pipeline

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-AI1 | Every message is classified into a route: `guardrail`, `rag`, or `conversational`. | Must | `apps/backend/services/chatbot/core.py`, SemanticRouter |
| FR-AI2 | Guardrail route returns a fixed, deterministic crisis response with hotlines. | Must | `apps/backend/services/chatbot/guardrail.py` |
| FR-AI3 | A keyword fallback also escalates crisis language when semantic routing misses it. | Must | `check_guardrail_keywords`, `check_guardrail` |
| FR-AI4 | RAG route retrieves document context and answers using it. | Must | `apps/backend/services/chatbot/rag.py`, `match_documents` RPC |
| FR-AI5 | Conversational route produces an empathetic, topic-bounded reply. | Must | `apps/backend/services/chatbot/conversational.py` |
| FR-AI6 | Chat history is scoped per session and per user (no cross-user leakage). | Must | `_fetch_chat_history`, per-session history |
| FR-AI7 | User/assistant messages are encrypted before persistence. | Must | `core/security.py` (`encrypt_text` / `decrypt_text`) |
| FR-AI8 | A session title is generated asynchronously and persisted. | Could | `core/task_queue.py`, `chat_sessions.title` |
| FR-AI9 | Prompt-injection patterns in user input are sanitized before LLM calls. | Should | `sanitize_user_input`, `validate_rag_query` |

### 6.6 Assessments

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-AS1 | A client can submit answers (`question_id`, `score` 0–3) with an instrument type. | Must | `POST /assessment/submit` |
| FR-AS2 | The backend sums scores and computes severity (minimal / mild / moderate / severe). | Must | `_calc_severity` |
| FR-AS3 | Moderate or severe results auto-log a high-risk notification. | Must | `_log_high_risk` |
| FR-AS4 | A student can view their assessment history. | Should | `GET /assessment/history` |

### 6.7 Stress Detection

| ID | Requirement | Priority | Implementation |
|---|---|---|---|
| FR-ST1 | The client computes a 0–10 stress level from the last 5 user messages using keyword weights. | Must | `packages/utils/src/stressDetection.ts` |
| FR-ST2 | Stress maps to three tiers: low (<= 3), mid (4–6), high (>= 7). | Must | `getStressTier` |
| FR-ST3 | The wellness indicator uses non-clinical, supportive language and actionable suggestions. | Should | `apps/mobile/components/chat/StressBar.tsx` |

---

## 7. Safety & Guardrail Requirements

Safety is the highest-priority subsystem. The following requirements are
**Must**.

| ID | Requirement |
|---|---|
| SR-1 | Crisis language must always produce a deterministic response containing emergency contacts. Generative output is bypassed. |
| SR-2 | A keyword-based detector must act as a safety net in addition to semantic routing. |
| SR-3 | Detected crisis events are persisted (`guardrail_logs`) for operator review. |
| SR-4 | The crisis response must not diagnose or prescribe; it refers to hotlines and ER. |
| SR-5 | Hotlines are sourced from the `hotline` table with a hardcoded fallback. |
| SR-6 | The client must display a support modal when stress is high or a high-risk stream is reported. |
| SR-7 | A user action ("report") must notify the Sajiwa team. |

**Reference crisis response** (`HARDCODED_RESPONSE`):

```
Saya mendengar kamu, dan saya sangat khawatir dengan kondisimu sekarang.
Kamu tidak sendirian. Tolong segera hubungi:
- Into The Light Indonesia: 119 ext 8
- Yayasan Pulih: (021) 788-42580
- IGD rumah sakit terdekat
Apakah kamu aman sekarang?
```

**Known safety limitations:** see Section 15 (no automated human-responder
paging; hotline list is static; keyword detector is not clinically validated).

---

## 8. Non-Functional Requirements

### 8.1 Security

| ID | Requirement | Status |
|---|---|---|
| NFR-SEC1 | Message content encrypted at rest (application-level). | Implemented |
| NFR-SEC2 | JWT bearer authentication on protected endpoints. | Implemented |
| NFR-SEC3 | Role-based access control on privileged endpoints. | Implemented (partial; see gaps) |
| NFR-SEC4 | Rate limiting on API surface. | Implemented (in-memory / Redis) |
| NFR-SEC5 | Prompt-injection sanitization. | Implemented |
| NFR-SEC6 | Password reset does not leak account existence. | Implemented |
| NFR-SEC7 | Booking status updates enforce ownership/role. | **Not implemented** |

### 8.2 Privacy

| ID | Requirement | Status |
|---|---|---|
| NFR-P1 | A student can access only their own sessions, messages, and journals. | Implemented (query-scoped by `user_id`) |
| NFR-P2 | Crisis logs are visible to operators for escalation. | Implemented |
| NFR-P3 | Consent and data-retention policy surfaced in-app. | **Not implemented** |

### 8.3 Performance & Reliability

| ID | Requirement | Status |
|---|---|---|
| NFR-R1 | SSE chat streaming with retry/backoff on the client. | Implemented |
| NFR-R2 | Database indexes for hot query paths. | Implemented (`20260911000000_add_indexes.sql`) |
| NFR-R3 | Health/readiness/liveness probes. | Implemented (`/health`, `/health/ready`, `/health/live`) |
| NFR-R4 | Structured JSON logging. | Implemented (`core/logger.py`) |
| NFR-R5 | LLM availability monitoring (Ollama). | Implemented (readiness probe) |

### 8.4 Accessibility & UX

| ID | Requirement | Status |
|---|---|---|
| NFR-U1 | Interactive elements expose accessibility labels/roles. | Partial |
| NFR-U2 | Minimum touch target and contrast standards. | Partial |
| NFR-U3 | Non-clinical, supportive wellness language. | Implemented |

---

## 9. System Architecture & Tech Stack

### 9.1 Monorepo Layout

```
prototype/
├── apps/
│   ├── mobile/      # Expo React Native (student app)
│   ├── dashboard/   # Expo React Native Web (operator console)
│   └── backend/     # FastAPI (Python 3.12)
├── packages/
│   ├── api-client/  # Shared typed API SDK (fetch + SSE)
│   ├── ui-shared/   # Theme, context, hooks, design tokens
│   └── utils/       # Stress detection, response helpers
├── supabase/        # Migrations, local config
└── docs/            # Documentation (this PRD)
```

### 9.2 Technology Stack

| Layer | Technology |
|---|---|
| Mobile & Console client | Expo ~54, React Native 0.81, React 19, expo-router ~6 |
| Client language | TypeScript 5.9 |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Database & Auth | Supabase (PostgreSQL) + `pgvector` |
| AI orchestration | Semantic Router, LangChain (`langchain_ollama`) |
| LLM & Embeddings | Ollama (`llama-3-8b-instruct` GGUF, `nomic-embed-text-v2-moe`) |
| Streaming | Server-Sent Events (SSE) |
| Shared SDK | `@prototype/api-client` |

### 9.3 Request Flow (Chat)

```
Mobile app
  -> POST /chat/stream (Bearer JWT)
     -> semantic_router(message) -> route
     -> check_guardrail(message, route) -> is_high_risk, route
     -> _fetch_chat_history(session, user)
     -> guardrail   : emit HARDCODED_RESPONSE, log, persist
        rag         : retrieve_docs -> LLM stream
        conversational : LLM stream
     -> persist encrypted assistant message
  <- SSE: {"token": ...}* then {"done": true, "is_high_risk", "route"}
```

---

## 10. Data Model / ERD

Derived from the live migrations
(`supabase/migrations/20260514072925_init_schema.sql`,
`20260514083846_add_journals_table.sql`,
`20260911000000_add_indexes.sql`).

### 10.1 Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | `user_id` (PK, FK `auth.users`), `nama`, `email` (unique), `nim`, `role`, `created_at` | Application profiles. |
| `assessments` | `assessment_id`, `user_id`, `instrument_type`, `answers` (jsonb), `score`, `severity`, `taken_at` | Assessment results. |
| `chat_sessions` | `session_id`, `user_id`, `started_at`, `ended_at`, `title` | Chat sessions. |
| `messages` | `message_id`, `session_id`, `user_id`, `role`, `content` (encrypted), `route_used`, `created_at` | Chat turns. |
| `guardrail_logs` | `log_id`, `session_id`, `triggered_input`, `triggered_at` | Crisis triggers. |
| `hotline` | `hotline_id`, `nama`, `nomor`, `deskripsi`, `created_at` | Emergency contacts. |
| `jadwal_konsultasi` | `jadwal_id`, `konselor_id`, `tanggal`, `waktu_mulai`, `waktu_selesai`, `status` | Availability slots. |
| `booking_konsultasi` | `booking_id`, `jadwal_id`, `user_id`, `status`, `catatan`, `created_at` | Bookings. |
| `journals` | `journal_id`, `user_id`, `content`, `mood`, `created_at`, `updated_at` | Self-journaling. |
| `documents` | `document_id`, `content`, `embedding` (vector 768), `metadata` (jsonb) | RAG knowledge base. |

### 10.2 Enumerations (CHECK constraints)

- `users.role`: `mahasiswa`, `konselor`, `admin`, `pemangku_jabatan`
- `jadwal_konsultasi.status`: `tersedia`, `dipesan`, `selesai`, `dibatalkan`
- `booking_konsultasi.status`: `menunggu`, `dikonfirmasi`, `selesai`, `dibatalkan`
- `journals.mood`: `Calm`, `Anxious`, `Focused`, `Tired`

---

## 11. User Flows

### 11.1 Student Login

1. Student opens the app (`index.tsx`), enters credentials.
2. `apiLogin` stores access/refresh tokens and profile.
3. Role check: non-`mahasiswa` is logged out with a rejection message.
4. `mahasiswa` lands on Home.

### 11.2 AI Chat & Escalation

1. Student sends a message.
2. Client streams `POST /chat/stream`, rendering tokens incrementally.
3. Backend routes and responds; persists encrypted turns.
4. On done, client reads `is_high_risk`; if true, opens `AlertModal`.
5. If stress tier is high, the modal may also open automatically.
6. Student may "report" (notify the team) or dismiss.

### 11.3 Journaling

1. Student selects a mood and writes content.
2. On save, `POST /journal` persists the entry.
3. History lists paginated entries; detail allows edit/delete.

### 11.4 Booking

1. Student browses counselors (`GET /accounts/konselor`) and slots (`GET /jadwal`).
2. Student books a slot (`POST /booking`), creating a `menunggu` booking.
3. Counselor approves/rejects in the console (`PATCH /booking/{id}`).

### 11.5 Assessment & Risk Notification

1. Client submits answers (`POST /assessment/submit`).
2. Backend scores and classifies severity.
3. Moderate/severe triggers `guardrail_logs` notification.

---

## 12. Compliance & Ethics

| Area | Position |
|---|---|
| Medical disclaimer | The AI is not a diagnostic or treatment tool; it provides support and referrals. |
| Crisis handling | Deterministic referral to human/emergency services. |
| Data protection | Message content encrypted; access scoped per user. Align with Indonesian PDP law (UU PDP). |
| Consent | **Gap:** no explicit consent capture/versioning in the current baseline. |
| Data retention | **Gap:** no automated retention/deletion policy beyond manual journal/session deletion. |
| Age/guardianship | **Gap:** no age assurance for minors. |

---

## 13. Risks & Mitigations

| ID | Risk | Impact | Mitigation (current) | Residual |
|---|---|---|---|---|
| R1 | Semantic router misses a crisis message | High | Keyword fallback + deterministic response | Medium |
| R2 | Cross-user data exposure | High | Per-user query scoping, encryption | Low |
| R3 | Prompt injection manipulates AI | Medium | Input sanitization | Medium |
| R4 | LLM/Ollama unavailable | Medium | Health probes, client retry/backoff | Medium |
| R5 | Unauthorized booking status change | Medium | None | **High** |
| R6 | Hallucinated psychoeducation | Medium | RAG grounding + prompt constraints | Medium |
| R7 | Self-harm content handled without human follow-up | High | Guardrail logging only (no paging) | **High** |

---

## 14. Roadmap / Phases

> The following reflects the observed build progression and natural next steps.

| Phase | Focus | Status |
|---|---|---|
| P0 | Core auth, chat (3 routes), guardrail, journals, booking | Delivered |
| P1 | Security hardening (booking authz), tests, observability | In progress |
| P2 | Assessment UI + item banks, notifications, consent capture | Planned |
| P3 | Reporting/analytics product, human escalation paging, accessibility | Planned |

---

## 15. Known Gaps & Limitations

The following are documented because the current repository and the root
`README.md` diverge.

| # | Gap | Evidence |
|---|---|---|
| 1 | **No clinical assessment UI.** README advertises PHQ-9/GAD-7/SRQ in the mobile app, but no questionnaire screen or item bank exists. Only backend endpoints accepting caller-supplied `question_id`/`score`. | No assessment screen in `apps/mobile/app/`; no question-bank files; `routes/assessment.py` |
| 2 | **Dashboard is not Next.js.** README states Next.js; it is an Expo React Native Web app. | `apps/dashboard/package.json` |
| 3 | **Mobile admin screen unreachable.** `apps/mobile/app/admin.tsx` exists but mobile login only permits `mahasiswa`. | `apps/mobile/app/index.tsx` |
| 4 | **Booking authorization gap.** `PATCH /booking/{booking_id}` has no ownership/role check. | `routes/jadwal.py` |
| 5 | **Placeholder console menu.** Student Insights, Alerts, Consultations, Reports, Generate Report, Settings, Support are non-functional. | `apps/dashboard/app/(dashboard)/_layout.tsx` |
| 6 | **No human escalation paging.** Guardrail events are logged but do not page a responder. | `routes/chat.py`, `core/task_queue.py` |
| 7 | **No consent/retention policy.** Privacy controls are not implemented in-app. | N/A |
| 8 | **Legacy conflicting schema.** `apps/backend/docs/schema.sql` uses `profiles`/`operator`/`risk_level`, conflicting with live migrations. | `apps/backend/docs/schema.sql` |
| 9 | **Third-party auth buttons non-functional.** Google/Apple buttons on login are decorative. | `apps/mobile/app/index.tsx` |
| 10 | **Stress detection is keyword-only.** No negation/stemming; not clinically validated. | `packages/utils/src/stressDetection.ts` |
| 11 | **Static hotline list.** Hotlines are seeded/hardcoded; no verified refresh cadence. | `services/chatbot/guardrail.py` |
| 12 | **Single-label routing.** A message mixing crisis + RAG gets one route only. | `services/chatbot/core.py` |

---

## 16. Appendix

### 16.1 API Endpoint Reference

#### Auth & Accounts (`routes/account.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register (role forced `mahasiswa`). |
| POST | `/auth/login` | Public | Authenticate; returns tokens + profile. |
| POST | `/auth/refresh` | Public | Refresh session. |
| POST | `/auth/reset-password/request` | Public | Send OTP. |
| POST | `/auth/reset-password/confirm` | Public | Confirm OTP + set password. |
| GET | `/auth/me` | Authenticated | Current profile. |
| GET | `/accounts` | admin, pemangku_jabatan | List users. |
| GET | `/accounts/konselor` | Authenticated | List counselors. |
| POST | `/accounts` | admin, pemangku_jabatan | Create user. |
| PUT | `/accounts/{user_id}` | admin, pemangku_jabatan | Update user. |
| DELETE | `/accounts/{user_id}` | admin, pemangku_jabatan | Delete user. |

#### Assessment (`routes/assessment.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/assessment/submit` | Authenticated | Submit answers; score + severity. |
| POST | `/assessment/notify-risk` | Authenticated | Log high-risk notification. |
| GET | `/assessment/history` | Authenticated | Own assessment history. |

#### Chat & AI (`routes/chat.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/guardrail/check` | Authenticated | Safety check. |
| POST | `/router/intent` | Public | Classify intent route. |
| POST | `/rag/context` | Authenticated | Retrieve RAG context. |
| POST | `/chat/stream` | Authenticated | SSE streaming chat. |
| GET | `/chat/sessions` | Authenticated | List own sessions. |
| GET | `/chat/history/{session_id}` | Authenticated | Decrypted history. |
| POST | `/chat/history` | Authenticated | Save a turn (non-stream). |
| POST | `/chat` | Authenticated | Unified non-streaming chat. |

#### Journal (`routes/journal.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/journal` | Authenticated | Create entry. |
| GET | `/journal` | Authenticated | List own entries (paginated). |
| GET | `/journal/today` | Authenticated | Today's entry. |
| PATCH | `/journal/{journal_id}` | Authenticated | Update own entry. |
| DELETE | `/journal/{journal_id}` | Authenticated | Delete own entry. |

#### Scheduling & Booking (`routes/jadwal.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/jadwal` | konselor, admin | Create slot. |
| GET | `/jadwal` | Authenticated | List available slots. |
| GET | `/jadwal/saya` | konselor, admin | Own slots. |
| PATCH | `/jadwal/{jadwal_id}` | konselor, admin | Update slot status. |
| POST | `/booking` | Authenticated | Create booking. |
| GET | `/booking/saya` | Authenticated | Own bookings. |
| GET | `/booking/masuk` | konselor, admin | Incoming bookings. |
| GET | `/booking/admin` | admin, pemangku_jabatan | All bookings. |
| PATCH | `/booking/{booking_id}` | Authenticated | Update booking status. |

#### Dashboard & Health (`routes/dashboard.py`, `main.py`)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/dashboard/data` | konselor, admin, pemangku_jabatan | Aggregate metrics. |
| GET | `/guardrail/hotline` | Public | Hotline directory. |
| GET | `/health` | Public | Health check. |
| GET | `/health/ready` | Public | Readiness (Supabase/Ollama/Redis). |
| GET | `/health/live` | Public | Liveness. |

### 16.2 Glossary

| Term | Definition |
|---|---|
| Guardrail | Deterministic safety route for crisis language. |
| RAG | Retrieval-Augmented Generation; grounds answers in `documents`. |
| Semantic Router | Embedding-based intent classifier selecting a route. |
| Stress Level | Client-computed 0–10 keyword score (non-clinical). |
| SSE | Server-Sent Events; used for token streaming. |
| Persona/Role | `mahasiswa`, `konselor`, `admin`, `pemangku_jabatan`. |

### 16.3 Severity Thresholds

| Severity | Score Range |
|---|---|
| minimal | 0–4 |
| mild | 5–9 |
| moderate | 10–14 |
| severe | 15+ |

---

*End of document.*
