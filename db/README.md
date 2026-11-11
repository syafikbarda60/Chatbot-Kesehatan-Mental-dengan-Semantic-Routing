# Local PostgreSQL

PostgreSQL 17 + pgvector for local development, run by `docker-compose.yml` at the repo root.
`db/init/*.sql` is applied **once**, in filename order, only when the `pgdata` volume is empty.

```bash
docker compose up -d          # start db + pgAdmin
docker compose ps
docker compose down           # stop (keep data)
docker compose down -v        # stop and wipe data (re-runs db/init on next up)
```

- pgAdmin: http://localhost:5050 — `admin@example.com` / `admin`. The server
  **Sajiwa local** is pre-registered (`db/pgadmin/servers.json`) and auto-connects, so you can
  browse immediately: `Servers → Sajiwa local → Databases → sajiwa → Schemas → public →
  Tables`. Right-click a table → **View/Edit Data → All Rows**.
  It connects as `sajiwa` (superuser, bypasses RLS) so you see every row. Connecting as
  `sajiwa_app` would show almost nothing, because pgAdmin never sets `app.current_user_id`.
  `db/pgadmin/pgpass` holds that local password in plain text — it is the same dev-only
  credential already in `docker-compose.yml`, not a secret.
- Backend connects as the **non-superuser** role so RLS applies:

```
DATABASE_URL=postgresql://sajiwa_app:sajiwa_app@localhost:5432/sajiwa
JWT_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
ENCRYPTION_KEY=<python -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())">
```

`sajiwa_app` is the only runtime role; the backend connects as it (see the
DATABASE_URL above) so RLS applies.

## Files

| File | Contents |
|------|----------|
| `init/01_schema.sql` | tables, indexes, RLS policies, `match_documents()` |
| `init/02_auth.sql` | `sajiwa_app` runtime role + grants, `password_hash`, `password_resets`, `auth_lookup()`, `set_password()` |
| `init/03_mobile_app.sql` | `list_konselor()` counselor directory (`SECURITY DEFINER`) for the student booking screen |
| `migrations/*.sql` | additive changes after the baseline; applied by the one-shot `migrate` service on `docker compose up`, tracked in `schema_migrations` |
| `test_rls.sql` | RLS isolation + auth self-check; rolls back, leaves no data |

## Self-check

This is the database half of the integration tier — `npm run test:integration` from the
repo root runs it together with the live API checks. Run it after any schema or policy change:

```bash
docker exec -i -e PGPASSWORD=sajiwa_app sajiwa-db \
  psql -v ON_ERROR_STOP=1 -U sajiwa_app -d sajiwa < db/test_rls.sql
```

Expect `NOTICE: all RLS/auth checks passed`.

## Notes

- `sajiwa` (the compose user) is a **superuser** and bypasses RLS — it is only for pgAdmin and
  admin `psql`. Never point the backend at it.
- `migrations/*.sql` is the additive track after the baseline; the one-shot `migrate` service
  applies it on every `docker compose up`. Editing the `init/*.sql` baseline requires
  `docker compose down -v`, which destroys local data.
