# Testing conventions

Three tiers. Each one answers a different question, and a test belongs to exactly one of
them — if you cannot say which, it is a unit test that has wandered.

## Test-driven development is required

Every change to behaviour starts with a failing test. **Load the `tdd` skill before you write
implementation code** — it lives at `.agents/skills/tdd/SKILL.md` (restore it anywhere with
`npx skills experimental_install`, which reads the tracked `skills-lock.json`), and any agent
that reads `AGENTS.md` must treat it as mandatory for this repo. Its loop:

1. **Red** — one test, at one agreed seam, watched failing for the right reason (missing
   behaviour, not a typo). A test that passes the first time is not this step.
2. **Green** — only enough code to make it pass. No options, no "for later".
3. **Next slice** — the next test, shaped by what the last cycle taught you.
4. Then run the whole tier (`npm test`), not only the file you touched.

No production code without a failing test first. Wrote the code first? Delete it and start
from the test — keeping it as "reference" is writing tests after the fact, which proves
nothing. Exceptions need a reviewer's explicit agreement: throwaway prototypes, generated
code, config files. Bug fixes reproduce the bug in a failing test first, then fix it once in
the shared code path.

**Refactoring is not part of the loop.** It happens in review, with the tests already green.

## Seams: agree where the test attaches before writing it

A seam is the public boundary a test observes behaviour through. Tests live at seams, never
against internals. The seams for this codebase are pre-agreed below: a new test must attach
to one of them, and a new seam gets added here (with its trade-off) before the test exists.

| Seam | Tier | Catches | Misses |
|------|------|---------|--------|
| FastAPI route contract (`/auth`, `/assessment`, `/journal`, `/chat`, `/booking`) | unit (stubbed `core.db`) | request/response shape, role gates, validation | real SQL, triggers, RLS |
| `core/dass21.py` — `score_dass21`, `classify_dass21`, `normalize_subscales` | unit | scoring, bands, category mapping, whole-subscale variants | persistence, wiring |
| `/realtime` WebSocket (`routes/realtime.py`), `publish()` standing in for the DB listener | unit (stubbed `core.db`) | token-in-first-message handshake, staff-only gate, table→area map, expiry close | the LISTEN thread, the triggers |
| `lib/realtime/notice.ts` (dashboard) | unit | which socket messages are trusted, reconnect pacing, refused sessions not retried | socket lifecycle, page refetch |
| `core/mailer.py` — `send_reset_otp` (smtplib replaced) | unit | the reset mail's recipient and content, the SMTP handshake, the dev log fallback, a failure that never logs the code | real delivery, spam filtering |
| `services/chatbot/guardrail.py` — `is_crisis`, `strip_profanity` | unit | deterministic crisis detection | model tone and routing |
| `services/chatbot/rag.py` — `build_messages`, `_source_label` | unit | the citation reaching the prompt, filename fallback for an uncited chunk | retrieval quality, whether the model obeys the instruction |
| `services/chatbot/provenance.py` — `provenance_reply` | unit | which documents get named, the "AI, not a psychologist, no clients" claim, the empty-corpus fallback | fuzzy routing into this route, model behaviour on a miss |
| `services/chatbot/` history assembly | unit | prompt budget, crisis filtering, ordering | real model output |
| The live API over HTTP and `/realtime` (incl. `db/test_rls.sql`) | integration | real SQL, triggers (incl. who is notified of what), change notices, encryption at rest, RLS, Ollama | anything in the UI |
| `features/<domain>/model.ts` (dashboard) | unit | directory filters, draft validation, publish gate, priority ordering | rendering, fetch |
| `lib/notifications/model.ts` (dashboard) | unit | admin/counselor rows as one item, moved admin paths, badge, relative time | the panel, fetch |
| `nearestSession`, `reminderPlan`, `freshAlerts`, `notificationTips`, `calendarDates`, `packages/utils` exports | unit | time/TZ math, session reminders, which inbox items get a banner, per-brand delivery advice, stress score, reactions | app screens, the OS scheduling and drawing them |
| Dashboard journeys (`e2e/scenarios`) | e2e | sign-in, routing, a page rendering with real data | everything not asserted |

