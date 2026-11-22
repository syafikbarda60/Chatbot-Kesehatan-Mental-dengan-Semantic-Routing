-- C500 F-06: an account with counseling history could not be deleted (foreign keys from
-- appointments). DELETE /accounts now removes the row when nothing references it and otherwise
-- anonymises it and sets deleted_at, so the service history stays while the person's identity
-- and access are gone. get_current_user refuses tokens of a deleted account.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

alter table users add column if not exists deleted_at timestamptz;

insert into schema_migrations(version) values ('015_account_soft_delete') on conflict(version) do nothing;
commit;
