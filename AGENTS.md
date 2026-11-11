# AGENTS.md

**Sajiwa** — AI mental health support for university students and counselors. Students use an
Expo app (AI chat, stress detection, PHQ-9/GAD-7/SRQ + the versioned DASS-21 instrument,
journaling); counselors/admins use a Next.js dashboard (risk monitoring, analytics, booking,
instrument authoring). An npm-workspace monorepo holds the frontend apps, the FastAPI backend
(Python 3.12), and the shared TypeScript packages; Docker runs PostgreSQL 17 + pgvector, Ollama
provides the local LLM/embeddings.

**Work test-first.** Every change to behaviour starts with a failing test, at the lowest
applicable tier, at one of the agreed seams. The `tdd` skill (`.agents/skills/tdd/`) is
mandatory for this repo; tiers, seams and the loop are in
[docs/testing-conventions.md](docs/testing-conventions.md).

## Structure

```
Therapy-Chatbot/
├── apps/
│   ├── mobile/        Expo React Native app (expo-router) — student-facing
│   ├── dashboard/     Next.js app — counselor/admin
│   └── backend/       FastAPI (Python 3.12) API + chatbot services
├── packages/          Shared TS: api-client, ui-shared, utils
├── db/                SQL baseline, migrations, RLS self-check
├── docs/              Setup + per-stack convention docs (linked below)
├── docker-compose.yml PostgreSQL 17 + pgvector + pgAdmin
└── package.json       Root workspace
```

Each app, package, and `db/` also has a local `AGENTS.md` — read it when working there.

## Read when relevant

- Install, run, tests, gotchas → [docs/development-conventions.md](docs/development-conventions.md)
- Test tiers, test-first rule, e2e hygiene → [docs/testing-conventions.md](docs/testing-conventions.md)
- Project-wide non-negotiables → [docs/project-conventions.md](docs/project-conventions.md)
- Python / FastAPI / Pydantic → [docs/python-conventions.md](docs/python-conventions.md), [docs/fastapi-conventions.md](docs/fastapi-conventions.md), [docs/pydantic-conventions.md](docs/pydantic-conventions.md)
- Backend enablement (instrument review, counseling resources, hotlines) → [docs/backend-enablement.md](docs/backend-enablement.md)
- PostgreSQL, RLS, schema, pgvector → [docs/postgresql-conventions.md](docs/postgresql-conventions.md)
- AI: routing / LangChain adapter / Ollama → [docs/semantic-router-conventions.md](docs/semantic-router-conventions.md), [docs/ollama-conventions.md](docs/ollama-conventions.md)
- TypeScript / React / React Native / Expo / routing / UI → [docs/typescript-conventions.md](docs/typescript-conventions.md), [docs/react-conventions.md](docs/react-conventions.md), [docs/react-native-conventions.md](docs/react-native-conventions.md), [docs/expo-conventions.md](docs/expo-conventions.md), [docs/expo-router-conventions.md](docs/expo-router-conventions.md), [docs/react-native-ui-conventions.md](docs/react-native-ui-conventions.md)
- npm workspaces / shared packages → [docs/npm-workspaces-conventions.md](docs/npm-workspaces-conventions.md)
- Docker / local infra → [docs/docker-conventions.md](docs/docker-conventions.md)
- Git, commits, PRs → [docs/git-conventions.md](docs/git-conventions.md) — Conventional Commits, atomic per-feature commits, no AI co-author trailers.
- Security: JWT, RBAC, encryption, secrets → [docs/security-conventions.md](docs/security-conventions.md)
- Next.js dashboard (active app is `apps/dashboard`, not Expo) → [docs/nextjs-conventions.md](docs/nextjs-conventions.md), [apps/dashboard/AGENTS.md](apps/dashboard/AGENTS.md)
