# Development conventions

Repo-wide setup, running, and shared coding conventions. Stack-specific docs are linked from
[AGENTS.md](../AGENTS.md).

## Install

```bash
npm install                    # root: all workspaces ([npm-workspaces-conventions.md](npm-workspaces-conventions.md))

cd apps/backend
# Python 3.12 is required — semantic-router publishes no 3.13/3.14 wheels.
uv venv --python 3.12 venv     # or: python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # then fill DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
```

## Infrastructure

```bash
docker compose up -d     # PostgreSQL 17 + pgvector (init + migrations run on boot) + pgAdmin
docker compose ps
docker compose down      # keep data
docker compose down -v   # wipe data; re-applies db/init on next up
```

Backend at http://localhost:8000 (`/docs` for OpenAPI), pgAdmin at http://localhost:5050.
See [docker-conventions.md](docker-conventions.md) and [postgresql-conventions.md](postgresql-conventions.md).

## Run (three terminals)

```bash
docker compose up -d                                          # database
cd apps/backend   && venv/bin/uvicorn main:app --reload       # FastAPI :8000
cd apps/mobile    && npx expo start                           # Expo (mobile)
npm run dashboard:dev                                         # Next.js admin :3000
```

Seed dev accounts once the DB is up (idempotent; the first admin can't be created via the API),
and embed the RAG corpus once (the integration streaming checks need retrieved context):

```bash
cd apps/backend && venv/bin/python scripts/seed_dev_users.py
cd apps/backend && venv/bin/python scripts/embed.py
```

Also start `ollama serve` for chat/embeddings ([ollama-conventions.md](ollama-conventions.md)).

## Tests

Three tiers — unit, integration, e2e — with one command each. Rules, locations and known
 gaps: [testing-conventions.md](testing-conventions.md).

```bash
npm test                  # unit tier: every workspace + backend, no stack required
npm run test:integration  # integration tier: live API, Postgres, RLS self-check
npm run test:e2e          # e2e tier: betterwright drives the dashboard in a browser
```

The two live tiers skip loudly and exit 0 when their stack is down, so `npm test` stays the
 only command that must always be green. No CI runs any of them — run the tiers your change
 touches before opening a PR. New behaviour starts with a failing test at an agreed seam:
 [testing-conventions.md](testing-conventions.md#test-driven-development-is-required).

## Repo-wide conventions

- Deliberate shortcuts are tagged with `ponytail:` comments naming the ceiling + upgrade path.
- Everything else: [project-conventions.md](project-conventions.md), [typescript-conventions.md](typescript-conventions.md), [python-conventions.md](python-conventions.md). No backend linter/formatter is configured.

## Gotchas

- Run the backend from `apps/backend` — imports are top-level (`from auth import ...`), not a package.
- Schema baseline is `db/init/*.sql` (empty volume); additive changes go in `db/migrations/*.sql`
  and are applied by the one-shot `migrate` service on `docker compose up`. Wiping
  (`docker compose down -v`) destroys local data.
- The backend connects as `sajiwa_app` (non-superuser) so RLS applies. Pointing `DATABASE_URL` at
  `sajiwa` silently disables every policy — see [security-conventions.md](security-conventions.md).
- New migrations must grant CRUD on their tables (and `execute` on privileged functions) to
  `sajiwa_app`, enable RLS, and use `create or replace` so re-runs stay idempotent. A grant to a
  role that doesn't exist rolls back the whole migration transaction.
- `db/test_rls.sql` is the RLS/auth self-check; run it after schema or policy changes.
- No Ollama → the backend does not start (the router embeds route utterances at import). Fail loud,
  never silently degrade: see [ollama-conventions.md](ollama-conventions.md).
