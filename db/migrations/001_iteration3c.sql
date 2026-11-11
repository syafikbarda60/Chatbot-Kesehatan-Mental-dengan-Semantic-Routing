-- Iteration 3C: additive academic, notification, counseling, and report-audit support.
-- Safe for existing rows: all user relationships introduced here are nullable or live
-- in new tables. No existing table, column, status value, or record is removed.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create table if not exists schema_migrations (
  version varchar(100) primary key,
  applied_at timestamptz not null default now()
);

create extension if not exists btree_gist;

create table if not exists faculties (
  faculty_id uuid primary key default gen_random_uuid(),
  code varchar(20),
  name varchar(150) not null,
  active boolean not null default true,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_faculties_name_ci on faculties (lower(name));
create unique index if not exists uq_faculties_code on faculties (code) where code is not null;
create index if not exists idx_faculties_active on faculties (active, name);

create table if not exists academic_units (
  academic_unit_id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references faculties(faculty_id) on delete restrict,
  code varchar(30),
  name varchar(150) not null,
  unit_type varchar(20) not null check (unit_type in ('department', 'study_program')),
  degree_level varchar(20),
  active boolean not null default true,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_unit_id, faculty_id)
);
create unique index if not exists uq_academic_units_faculty_name_type
  on academic_units (faculty_id, lower(name), unit_type);
create index if not exists idx_academic_units_faculty_active
  on academic_units (faculty_id, active, name);

create table if not exists student_academic_profiles (
  user_id uuid primary key references users(user_id) on delete cascade,
  faculty_id uuid references faculties(faculty_id) on delete restrict,
  academic_unit_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_student_academic_unit_faculty
    foreign key (academic_unit_id, faculty_id)
    references academic_units(academic_unit_id, faculty_id) on delete restrict
);
create index if not exists idx_student_academic_faculty on student_academic_profiles(faculty_id);
create index if not exists idx_student_academic_unit on student_academic_profiles(academic_unit_id);

