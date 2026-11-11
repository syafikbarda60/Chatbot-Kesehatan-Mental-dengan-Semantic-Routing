# Python conventions

Backend language: **Python 3.12**, run from `apps/backend/`. No web framework code here —
see [fastapi-conventions.md](fastapi-conventions.md) and [pydantic-conventions.md](pydantic-conventions.md).

## Project layout

```
apps/backend/
├── main.py          # app entry
├── auth.py          # auth guards
├── core/            # cross-cutting (security.py, db.py, dass21.py)
├── routes/          # API routers
├── services/        # business/AI logic
├── tests/unit/      # unit tier: unittest, no DB, no AI
├── tests/integration/ # integration tier: live stack (stack_smoke.py, run.sh)
└── scripts/         # one-off scripts (embed.py, seed_dev_users.py)
```

Modules are top-level, **not** a package: imports are `from auth import ...`, `from core.security import ...`,
`from services.chatbot.core import ...`. Always run from `apps/backend`. Pure business rules live in
`core/` as plain functions with no DB/AI imports (e.g. `core/dass21.py` scoring/validation); routes do
the I/O. Scripts in `scripts/` that import app modules add the backend root to `sys.path` before the
import (`embed.py`, `test_rag_performance.py`) so direct `python scripts/x.py` invocation works.

## Dependencies

- Declared in `apps/backend/requirements.txt`, lower-bound pinned (`>=`): `fastapi`, `uvicorn[standard]`,
  `pydantic[email]`, `python-dotenv`, `psycopg[binary,pool]`, `PyJWT`, `bcrypt`, `semantic-router`,
  `langchain-ollama`, `langchain-core`, `python-docx`, `ollama`, `cryptography`.
- `httpx` (needed by FastAPI's `TestClient`) is **not** in `requirements.txt` — install it ad hoc to run
  `tests/`.
- No `pyproject.toml` / no formatter config; keep edits consistent with surrounding style.

## Conventions

- `snake_case` for functions, variables, modules, table/column names.
- Type hints on function signatures (`def chat(user_message: str) -> str:`); use `typing.Optional`/`List`
  as the code does.
- Env via `python-dotenv`: `load_dotenv()` at module top, then `os.getenv(...)`.
- Database access goes through `core/db.py` (`db()`, `query()`, `execute()`) with parameterized SQL
  and an explicit `user_id` for RLS — never a raw connection or string-built SQL. See
  [postgresql-conventions.md](postgresql-conventions.md).
- User-facing messages and `HTTPException.detail` are Bahasa Indonesia.
- IDs written to Postgres are cast with `str(user.id)`.
- Every chatbot/AI module ends with an `if __name__ == "__main__":` smoke-test block of sample inputs —
  follow that pattern when adding one.
- Contract tests live in `tests/` (`unittest`) and isolate the module under test: stub `core.db.query`
  in `sys.modules` and patch `auth.query`; never open a real database, AI model, or network. Run with
  `python -m unittest discover -s tests/unit -v` (see [development-conventions.md](development-conventions.md)).
- Fail fast on missing critical config (`core/security.py` raises at import if `ENCRYPTION_KEY` is unset).

## Run

Setup and run commands: [development-conventions.md](development-conventions.md).
