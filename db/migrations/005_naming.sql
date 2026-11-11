-- Naming consistency pass: legacy tables/columns and enum values brought to the convention
-- (see docs/postgresql-conventions.md). API route paths keep their names; only schema
-- identifiers and the JSON keys derived from them change.
--
-- db/init stays frozen as the baseline and migrations 001-004 keep their historical names;
-- this migration converges both paths — a database created before the rename and a fresh one
-- (init + 001..004 still run with the old names). Every step is guarded, so re-runs are no-ops.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

-- ── tables ───────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.hotline') is not null then
    execute 'alter table hotline rename to hotlines';
  end if;
  if to_regclass('public.jadwal_konsultasi') is not null then
    execute 'alter table jadwal_konsultasi rename to counseling_slots';
  end if;
  if to_regclass('public.booking_konsultasi') is not null then
    execute 'alter table booking_konsultasi rename to counseling_bookings';
  end if;
end
$$;

-- ── columns (FK columns follow their PKs) ────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select * from (values
      ('users',                             'nama',                'name'),
      ('hotlines',                          'nama',                'name'),
      ('hotlines',                          'nomor',               'phone'),
      ('hotlines',                          'deskripsi',           'description'),
      ('counseling_slots',                  'jadwal_id',           'counseling_slot_id'),
      ('counseling_slots',                  'konselor_id',         'counselor_id'),
      ('counseling_slots',                  'tanggal',             'date'),
      ('counseling_slots',                  'waktu_mulai',         'start_time'),
      ('counseling_slots',                  'waktu_selesai',       'end_time'),
      ('counseling_bookings',               'booking_id',          'counseling_booking_id'),
      ('counseling_bookings',               'jadwal_id',           'counseling_slot_id'),
      ('counseling_bookings',               'user_id',             'student_id'),
      ('counseling_bookings',               'catatan',             'notes'),
      ('counseling_appointments',           'appointment_id',      'counseling_appointment_id'),
      ('counseling_appointments',           'legacy_booking_id',   'legacy_counseling_booking_id'),
      ('counseling_appointments',           'resource_id',         'counseling_resource_id'),
      ('counseling_appointment_events',     'appointment_id',      'counseling_appointment_id'),
      ('counseling_admin_notes',            'admin_note_id',       'counseling_admin_note_id'),
      ('counseling_admin_notes',            'appointment_id',      'counseling_appointment_id'),
      ('counseling_admin_notes',            'author_admin_id',     'author_user_id'),
      ('counseling_resources',              'resource_id',         'counseling_resource_id'),
      ('counseling_resource_blocks',        'resource_block_id',   'counseling_resource_block_id'),
      ('counseling_resource_blocks',        'resource_id',         'counseling_resource_id'),
      ('counselor_availability_rules',      'availability_rule_id','counselor_availability_rule_id'),
      ('counselor_blocked_periods',         'blocked_period_id',   'counselor_blocked_period_id'),
      ('assessment_version_reviews',        'review_id',           'assessment_version_review_id'),
      ('assessment_version_reviews',        'reviewer_counselor_id','reviewer_user_id'),
      ('assessment_review_comments',        'review_id',           'assessment_version_review_id'),
      ('assessment_dimensions',             'dimension_id',        'assessment_dimension_id'),
      ('assessment_questions',              'dimension_id',        'assessment_dimension_id'),
      ('admin_notifications',               'notification_id',     'admin_notification_id'),
      ('guardrail_logs',                    'log_id',              'guardrail_log_id'),
      ('student_support_profiles',          'student_id',          'user_id')
    ) as t(tbl, old_name, new_name)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.old_name
    ) then
      execute format('alter table %I rename column %I to %I', r.tbl, r.old_name, r.new_name);
    end if;
  end loop;
end
$$;

-- ── enum values (data + constraints) ─────────────────────────────────────────
alter table journals drop constraint if exists journals_mood_check;
update journals set mood = lower(mood)
  where mood in ('Calm', 'Anxious', 'Focused', 'Tired');
alter table journals add constraint journals_mood_check
  check (mood in ('calm', 'anxious', 'focused', 'tired'));

alter table counseling_slots drop constraint if exists jadwal_konsultasi_status_check;
update counseling_slots set status = case status
    when 'tersedia' then 'available'
    when 'dipesan' then 'booked'
    when 'selesai' then 'completed'
    when 'dibatalkan' then 'cancelled'
    else status
  end
  where status in ('tersedia', 'dipesan', 'selesai', 'dibatalkan');
