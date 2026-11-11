-- Iteration 4.4 (after 007_privacy_consent): the counselor workspace on real data.
--
-- 1. Caseload. A counselor reads a student only through an active case assignment, never just
--    by holding the konselor role. Assigning an appointment opens the case (the rule the
--    admin/counselor handoff recommends); revoking it ends access without deleting history.
-- 2. Schedule exceptions. A counselor asks for time off; an admin approves (which creates the
--    authoritative counselor_blocked_periods row) or rejects. Approval never cancels the
--    appointments it overlaps: those are listed on the request for the admin to handle.
--
-- Appointment overlap per counselor and per student is already enforced by the exclusion
-- constraints of 001_iteration3c.sql.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

-- ── caseload ─────────────────────────────────────────────────────────────────
create table if not exists counselor_case_assignments (
  counselor_case_assignment_id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references users(user_id) on delete restrict,
  student_id uuid not null references users(user_id) on delete cascade,
  status varchar(16) not null default 'active' check (status in ('active','revoked')),
  created_by uuid references users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_by uuid references users(user_id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index if not exists uq_counselor_case_assignments_active
  on counselor_case_assignments(counselor_id, student_id) where status = 'active';
create index if not exists idx_counselor_case_assignments_student
  on counselor_case_assignments(student_id) where status = 'active';

-- The one question every case-scoped policy asks. SECURITY DEFINER so a policy on users or
-- student_support_profiles can ask it without recursing into this table's own RLS.
create or replace function counselor_has_case(p_student uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from counselor_case_assignments
    where counselor_id = app_user_id() and student_id = p_student and status = 'active'
  );
$$;
grant execute on function counselor_has_case(uuid) to sajiwa_app;

-- An active appointment opens the case; an existing active case is left as is.
create or replace function open_case_for_appointment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('confirmed', 'rescheduled') then
    insert into counselor_case_assignments(counselor_id, student_id, created_by)
    values (new.counselor_id, new.student_id, app_user_id())
    on conflict (counselor_id, student_id) where status = 'active' do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists counseling_appointments_open_case on counseling_appointments;
create trigger counseling_appointments_open_case
  after insert or update of status, counselor_id on counseling_appointments
  for each row execute function open_case_for_appointment();

-- Same rule for the appointments made before this migration
insert into counselor_case_assignments(counselor_id, student_id)
select distinct counselor_id, student_id from counseling_appointments
where status in ('confirmed', 'rescheduled', 'completed')
on conflict (counselor_id, student_id) where status = 'active' do nothing;

-- ── schedule exceptions ──────────────────────────────────────────────────────
create table if not exists counselor_exception_requests (
  counselor_exception_request_id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references users(user_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  full_day boolean not null default false,
  reason varchar(250) not null,
  note varchar(1000),
  status varchar(16) not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  -- Appointments the time off overlapped, recomputed when the admin decides. Informational:
  -- nothing is cancelled automatically.
  affected_appointment_ids uuid[] not null default '{}',
  reviewed_by uuid references users(user_id) on delete set null,
  reviewed_at timestamptz,
  decision_note varchar(1000),
  counselor_blocked_period_id uuid unique
    references counselor_blocked_periods(counselor_blocked_period_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((status = 'pending') = (reviewed_at is null)),
  check (status = 'approved' or counselor_blocked_period_id is null)
);
create index if not exists idx_counselor_exception_requests_counselor
  on counselor_exception_requests(counselor_id, starts_at);
create index if not exists idx_counselor_exception_requests_queue
  on counselor_exception_requests(status, created_at);

do $$
declare table_name text;
begin
  foreach table_name in array array['counselor_case_assignments','counselor_exception_requests']
  loop
    if not exists (select 1 from pg_trigger where tgname = table_name || '_updated_at') then
      execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
        table_name || '_updated_at', table_name);
    end if;
  end loop;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table counselor_case_assignments enable row level security;
alter table counselor_exception_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'counselor_case_assignments' and policyname = 'admin_manage_case_assignments') then
    create policy admin_manage_case_assignments on counselor_case_assignments for all
      using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
    create policy counselor_read_own_case_assignments on counselor_case_assignments for select
      using (counselor_id = app_user_id());

    create policy admin_manage_exception_requests on counselor_exception_requests for all
      using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
    create policy counselor_read_own_exception_requests on counselor_exception_requests for select
      using (counselor_id = app_user_id());
    -- A counselor files a request; only an admin decides it
    create policy counselor_create_own_exception_requests on counselor_exception_requests for insert
      with check (counselor_id = app_user_id() and current_user_role() = 'konselor'
                  and status = 'pending' and reviewed_at is null and counselor_blocked_period_id is null);

    -- Counselors used to read every support profile; now only their own cases'
    drop policy if exists counselor_read_support_profiles on student_support_profiles;
    create policy counselor_read_case_support_profiles on student_support_profiles for select
      using (current_user_role() = 'konselor' and counselor_has_case(user_id));

    -- What the caseload screens show about a student, for that student's counselors only
    create policy counselor_read_case_students on users for select
      using (current_user_role() = 'konselor' and counselor_has_case(user_id));
    create policy counselor_read_case_academic_profiles on student_academic_profiles for select
      using (current_user_role() = 'konselor' and counselor_has_case(user_id));
    create policy counselor_read_case_requests on counseling_requests for select
      using (current_user_role() = 'konselor' and counselor_has_case(student_id));
  end if;
end $$;

grant select, insert, update on counselor_case_assignments to sajiwa_app;
grant select, insert, update on counselor_exception_requests to sajiwa_app;

insert into schema_migrations(version) values ('008_counselor_workspace') on conflict(version) do nothing;
commit;