create table if not exists admin_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references users(user_id) on delete cascade,
  category varchar(20) not null check (category in ('assessment','safety','counseling','schedule','system')),
  title varchar(160) not null,
  context varchar(300),
  entity_type varchar(40),
  entity_id uuid,
  target_path varchar(300),
  read_at timestamptz,
  dedupe_key varchar(200),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_admin_notifications_dedupe
  on admin_notifications(admin_user_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_admin_notifications_inbox
  on admin_notifications(admin_user_id, read_at, created_at desc);
create index if not exists idx_admin_notifications_category
  on admin_notifications(admin_user_id, category, created_at desc);

create table if not exists counselor_profiles (
  user_id uuid primary key references users(user_id) on delete cascade,
  title varchar(100),
  specialization varchar(250),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_counselor_profiles_active on counselor_profiles(active);

create table if not exists counselor_availability_rules (
  availability_rule_id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references users(user_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone varchar(50) not null default 'Asia/Jakarta',
  effective_from date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create index if not exists idx_availability_counselor
  on counselor_availability_rules(counselor_id, active, day_of_week);
do $$
begin
  if not exists (select 1 from pg_constraint where conname='exclude_active_availability_overlap') then
    alter table counselor_availability_rules add constraint exclude_active_availability_overlap
      exclude using gist (
        counselor_id with =,
        day_of_week with =,
        int4range(extract(epoch from start_time)::int, extract(epoch from end_time)::int, '[)') with &&,
        daterange(coalesce(effective_from, '-infinity'::date), coalesce(effective_to, 'infinity'::date), '[]') with &&
      ) where (active);
  end if;
end $$;

create table if not exists counselor_blocked_periods (
  blocked_period_id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references users(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason varchar(250),
  created_by uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_blocked_periods_counselor
  on counselor_blocked_periods(counselor_id, starts_at, ends_at);

create table if not exists counseling_requests (
  counseling_request_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(user_id) on delete cascade,
  status varchar(20) not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled','rescheduled','no_show')),
  preferred_context varchar(250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_counseling_requests_queue
  on counseling_requests(status, created_at desc);
create index if not exists idx_counseling_requests_student
  on counseling_requests(student_id, created_at desc);

create table if not exists counseling_appointments (
  appointment_id uuid primary key default gen_random_uuid(),
  counseling_request_id uuid unique references counseling_requests(counseling_request_id) on delete restrict,
  legacy_booking_id uuid unique references booking_konsultasi(booking_id) on delete restrict,
  student_id uuid not null references users(user_id) on delete restrict,
  counselor_id uuid not null references users(user_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status varchar(20) not null default 'confirmed'
    check (status in ('confirmed','completed','cancelled','rescheduled','no_show')),
  created_by uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_appointments_calendar
  on counseling_appointments(starts_at, ends_at, status);
create index if not exists idx_appointments_counselor
  on counseling_appointments(counselor_id, starts_at);
create index if not exists idx_appointments_student
  on counseling_appointments(student_id, starts_at);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exclude_active_counselor_overlap') then
    alter table counseling_appointments add constraint exclude_active_counselor_overlap
      exclude using gist (counselor_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
      where (status in ('confirmed','rescheduled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exclude_active_student_overlap') then
    alter table counseling_appointments add constraint exclude_active_student_overlap
      exclude using gist (student_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
      where (status in ('confirmed','rescheduled'));
  end if;
end $$;

create table if not exists counseling_appointment_events (
  appointment_event_id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references counseling_appointments(appointment_id) on delete cascade,
  event_type varchar(20) not null
    check (event_type in ('assigned','confirmed','rescheduled','cancelled','completed','no_show')),
  actor_user_id uuid not null references users(user_id) on delete restrict,
  previous_values jsonb not null default '{}',
  new_values jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_appointment_events_history
  on counseling_appointment_events(appointment_id, created_at desc);

create table if not exists counseling_admin_notes (
  admin_note_id uuid primary key default gen_random_uuid(),
  counseling_request_id uuid references counseling_requests(counseling_request_id) on delete cascade,
  appointment_id uuid references counseling_appointments(appointment_id) on delete cascade,
  author_admin_id uuid not null references users(user_id) on delete restrict,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((counseling_request_id is not null) <> (appointment_id is not null))
);
create index if not exists idx_admin_notes_request on counseling_admin_notes(counseling_request_id, created_at desc);
create index if not exists idx_admin_notes_appointment on counseling_admin_notes(appointment_id, created_at desc);

create table if not exists report_export_audits (
  report_export_audit_id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references users(user_id) on delete restrict,
  report_mode varchar(20) not null check (report_mode in ('aggregate','confidential')),
  faculty_id uuid references faculties(faculty_id) on delete restrict,
  academic_unit_id uuid references academic_units(academic_unit_id) on delete restrict,
  date_from date not null,
  date_to date not null,
  exported_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists idx_report_audits_admin on report_export_audits(admin_user_id, exported_at desc);

-- Updated-at triggers are additive and repeatable.
do $$
declare table_name text;
begin
  foreach table_name in array array['faculties','academic_units','student_academic_profiles',
    'counselor_profiles','counselor_availability_rules','counseling_requests',
    'counseling_appointments','counseling_admin_notes']
  loop
    if not exists (select 1 from pg_trigger where tgname=table_name || '_updated_at') then
      execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
        table_name || '_updated_at', table_name);
    end if;
  end loop;
end $$;

-- RLS: reference reads are authenticated; all writes are administrator-only.
alter table faculties enable row level security;
alter table academic_units enable row level security;
alter table student_academic_profiles enable row level security;
alter table admin_notifications enable row level security;
alter table counselor_profiles enable row level security;
alter table counselor_availability_rules enable row level security;
alter table counselor_blocked_periods enable row level security;
alter table counseling_requests enable row level security;
alter table counseling_appointments enable row level security;
alter table counseling_appointment_events enable row level security;
alter table counseling_admin_notes enable row level security;
alter table report_export_audits enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='faculties' and policyname='authenticated_read_faculties') then
    create policy "authenticated_read_faculties" on faculties for select using (app_user_id() is not null);
    create policy "admin_manage_faculties" on faculties for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "authenticated_read_academic_units" on academic_units for select using (app_user_id() is not null);
    create policy "admin_manage_academic_units" on academic_units for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "student_read_own_academic_profile" on student_academic_profiles for select using (user_id=app_user_id());
    create policy "admin_manage_academic_profiles" on student_academic_profiles for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "admin_own_notifications" on admin_notifications for all using (admin_user_id=app_user_id() and current_user_role()='admin') with check (admin_user_id=app_user_id() and current_user_role()='admin');
    create policy "authenticated_read_counselor_profiles" on counselor_profiles for select using (app_user_id() is not null);
    create policy "admin_manage_counselor_profiles" on counselor_profiles for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "admin_manage_availability" on counselor_availability_rules for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "counselor_read_own_availability" on counselor_availability_rules for select using (counselor_id=app_user_id());
    create policy "admin_manage_blocked_periods" on counselor_blocked_periods for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "counselor_read_own_blocks" on counselor_blocked_periods for select using (counselor_id=app_user_id());
    create policy "student_read_own_requests" on counseling_requests for select using (student_id=app_user_id());
    create policy "student_create_own_requests" on counseling_requests for insert with check (student_id=app_user_id());
    create policy "admin_manage_requests" on counseling_requests for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "appointment_participant_read" on counseling_appointments for select using (student_id=app_user_id() or counselor_id=app_user_id());
    create policy "admin_manage_appointments" on counseling_appointments for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "appointment_participant_events_read" on counseling_appointment_events for select using (
      exists (select 1 from counseling_appointments a where a.appointment_id=counseling_appointment_events.appointment_id and (a.student_id=app_user_id() or a.counselor_id=app_user_id())));
    create policy "admin_manage_appointment_events" on counseling_appointment_events for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "admin_manage_notes" on counseling_admin_notes for all using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "admin_manage_report_audits" on report_export_audits for all using (current_user_role()='admin') with check (current_user_role()='admin');
  end if;
end $$;

-- Deterministic official faculty seed. Units are explicitly typed as study_program;
-- no Program Studi is mislabeled as a department.
insert into faculties (faculty_id, code, name, source_url) values
 ('10000000-0000-4000-8000-000000000001','FH','Fakultas Hukum','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000002','FEB','Fakultas Ekonomika dan Bisnis','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000003','FT','Fakultas Teknik','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000004','FK','Fakultas Kedokteran','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000005','FPP','Fakultas Peternakan dan Pertanian','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000006','FIB','Fakultas Ilmu Budaya','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000007','FISIP','Fakultas Ilmu Sosial dan Ilmu Politik','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000008','FSM','Fakultas Sains dan Matematika','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000009','FKM','Fakultas Kesehatan Masyarakat','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000010','FPIK','Fakultas Perikanan dan Ilmu Kelautan','https://undip.ac.id/program-sarjana-2'),
 ('10000000-0000-4000-8000-000000000011','FPSI','Fakultas Psikologi','https://undip.ac.id/program-sarjana-2')
on conflict (faculty_id) do update set name=excluded.name, code=excluded.code, source_url=excluded.source_url;

-- All 53 S1 programs listed on the official page are seeded and can be
-- appended without changing identity or inventing department mappings.
insert into academic_units (academic_unit_id, faculty_id, name, unit_type, degree_level, source_url) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Hukum','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Akuntansi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Ilmu Ekonomi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','Manajemen','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Ekonomi Islam','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','Bisnis Digital','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000006','Sastra Inggris','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000006','Sastra Indonesia','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000006','Sejarah','study_program','S1','https://undip.ac.id/program-sarjana-2')
on conflict (academic_unit_id) do update set name=excluded.name, source_url=excluded.source_url;


-- Persistent notifications are created server-side with minimum metadata only.
create or replace function notify_iteration3_admins()
returns trigger language plpgsql security definer set search_path=public as $$
declare category_name text; title_text text; context_text text; entity_name text; entity_uuid uuid; path_text text; key_text text;
begin
  if tg_table_name='assessments' then
    if new.severity not in ('moderate','severe') then return new; end if;
    category_name:='assessment'; title_text:='Asesmen stres memerlukan perhatian'; context_text:='Sinyal asesmen tercatat untuk peninjauan';
    entity_name:='assessment'; entity_uuid:=new.assessment_id; path_text:='/attention'; key_text:='assessment:'||new.assessment_id;
  elsif tg_table_name='guardrail_logs' then
    if new.source='assessment' or new.assessment_id is not null then return new; end if;
    category_name:='safety'; title_text:='Sinyal Safety Guardrail memerlukan tinjauan'; context_text:='Tinjau sinyal keselamatan tanpa membuka isi percakapan';
    entity_name:='guardrail_log'; entity_uuid:=new.log_id; path_text:='/attention'; key_text:='safety:'||new.log_id;
  elsif tg_table_name='counseling_requests' then
    category_name:='counseling'; title_text:='Permintaan konseling baru'; context_text:='Memerlukan peninjauan administrator';
    entity_name:='counseling_request'; entity_uuid:=new.counseling_request_id; path_text:='/schedule'; key_text:='request:'||new.counseling_request_id;
  elsif tg_table_name='booking_konsultasi' and tg_op='INSERT' then
    category_name:='counseling'; title_text:='Booking memerlukan tindakan'; context_text:='Booking baru menunggu konfirmasi';
    entity_name:='legacy_booking'; entity_uuid:=new.booking_id; path_text:='/schedule'; key_text:='booking:'||new.booking_id;
  elsif tg_table_name='booking_konsultasi' and new.status='dibatalkan' and old.status<>'dibatalkan' then
    category_name:='schedule'; title_text:='Booking dibatalkan'; context_text:='Jadwal konseling perlu ditinjau kembali';
    entity_name:='legacy_booking'; entity_uuid:=new.booking_id; path_text:='/schedule'; key_text:='booking-cancelled:'||new.booking_id;
  else return new;
  end if;
  insert into admin_notifications(admin_user_id,category,title,context,entity_type,entity_id,target_path,dedupe_key)
  select user_id,category_name,title_text,context_text,entity_name,entity_uuid,path_text,key_text from users where role='admin'
  on conflict(admin_user_id,dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;

do $$
begin
  if not exists(select 1 from pg_trigger where tgname='iteration3_assessment_notification') then
    create trigger iteration3_assessment_notification after insert on assessments for each row execute function notify_iteration3_admins();
  end if;
  if not exists(select 1 from pg_trigger where tgname='iteration3_guardrail_notification') then
    create trigger iteration3_guardrail_notification after insert on guardrail_logs for each row execute function notify_iteration3_admins();
  end if;
  if not exists(select 1 from pg_trigger where tgname='iteration3_counseling_request_notification') then
    create trigger iteration3_counseling_request_notification after insert on counseling_requests for each row execute function notify_iteration3_admins();
  end if;
  if not exists(select 1 from pg_trigger where tgname='iteration3_booking_created_notification') then
    create trigger iteration3_booking_created_notification after insert on booking_konsultasi for each row execute function notify_iteration3_admins();
  end if;
  if not exists(select 1 from pg_trigger where tgname='iteration3_booking_cancelled_notification') then
    create trigger iteration3_booking_cancelled_notification after update on booking_konsultasi for each row execute function notify_iteration3_admins();
  end if;
end $$;


-- Remaining official S1 programs from the same source (53 total across 11 faculties).
insert into academic_units (academic_unit_id, faculty_id, name, unit_type, degree_level, source_url) values
 ('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003','Teknik Sipil','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000003','Arsitektur','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000003','Teknik Mesin','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000003','Teknik Kimia','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000003','Teknik Elektro','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000003','Perencanaan Wilayah dan Kota','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000003','Teknik Industri','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000003','Teknik Lingkungan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000003','Teknik Perkapalan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000003','Teknik Geologi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000003','Teknik Geodesi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000003','Teknik Komputer','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000004','Kedokteran','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000004','Keperawatan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000004','Gizi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000004','Farmasi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000004','Kedokteran Gigi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000027','10000000-0000-4000-8000-000000000005','Peternakan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000005','Agribisnis','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000029','10000000-0000-4000-8000-000000000005','Agroekoteknologi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000005','Teknologi Pangan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000006','Ilmu Perpustakaan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000006','Bahasa dan Kebudayaan Jepang','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000006','Antropologi Sosial','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000007','Administrasi Publik','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000007','Administrasi Bisnis','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000007','Ilmu Pemerintahan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000037','10000000-0000-4000-8000-000000000007','Ilmu Komunikasi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000038','10000000-0000-4000-8000-000000000007','Hubungan Internasional','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000039','10000000-0000-4000-8000-000000000008','Matematika','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000008','Biologi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000008','Kimia','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000042','10000000-0000-4000-8000-000000000008','Fisika','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000043','10000000-0000-4000-8000-000000000008','Statistika','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000044','10000000-0000-4000-8000-000000000008','Informatika','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000045','10000000-0000-4000-8000-000000000008','Bioteknologi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000046','10000000-0000-4000-8000-000000000009','Kesehatan Masyarakat','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000047','10000000-0000-4000-8000-000000000010','Manajemen Sumberdaya Perairan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000048','10000000-0000-4000-8000-000000000010','Akuakultur','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000049','10000000-0000-4000-8000-000000000010','Perikanan Tangkap','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000010','Ilmu Kelautan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000010','Oseanografi','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000010','Teknologi Hasil Perikanan','study_program','S1','https://undip.ac.id/program-sarjana-2'),
 ('20000000-0000-4000-8000-000000000053','10000000-0000-4000-8000-000000000011','Psikologi','study_program','S1','https://undip.ac.id/program-sarjana-2')
on conflict (academic_unit_id) do update set name=excluded.name, source_url=excluded.source_url;

grant select, insert, update, delete on faculties, academic_units, student_academic_profiles,
  admin_notifications, counselor_profiles, counselor_availability_rules,
  counselor_blocked_periods, counseling_requests, counseling_appointments,
  counseling_appointment_events, counseling_admin_notes, report_export_audits to sajiwa_app;

insert into schema_migrations(version) values ('001_iteration3c') on conflict do nothing;
commit;
