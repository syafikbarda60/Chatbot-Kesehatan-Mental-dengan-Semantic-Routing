-- Iteration 4.8 (after 011_notifications): the admin DASS-21 editor's batch rules in the schema.
--
-- 1. At most one open draft per instrument. The API already serialises batch writes on the
--    instrument row (routes/dass21_batch.py); this index holds the rule for every writer.
--    It is created only when the data already satisfies it, so an old duplicate draft never
--    fails the migration — resolve those by hand, then create the index.
-- 2. publish_approved_dass21_version(): a counselor's approval of the standard DASS-21 is its
--    publication. RLS lets counselors read versions under review but never write them, so this
--    SECURITY DEFINER function does that one write, and only for a draft whose current revision
--    carries an approval. Custom instruments are left to the existing admin publish step.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

do $$
begin
  if exists (select 1 from assessment_instrument_versions where status = 'draft'
             group by instrument_id having count(*) > 1) then
    raise notice 'uq_one_draft_instrument_version not created: an instrument has more than one draft';
  else
    create unique index if not exists uq_one_draft_instrument_version
      on assessment_instrument_versions(instrument_id) where status = 'draft';
  end if;
end $$;

create or replace function publish_approved_dass21_version(p_version_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
begin
  if current_user_role() is distinct from 'konselor' then
    raise exception 'Only a counselor approval publishes the DASS-21';
  end if;
  select v.instrument_id, v.definition_revision into target
  from assessment_instrument_versions v
  join assessment_instruments i on i.instrument_id = v.instrument_id
  where v.instrument_version_id = p_version_id and v.status = 'draft'
    and lower(i.code) = 'dass-21' and i.instrument_kind = 'standard'
  for update of v;
  if not found then
    return false;
  end if;
  if not exists (select 1 from assessment_version_reviews r
                 where r.instrument_version_id = p_version_id
                   and r.definition_revision = target.definition_revision and r.status = 'approved') then
    return false;
  end if;
  update assessment_instrument_versions set status = 'archived', updated_by = app_user_id(), updated_at = now()
  where instrument_id = target.instrument_id and status = 'published';
  update assessment_instrument_versions
  set status = 'published', published_by = app_user_id(), published_at = now(),
      updated_by = app_user_id(), updated_at = now()
  where instrument_version_id = p_version_id;
  return true;
end;
$$;
revoke all on function publish_approved_dass21_version(uuid) from public;
grant execute on function publish_approved_dass21_version(uuid) to sajiwa_app;

insert into schema_migrations(version) values ('012_dass21_batch') on conflict(version) do nothing;
commit;
