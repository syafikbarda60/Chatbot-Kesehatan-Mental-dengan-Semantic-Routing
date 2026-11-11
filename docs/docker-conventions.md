# Docker conventions

Docker runs **one thing: the local PostgreSQL 17 + pgvector database**, plus pgAdmin as an optional
GUI. `docker-compose.yml` at the repo root is the whole configuration — there is no `Dockerfile`.

## Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| `db` | `pgvector/pgvector:pg17` | `5432` | user/db `sajiwa` (superuser), data in the `pgdata` volume |
| `migrate` | `pgvector/pgvector:pg17` | — | one-shot; applies `db/migrations/*.sql` after the db is healthy, then exits |
| `pgadmin` | `dpage/pgadmin4` | `5050` | `admin@example.com` / `admin`; the `Sajiwa local` server is pre-registered by `db/pgadmin/servers.json` |

pgAdmin rejects reserved TLDs, so use a normal-looking email — `.local` makes the container
crash-loop at startup. It connects to the DB with host `db` (container DNS), never `localhost`,
and as `sajiwa` so it bypasses RLS and can show every row.

## Commands

```bash
cd Therapy-Chatbot
docker compose up -d          # start db + pgAdmin
docker compose ps             # status
docker compose logs db        # init output, SQL errors
docker compose down           # stop, keep data
docker compose down -v        # stop and wipe the volume
```

## Init scripts

`db/init/*.sql` is mounted read-only at `/docker-entrypoint-initdb.d` and executed **once**, in
filename order, only when the `pgdata` volume is empty (schema details:
[postgresql-conventions.md](postgresql-conventions.md)). To re-apply after editing:
`docker compose down -v && docker compose up -d` — destroys all data, fine locally.

## Migrations

`db/migrations/*.sql` is the additive track for changes after the baseline. The one-shot `migrate`
service runs them in filename order once the db is healthy on every `docker compose up`: each
migration records its own filename stem in `schema_migrations` and the service skips versions
already present — so repeat `up`s are no-ops and a failing file stops the run. Add new DDL here,
not by editing `01_schema.sql`.

## Roles

- `sajiwa` — the compose superuser. Used by pgAdmin, by `psql` for admin work, and to own the
  schema. **Bypasses RLS.**
- `sajiwa_app` — non-superuser, created by `02_auth.sql`, granted CRUD on `public`. This is what
  the backend connects as, so RLS is actually enforced ([postgresql-conventions.md](postgresql-conventions.md)).

Do not commit container artifacts or local volumes; the named volume lives outside the repo.
