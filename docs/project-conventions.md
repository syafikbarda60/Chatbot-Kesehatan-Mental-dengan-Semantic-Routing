# Project conventions

Repo-wide rules that apply no matter which layer or language you are editing. Framework-, tool-, and
language-specific conventions live in their own docs — see the full index in the
[root AGENTS.md](../AGENTS.md).

## Non-negotiables

- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**
  (`<type>[(scope)][!]: <description>`), enforced by `.githooks/commit-msg`. See
  [git-conventions.md](git-conventions.md).
- **No AI co-author trailers.** Commits carry no `Co-authored-by: Claude ...` (or any other tool);
  GitHub counts co-authors in the contributors graph, so tooling stays out of commit messages.
  See [git-conventions.md](git-conventions.md).
- **Test-driven development, always.** Load the `tdd` skill (`.agents/skills/tdd/`) before
  writing implementation code: no production change without a test that was watched failing
  first, at one of the pre-agreed seams. Commands, tiers and the loop:
  [testing-conventions.md](testing-conventions.md).
- Backend/DB identifiers are `snake_case`; user-facing messages are Bahasa Indonesia.
- Never log or store raw chat content — it is Fernet-encrypted (`core/security.py`). See
  [security-conventions.md](security-conventions.md).
- High-risk messages (`guardrail` route) always return the hardcoded crisis response; never let an LLM
  rewrite it. See [semantic-router-conventions.md](semantic-router-conventions.md).
- **Clinical instrument definitions are versioned and immutable once published.** Change wording,
  scoring, or severity bands only through a new draft → validate → publish flow; published versions
  are protected by DB triggers. DASS-21 wording/scoring is seeded by `db/migrations/` from the
  approved source — never edit it in app code. See [postgresql-conventions.md](postgresql-conventions.md).
- **Assessment answers are identifiers, not scores.** Clients submit `(question_id, option_id)`
  pairs; the backend resolves option scores server-side and never trusts a score from the request.
  Elevated DASS-21 categories notify admins with a category:severity summary only — no answers.
  See [security-conventions.md](security-conventions.md), [fastapi-conventions.md](fastapi-conventions.md).
- Admin operational endpoints (schedules, hotlines, attention, analytics) are `admin`-only and must
  never return raw chat, journal, assessment-answer, or guardrail-trigger content. See
  [fastapi-conventions.md](fastapi-conventions.md).
- Run `apps/backend` from its own directory (`venv`, `uvicorn main:app`). See
  [development-conventions.md](development-conventions.md).
- The schema source of truth is `db/init/*.sql` plus additive `db/migrations/*.sql`, applied by
  `docker compose up` (init on an empty volume, then migrations). Backend connects as the non-superuser `sajiwa_app`
  so RLS applies; request identity is `set_config('app.current_user_id', ..., true)` per transaction.
  See [postgresql-conventions.md](postgresql-conventions.md).
- Roles are `mahasiswa | konselor | admin | pemangku_jabatan` on `users.role`. See
  [security-conventions.md](security-conventions.md).