Two seams are honest gaps rather than choices: `lib/api/client` has no tier because Node
cannot resolve the dashboard's `@/` alias, and the mobile screens have no browser tier (see
[Known gaps](#known-gaps)).

## Rules that bite in this repo

- **One slice at a time, never horizontal.** Write one test, make it pass, then let the next
test respond to what you learned. Bulk-writing tests verifies imagined behaviour and commits
to a shape you have not built yet.
- **No tautological tests.** The expected value comes from an independent source of truth — a
  worked example, a published table, a literal. `assertEqual(score_dass21(r), sum(...))` or
  a band computed with the same formula as `classify_dass21` proves nothing; the DASS-21
  bands come from the approved clinical source.
- **Mock only at system boundaries** — the database, the model, the clock, the network. Never
  mock a module you own. The backend's stubbed `core.db` and the dashboard's fake fetch are
  boundaries; a mock of `features/x/model.ts` would not be.
- **Prefer the interface over a side channel.** A unit test asserts through the route or the
  function, not by reading the database afterwards. The exception is the integration tier
  proving what the API must never expose: ciphertext at rest, and RLS isolation between two
  accounts.
- **A test survives a refactor.** If it breaks when you move code without changing behaviour,
  it was attached to an implementation detail. The fix is the test, not the refactor.
- **No new source-grep tests.** Repo-wide checks such as `test_sql_percent.py` are lint-style
  guards and are tagged `ponytail:`; they are not behaviour tests and must not grow. The
  backend test that grepped the dashboard's minified source is the cautionary tale — it was
  red on `main` for everyone.

| Tier | Proves | Runs in | Needs |
|------|--------|---------|-------|
| Unit | a rule is right | seconds | nothing but the runtime |
| Integration | the API, database and model work together | ~1 min | docker + uvicorn + Ollama |
| E2E | a person can complete a journey in a browser | ~1 min | the stack + seeded accounts |

```bash
npm test                  # unit tier — every workspace + backend, no stack required
npm run test:integration  # integration tier — live API + Postgres + RLS self-check
npm run test:e2e          # e2e tier — betterwright drives the dashboard in a browser
```

The two live tiers **skip loudly** (`SKIP integration: docker is not running`) and exit 0
when their stack is down. A skip must print why: a silently skipped suite is worse than no
suite, because green then means nothing.

No CI runs these. Run the tiers your change touches before opening a PR; run `npm test`
always.

## What belongs where

**Unit** — pure logic, no database, no network, no clock you did not inject. Fakes are
allowed for a boundary you do not own (a stubbed `core.db`, a fake fetch). Never fake the
thing under test.

**Integration** — a real process boundary. Here that is the whole API against real Postgres
and real Ollama, plus the RLS policies and the migration files. It is allowed to be a
script rather than `unittest` cases when the checks share one seeded account and must run
in order — the live smoke run does, and it reports every failure instead of stopping at
the first.

**E2E** — a browser journey a student or counselor would recognise, and only that. If a
check can be made at a lower tier, it belongs there: a browser test is the slowest, flakiest
thing you can write.

## Where each tier lives

| Tier | Location | Runner |
|------|----------|--------|
| Unit (backend) | `apps/backend/tests/unit/*.py` | `unittest discover -s tests/unit` |
| Unit (dashboard) | `apps/dashboard/{lib,features}/**/*.test.ts` | `node --test` + type stripping |
| Unit (mobile, packages) | `*.test.ts` beside the source | `node --test` + type stripping |
| Integration (API) | `apps/backend/tests/integration/stack_smoke.py` | `tests/integration/run.sh` |
| Integration (RLS) | `db/test_rls.sql` | same script, via `docker exec psql` |
| E2E (dashboard) | `e2e/scenarios/*.mjs` | `e2e/run.mjs` → `betterwright run` |

Every workspace exposes `test:unit`, so the root command is
`npm run test:unit --workspaces --if-present && npm run backend:test:unit`. A new workspace
that adds `test:unit` is picked up automatically; the backend is not an npm workspace, so it
gets its own line.

## Writing tests

- **One behaviour per test**, named for the behaviour (`an assigned appointment wins over
  the requested pick`), not for the function.
- **No test-only code in production modules.** Helpers live in the test file.
- **Fix the root cause once.** A bug found at a higher tier gets a failing test at the
  lowest tier that can express it.
- **Say what a test is.** A test written after the code is a characterisation test, and
  calling it TDD is a lie the next reader will trust.

## E2E hygiene

- One journey per file, one browser session per journey (`e2e-<name>`), closed afterwards.
  Never let a journey depend on a session another one left behind.
- The runner preflights both servers and skips before opening a browser.
- Locators are matched against a running page, not guessed: `getByLabel` is a substring
  match by default, so `Kata sandi` also matched the show-password button — pass
  `{ exact: true }`.
- Assert the redirect or the rendered heading, not a sleep.

## Known gaps

- `packages/api-client` and `packages/ui-shared` have no unit tier. `storage.ts` imports
  React Native, so it needs a module shim before it can run under plain Node.
- The dashboard has no integration tier: its modules import through the `@/` alias, which
  Node cannot resolve without an extra loader. Its boundary is covered by the browser tier
  instead.
- Mobile has no browser tier. `react-native-web` is not the native app, and the student
  journeys are covered at the API boundary; add one only when a mobile-only bug slips past.
- No CI, by design. If that changes, the three tier commands above are the whole pipeline.
