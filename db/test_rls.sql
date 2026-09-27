-- Self-check for the RLS + auth layer. Run as the app role:
--
--   docker exec -i -e PGPASSWORD=sanctuary_app sanctuary-db \
--     psql -v ON_ERROR_STOP=1 -U sanctuary_app -d sanctuary < db/test_rls.sql
--
-- Everything runs in one transaction and rolls back, so it leaves no data.

begin;

-- Three users, inserted exactly the way register/create_account do.
select set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
insert into users (user_id, email, nama, role, password_hash) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'A', 'mahasiswa', 'x');

select set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
insert into users (user_id, email, nama, role, password_hash) values
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'B', 'mahasiswa', 'x');

select set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
insert into users (user_id, email, nama, role, password_hash) values
  ('33333333-3333-3333-3333-333333333333', 'admin@test.local', 'Admin', 'admin', 'x');

do $$
declare n int;
begin
  -- the app role must not be able to skip RLS
  assert not (select rolsuper from pg_roles where rolname = current_user),
    'app role is superuser; RLS is cosmetic';
  assert (select relrowsecurity from pg_class where relname = 'users'),
    'RLS not enabled on users';
  assert to_regprocedure('match_documents(vector,double precision,integer)') is not null,
    'match_documents missing';

  -- anonymous: no user rows, but login lookup and public tables work
  perform set_config('app.current_user_id', '', true);
  select count(*) into n from users;
  assert n = 0, format('RLS leak: anonymous read %s users', n);

  select count(*) into n from auth_lookup('a@test.local');
  assert n = 1, 'auth_lookup broken for anonymous caller';

  select count(*) into n from hotline;
  assert n = 3, format('hotline seed missing (%s rows)', n);

  -- a student sees only their own row
  perform set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
  select count(*) into n from users;
  assert n = 1, format('RLS leak: A saw %s users', n);

  -- admin sees everyone
  perform set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
  select count(*) into n from users;
  assert n = 3, format('admin policy broken: saw %s users', n);

  -- journals are private to their owner
  perform set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
  insert into journals (user_id, content) values ('11111111-1111-1111-1111-111111111111', 'secret');
  perform set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
  select count(*) into n from journals;
  assert n = 0, 'RLS leak: B read A''s journal';

  -- anonymous cannot write a journal
  perform set_config('app.current_user_id', '', true);
  begin
    insert into journals (user_id, content) values ('11111111-1111-1111-1111-111111111111', 'nope');
    raise exception 'RLS leak: anonymous inserted a journal';
  exception when insufficient_privilege then
    null;  -- expected
  end;

  -- password reset path
  perform set_password('11111111-1111-1111-1111-111111111111', 'newhash');
  select count(*) into n from auth_lookup('a@test.local') where password_hash = 'newhash';
  assert n = 1, 'set_password did not update';

  raise notice 'all RLS/auth checks passed';
end $$;

rollback;
