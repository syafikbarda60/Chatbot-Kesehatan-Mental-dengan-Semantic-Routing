-- Iteration 4.3 (after 006_counseling_preferred_slot): the privacy walkthrough is shown once
-- per account, not once per device. The acceptance is stored with the account, so signing in
-- on a new phone, reinstalling, or clearing app data does not ask again.
-- Its own table rather than a users column: students cannot update their users row (RLS),
-- and a row per acceptance doubles as the record of when it was given.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create table if not exists privacy_consents (
  user_id     uuid        primary key references users(user_id) on delete cascade,
  accepted_at timestamptz not null default now()
);

alter table privacy_consents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'privacy_consents' and policyname = 'own_privacy_consent') then
    -- Read and record your own; never another account's.
    create policy own_privacy_consent on privacy_consents
      for all using (app_user_id() = user_id) with check (app_user_id() = user_id);
  end if;
end $$;

grant select, insert on privacy_consents to sajiwa_app;

insert into schema_migrations(version) values ('007_privacy_consent') on conflict(version) do nothing;
commit;
