-- Extras the mobile app needs on top of 01_schema.sql / 02_auth.sql. Runs after them.
-- For an existing database, apply once:
--   docker exec -i sajiwa-db psql -U sajiwa -d sajiwa < db/init/03_mobile_app.sql

-- ── Counselor directory for students ─────────────────────────────────────────
-- users RLS only lets a student read their own row, so expose just the public
-- counselor fields through SECURITY DEFINER (same pattern as auth_lookup).
create or replace function list_konselor()
returns table (user_id uuid, nama varchar, role varchar)
language sql
security definer
set search_path = public
stable
as $$
  select u.user_id, u.nama, u.role from users u where u.role = 'konselor' order by u.nama;
$$;

grant execute on function list_konselor() to sajiwa_app;
