# Backend — local rules

FastAPI app + AI services. Run all commands from this directory — imports are top-level
(`from auth import ...`), not a package.

```bash
venv/bin/uvicorn main:app --reload               # API :8000
venv/bin/python scripts/seed_dev_users.py        # dev accounts (once, DB up)
venv/bin/python -m unittest discover -s tests/unit -v  # unit tier, no DB/AI
venv/bin/python tests/integration/stack_smoke.py # integration tier (full stack up)
```

Setup and gotchas: [root development doc](../../docs/development-conventions.md). Test tiers:
[testing conventions](../../docs/testing-conventions.md).

- Venv `venv/` (Python 3.12 required; semantic-router has no 3.13+ wheels).
- Schema changes: `db/migrations/NNN_*.sql` (additive, recorded in `schema_migrations`) —
  workflow and init/migration split: [db/AGENTS.md](../../db/AGENTS.md).
- Iteration 3/4 admin APIs: `routes/iteration3.py` (counseling, academic scopes, notifications),
  `routes/iteration4.py` (versioned instruments, comparison analytics, multi-counselor calendar).
  DASS-21 scoring rules live in `core/dass21.py` — change only with an approved clinical source.
- B1 enablement (`routes/backend_enablement.py`, migration 004): [backend enablement](../../docs/backend-enablement.md).
- No linter/formatter configured; match existing style.
- Conventions: [python](../../docs/python-conventions.md), [fastapi](../../docs/fastapi-conventions.md),
  [pydantic](../../docs/pydantic-conventions.md), [postgresql](../../docs/postgresql-conventions.md).
- Chat/AI services (`services/chatbot/`): [ollama](../../docs/ollama-conventions.md),
  [semantic-router](../../docs/semantic-router-conventions.md). Crisis and provenance are fixed
  replies — never send them to the model. RAG answers must open with the chunk's citation.