alter table counseling_slots drop constraint if exists counseling_slots_status_check;
alter table counseling_slots add constraint counseling_slots_status_check
  check (status in ('available', 'booked', 'completed', 'cancelled'));

alter table counseling_bookings drop constraint if exists booking_konsultasi_status_check;
update counseling_bookings set status = case status
    when 'menunggu' then 'pending'
    when 'dikonfirmasi' then 'confirmed'
    when 'selesai' then 'completed'
    when 'dibatalkan' then 'cancelled'
    else status
  end
  where status in ('menunggu', 'dikonfirmasi', 'selesai', 'dibatalkan');
alter table counseling_bookings drop constraint if exists counseling_bookings_status_check;
alter table counseling_bookings add constraint counseling_bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled'));

-- Value literals hide in column defaults and policy expressions (renames track attnums,
-- not values).
alter table counseling_slots alter column status set default 'available';
alter table counseling_bookings alter column status set default 'pending';
drop policy if exists mahasiswa_view_tersedia_jadwal on counseling_slots;
create policy mahasiswa_view_tersedia_jadwal on counseling_slots
  for select using (status = 'available');

-- ── function bodies naming renamed columns ───────────────────────────────────
-- Policies, triggers and check constraints track renames automatically (attnum based);
-- only function *text* needs replacing. Names and signatures stay, so dependent
-- policies (has_booking_for) and grants keep working.
create or replace function has_booking_for(p_jadwal_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from counseling_bookings b
    where b.counseling_slot_id = p_jadwal_id and b.student_id = app_user_id()
  );
$$;

create or replace function mark_jadwal_dipesan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update counseling_slots set status = 'booked'
    where counseling_slot_id = new.counseling_slot_id;
  return new;
end;
$$;

create or replace function restore_jadwal_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    update counseling_slots set status = 'available'
      where counseling_slot_id = new.counseling_slot_id;
  end if;
  return new;
end;
$$;

-- 001's dispatcher references renamed fields and old enum values in its body text.
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
    entity_name:='guardrail_log'; entity_uuid:=new.guardrail_log_id; path_text:='/attention'; key_text:='safety:'||new.guardrail_log_id;
  elsif tg_table_name='counseling_requests' then
    category_name:='counseling'; title_text:='Permintaan konseling baru'; context_text:='Memerlukan peninjauan administrator';
    entity_name:='counseling_request'; entity_uuid:=new.counseling_request_id; path_text:='/schedule'; key_text:='request:'||new.counseling_request_id;
  elsif tg_table_name='counseling_bookings' and tg_op='INSERT' then
    category_name:='counseling'; title_text:='Booking memerlukan tindakan'; context_text:='Booking baru menunggu konfirmasi';
    entity_name:='legacy_booking'; entity_uuid:=new.counseling_booking_id; path_text:='/schedule'; key_text:='booking:'||new.counseling_booking_id;
  elsif tg_table_name='counseling_bookings' and new.status='cancelled' and old.status<>'cancelled' then
    category_name:='schedule'; title_text:='Booking dibatalkan'; context_text:='Jadwal konseling perlu ditinjau kembali';
    entity_name:='legacy_booking'; entity_uuid:=new.counseling_booking_id; path_text:='/schedule'; key_text:='booking-cancelled:'||new.counseling_booking_id;
  else return new;
  end if;
  insert into admin_notifications(admin_user_id,category,title,context,entity_type,entity_id,target_path,dedupe_key)
  select user_id,category_name,title_text,context_text,entity_name,entity_uuid,path_text,key_text from users where role='admin'
  on conflict(admin_user_id,dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;

-- Out-column `name` is part of the signature: replace needs drop + create + re-grant.
drop function if exists auth_lookup(varchar);
create function auth_lookup(p_email varchar)
returns table (
  user_id       uuid,
  email         varchar,
  name          varchar,
  nim           varchar,
  role          varchar,
  password_hash text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.user_id, u.email, u.name, u.nim, u.role, u.password_hash
  from users u
  where u.email = p_email;
$$;
grant execute on function auth_lookup(varchar) to sajiwa_app;

drop function if exists list_konselor();
create function list_konselor()
returns table (user_id uuid, name varchar, role varchar)
language sql
security definer
set search_path = public
stable
as $$
  select u.user_id, u.name, u.role from users u where u.role = 'konselor' order by u.name;
$$;
grant execute on function list_konselor() to sajiwa_app;

insert into schema_migrations(version) values ('005_naming') on conflict(version) do nothing;

commit;
