-- Iteration 4.5 (after 008_counselor_workspace): change notices for the dashboard's live view.
--
-- Every statement that writes one of the tables below sends that table's name on the channel
-- sajiwa_changes. The API (routes/realtime.py) maps the name to a dashboard area and tells the
-- connected admins and counselors, who then refetch through the REST routes.
--
-- The payload is the table name and nothing else: any session that LISTENs on the channel can
-- read it, so it must never carry a row, an id or a score. Statement-level triggers keep a bulk
-- write to one notice, and Postgres folds identical notices inside one transaction anyway.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create or replace function notify_dashboard_change() returns trigger
language plpgsql as $$
begin
  perform pg_notify('sajiwa_changes', tg_table_name);
  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'guardrail_logs',
    'assessment_category_results',
    'counseling_requests',
    'counseling_appointments',
    'counselor_blocked_periods',
    'counselor_exception_requests'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_notify_dashboard', t);
    execute format(
      'create trigger %I after insert or update or delete on %I for each statement execute function notify_dashboard_change()',
      t || '_notify_dashboard', t
    );
  end loop;
end
$$;

insert into schema_migrations(version) values ('009_realtime_notify') on conflict(version) do nothing;
commit;
