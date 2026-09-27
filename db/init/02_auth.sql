-- Auth layer for the pure-PostgreSQL backend. Runs after 01_schema.sql.

-- ── Non-superuser app role so RLS actually applies ───────────────────────────
-- `sanctuary` (the compose superuser) bypasses RLS; the backend connects as
-- sanctuary_app. See db/README.md for the DATABASE_URL.
create role sanctuary_app login password 'sanctuary_app' nosuperuser;
grant usage on schema public to sanctuary_app;
grant select, insert, update, delete on all tables in schema public to sanctuary_app;
grant usage, select on all sequences in schema public to sanctuary_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to sanctuary_app;
alter default privileges in schema public
  grant usage, select on sequences to sanctuary_app;

-- ── Password storage ─────────────────────────────────────────────────────────
alter table users add column if not exists password_hash text;
alter table users add column if not exists email_verified boolean not null default false;

-- Self-registration: the app sets the new user's id as the session identity
-- before inserting, so this only allows creating your own row.
drop policy if exists "users_insert_self" on users;
create policy "users_insert_self" on users for insert with check (
  app_user_id() = user_id
);

-- ── Password reset OTPs ──────────────────────────────────────────────────────
create table if not exists password_resets (
  email      varchar(100) primary key,
  otp_hash   text         not null,
  expires_at timestamptz  not null,
  used       boolean      not null default false,
  created_at timestamptz  not null default now()
);

alter table password_resets enable row level security;
-- Holds no payload beyond email + bcrypt OTP hash, so allow anonymous access.
create policy "password_resets_all" on password_resets
  for all using (true) with check (true);

grant select, insert, update, delete on password_resets to sanctuary_app;

-- ── Login lookup (anonymous caller, so SECURITY DEFINER bypasses RLS) ────────
create or replace function auth_lookup(p_email varchar)
returns table (
  user_id       uuid,
  email         varchar,
  nama          varchar,
  nim           varchar,
  role          varchar,
  password_hash text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.user_id, u.email, u.nama, u.nim, u.role, u.password_hash
  from users u
  where u.email = p_email;
$$;

-- Password reset writes need to bypass RLS; the OTP is verified by the caller.
create or replace function set_password(p_user_id uuid, p_password_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update users set password_hash = p_password_hash where user_id = p_user_id;
$$;

grant execute on function auth_lookup(varchar) to sanctuary_app;
grant execute on function set_password(uuid, text) to sanctuary_app;
