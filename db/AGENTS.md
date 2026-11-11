# db — local PostgreSQL 17 + pgvector

`init/*.sql` runs **once** on an empty volume (filename order). Editing `init/` needs
`docker compose down -v && docker compose up -d` (wipes local data).

- Schema change workflow: add `db/migrations/NNN_*.sql`; each file records its own version in
  `schema_migrations`, and the one-shot `migrate` service applies unapplied files on
  `docker compose up`, skipping the rest — a migration never has to be re-runnable.
- `test_rls.sql` is the database half of the integration tier: it checks RLS policies and
  auth functions. Run it after touching policies or grants — `npm run test:integration`
  runs it together with the live API checks
  ([testing conventions](../docs/testing-conventions.md)).
- pgAdmin at :5050 — details in [README](README.md).

Conventions: [postgresql](../docs/postgresql-conventions.md),
[security/RLS](../docs/security-conventions.md),
[docker](../docs/docker-conventions.md).
