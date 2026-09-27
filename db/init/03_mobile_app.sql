-- Extras the mobile app needs on top of 01_schema.sql / 02_auth.sql. Runs after them.
-- For an existing database, apply once:
--   docker exec -i sanctuary-db psql -U sanctuary -d sanctuary < db/init/03_mobile_app.sql

-- ── chat_sessions: one row per conversation (chat history list + generated title) ──
create table if not exists chat_sessions (
  session_id text        primary key,
  user_id    uuid        not null references users(user_id) on delete cascade,
  title      text,
  started_at timestamptz not null default now()
);
create index if not exists idx_chat_sessions_user on chat_sessions(user_id, started_at desc);

alter table chat_sessions enable row level security;
drop policy if exists "own_chat_sessions" on chat_sessions;
create policy "own_chat_sessions" on chat_sessions
  for all using (app_user_id() = user_id) with check (app_user_id() = user_id);

grant select, insert, update, delete on chat_sessions to sanctuary_app;

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

grant execute on function list_konselor() to sanctuary_app;
