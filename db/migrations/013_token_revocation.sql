-- MASVS-AUTH-1 (after 012_dass21_batch): tokens revoked by POST /auth/logout.
--
-- A JWT is valid until it expires; logging out on the phone only forgot it locally, so a copy
-- kept working for the rest of its lifetime. get_current_user now refuses any token whose jti is
-- listed here. Rows are only needed until expires_at; after that the token fails on its own,
-- so they can be purged at any time (delete from revoked_tokens where expires_at < now()).
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create table if not exists revoked_tokens (
  jti uuid primary key,
  user_id uuid not null references users(user_id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz not null default now()
);
create index if not exists idx_revoked_tokens_expires on revoked_tokens(expires_at);

alter table revoked_tokens enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='revoked_tokens' and policyname='own_read_revoked_tokens') then
    create policy own_read_revoked_tokens on revoked_tokens for select using (user_id = app_user_id());
    create policy own_insert_revoked_tokens on revoked_tokens for insert with check (user_id = app_user_id());
  end if;
end $$;
grant select, insert on revoked_tokens to sajiwa_app;

insert into schema_migrations(version) values ('013_token_revocation') on conflict(version) do nothing;
commit;
