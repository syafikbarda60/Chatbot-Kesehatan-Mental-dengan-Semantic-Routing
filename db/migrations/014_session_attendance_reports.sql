-- Iteration 4.8 (after 013_token_revocation): attendance and session reports.
--
-- After a session the counselor who held it, or an admin, records whether the student came
-- (the appointment's existing completed / no_show states) and writes a two-part report:
--   counseling_student_reports     summary + follow-up the student reads in the app
--   counseling_management_reports  topic, risk, follow-up action, notes: counselor and admin only
-- Two tables rather than two columns so RLS, not the API, keeps the management part from the
-- student. Reports are only for sessions marked attended; the API enforces that.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

-- ── attendance ───────────────────────────────────────────────────────────────
-- Counselors may read their appointments but not write them (admins own the schedule), so the
-- one change they may make goes through here. Also keeps the request and the event log in step,
-- as the admin PATCH does. Not found / not yours: P0002. Not started or cancelled: 55000.
create or replace function record_counseling_attendance(p_appointment uuid, p_attended boolean)
returns varchar language plpgsql security definer set search_path = public as $$
declare
  a counseling_appointments%rowtype;
  next_status varchar(20) := case when p_attended then 'completed' else 'no_show' end;
begin
  select * into a from counseling_appointments where counseling_appointment_id = p_appointment for update;
  if not found or not (a.counselor_id = app_user_id() or current_user_role() = 'admin') then
    raise exception 'Sesi tidak ditemukan' using errcode = 'P0002';
  end if;
  if a.status not in ('confirmed', 'rescheduled', 'completed', 'no_show') or a.starts_at > now() then
    raise exception 'Kehadiran hanya dapat dicatat untuk sesi yang sudah dimulai dan tidak dibatalkan' using errcode = '55000';
  end if;
  if a.status <> next_status then
    update counseling_appointments set status = next_status where counseling_appointment_id = p_appointment;
    update counseling_requests set status = next_status where counseling_request_id = a.counseling_request_id;
    insert into counseling_appointment_events(counseling_appointment_id, event_type, actor_user_id, previous_values, new_values)
    values (p_appointment, next_status, app_user_id(), jsonb_build_object('status', a.status), jsonb_build_object('status', next_status));
  end if;
  return next_status;
end;
$$;
grant execute on function record_counseling_attendance(uuid, boolean) to sajiwa_app;

-- ── reports ──────────────────────────────────────────────────────────────────
create table if not exists counseling_student_reports (
  counseling_appointment_id uuid primary key references counseling_appointments(counseling_appointment_id) on delete cascade,
  summary varchar(2000) not null check (btrim(summary) <> ''),
  follow_up varchar(2000),
  author_user_id uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists counseling_management_reports (
  counseling_appointment_id uuid primary key references counseling_appointments(counseling_appointment_id) on delete cascade,
  topic varchar(20) not null
    check (topic in ('akademik', 'keluarga', 'relasi', 'keuangan', 'kesehatan_mental', 'karier', 'lainnya')),
  risk_level varchar(10) not null check (risk_level in ('rendah', 'sedang', 'tinggi')),
  follow_up varchar(20) not null default 'none' check (follow_up in ('none', 'next_session', 'referral')),
  notes varchar(4000),
  author_user_id uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists counseling_student_reports_updated_at on counseling_student_reports;
create trigger counseling_student_reports_updated_at before update on counseling_student_reports
  for each row execute function set_updated_at();
drop trigger if exists counseling_management_reports_updated_at on counseling_management_reports;
create trigger counseling_management_reports_updated_at before update on counseling_management_reports
  for each row execute function set_updated_at();

alter table counseling_student_reports enable row level security;
alter table counseling_management_reports enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'counseling_student_reports' and policyname = 'student_report_participant_read') then
    -- the student and the counselor of that session read the student part
    create policy student_report_participant_read on counseling_student_reports for select using (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_student_reports.counseling_appointment_id
        and (a.student_id = app_user_id() or a.counselor_id = app_user_id())));
    create policy student_report_counselor_insert on counseling_student_reports for insert with check (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_student_reports.counseling_appointment_id
        and a.counselor_id = app_user_id()));
    create policy student_report_counselor_update on counseling_student_reports for update using (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_student_reports.counseling_appointment_id
        and a.counselor_id = app_user_id()));
    create policy student_report_admin on counseling_student_reports for all
      using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'counseling_management_reports' and policyname = 'management_report_counselor_read') then
    -- never the student: only the counselor of that session and admins
    create policy management_report_counselor_read on counseling_management_reports for select using (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_management_reports.counseling_appointment_id
        and a.counselor_id = app_user_id()));
    create policy management_report_counselor_insert on counseling_management_reports for insert with check (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_management_reports.counseling_appointment_id
        and a.counselor_id = app_user_id()));
    create policy management_report_counselor_update on counseling_management_reports for update using (exists (
      select 1 from counseling_appointments a where a.counseling_appointment_id = counseling_management_reports.counseling_appointment_id
        and a.counselor_id = app_user_id()));
    create policy management_report_admin on counseling_management_reports for all
      using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
  end if;
end $$;
grant select, insert, update on counseling_student_reports, counseling_management_reports to sajiwa_app;

insert into schema_migrations(version) values ('014_session_attendance_reports') on conflict(version) do nothing;
commit;
