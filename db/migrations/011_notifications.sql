-- Iteration 4.7 (after 010_dass21_variants): notifications for students and counselors, and the
-- counselor-exception alerts admins were missing.
--
-- Admins keep admin_notifications (001). Everyone else gets `notifications`, one row per
-- recipient, written only by the triggers below (security definer), read and marked read by
-- its owner through RLS. What is announced:
--
--   student    session scheduled, moved, counselor changed, cancelled; request cancelled
--   counselor  session assigned, moved, taken over by someone else, cancelled;
--              their exception request approved or rejected
--   admin      a counselor asks for an exception (added to the existing alert set)
--
-- Nobody is told about their own action (app_user_id() is the actor). Dedupe keys make a
-- retried statement announce once. Bodies hold times and names only, never clinical detail.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create table if not exists notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  category varchar(20) not null check (category in ('counseling','schedule','system')),
  title varchar(160) not null,
  body varchar(300),
  target_path varchar(300),
  entity_type varchar(40),
  entity_id uuid,
  dedupe_key varchar(200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_notifications_dedupe
  on notifications(user_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);

alter table notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='own_read_notifications') then
    create policy own_read_notifications on notifications for select using (user_id = app_user_id());
    create policy own_mark_notifications on notifications for update
      using (user_id = app_user_id()) with check (user_id = app_user_id());
  end if;
end $$;
grant select on notifications to sajiwa_app;
grant update (read_at) on notifications to sajiwa_app;

-- "Jumat, 31 Okt 2026, 10.00 WIB": what a student reads, in the campus time zone
create or replace function fmt_wib(ts timestamptz) returns text language sql stable as $$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from ts at time zone 'Asia/Jakarta')::int + 1]
    || ', ' || to_char(ts at time zone 'Asia/Jakarta', 'FMDD') || ' '
    || (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from ts at time zone 'Asia/Jakarta')::int]
    || ' ' || to_char(ts at time zone 'Asia/Jakarta', 'YYYY, HH24.MI') || ' WIB';
$$;

-- When a counselor will be away: one day, whole or in part
create or replace function fmt_wib_span(starts timestamptz, ends timestamptz, whole_day boolean) returns text language sql stable as $$
  select regexp_replace(fmt_wib(starts), ', [0-9.]+ WIB$', '')
    || case when whole_day then ' (seharian)'
            else ', ' || to_char(starts at time zone 'Asia/Jakarta', 'HH24.MI') || '–' || to_char(ends at time zone 'Asia/Jakarta', 'HH24.MI') || ' WIB' end;
$$;

create or replace function push_notification(recipient uuid, category_name text, title_text text, body_text text,
  path_text text, entity_name text, entity_uuid uuid, key_text text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if recipient is null or recipient = app_user_id() then return; end if;
  insert into notifications(user_id,category,title,body,target_path,entity_type,entity_id,dedupe_key)
  values (recipient, category_name, title_text, left(body_text, 300), path_text, entity_name, entity_uuid, key_text)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function notify_appointment_participants()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  student_name text; counselor_name text; old_counselor_name text; id_text text := new.counseling_appointment_id::text;
  live boolean := new.status in ('confirmed','rescheduled');
begin
  select coalesce(left(name,80),'mahasiswa') into student_name from users where user_id=new.student_id;
  select coalesce(left(name,80),'konselor') into counselor_name from users where user_id=new.counselor_id;

  if tg_op = 'INSERT' then
    if not live then return new; end if;
    perform push_notification(new.student_id, 'counseling', 'Sesi konseling dijadwalkan',
      fmt_wib(new.starts_at) || ' bersama ' || counselor_name, '/schedule', 'appointment', new.counseling_appointment_id, 'appt-created:' || id_text);
    perform push_notification(new.counselor_id, 'counseling', 'Sesi konseling baru',
      fmt_wib(new.starts_at) || ' bersama ' || student_name, '/counselor/schedule', 'appointment', new.counseling_appointment_id, 'appt-created:' || id_text);
    return new;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform push_notification(new.student_id, 'counseling', 'Sesi konseling dibatalkan',
      fmt_wib(old.starts_at) || ' bersama ' || counselor_name, '/schedule', 'appointment', new.counseling_appointment_id, 'appt-cancelled:' || id_text);
    perform push_notification(old.counselor_id, 'counseling', 'Sesi konseling dibatalkan',
      fmt_wib(old.starts_at) || ' bersama ' || student_name, '/counselor/schedule', 'appointment', new.counseling_appointment_id, 'appt-cancelled:' || id_text);
    return new;
  end if;
  if not live then return new; end if;

  if new.counselor_id <> old.counselor_id then
    select coalesce(left(name,80),'konselor') into old_counselor_name from users where user_id=old.counselor_id;
    perform push_notification(new.student_id, 'counseling', 'Konselor sesimu berganti',
      fmt_wib(new.starts_at) || ' bersama ' || counselor_name, '/schedule', 'appointment', new.counseling_appointment_id,
      'appt-counselor:' || id_text || ':' || new.counselor_id);
    perform push_notification(new.counselor_id, 'counseling', 'Sesi konseling baru',
      fmt_wib(new.starts_at) || ' bersama ' || student_name, '/counselor/schedule', 'appointment', new.counseling_appointment_id,
      'appt-assigned:' || id_text || ':' || new.counselor_id);
    perform push_notification(old.counselor_id, 'counseling', 'Sesi dialihkan ke konselor lain',
      fmt_wib(old.starts_at) || ' bersama ' || student_name, '/counselor/schedule', 'appointment', new.counseling_appointment_id,
      'appt-unassigned:' || id_text || ':' || old.counselor_id);
  elsif new.starts_at <> old.starts_at then
    perform push_notification(new.student_id, 'counseling', 'Jadwal sesi konseling diubah',
      'Sekarang ' || fmt_wib(new.starts_at) || ' bersama ' || counselor_name, '/schedule', 'appointment', new.counseling_appointment_id,
      'appt-moved:' || id_text || ':' || extract(epoch from new.starts_at)::bigint);
    perform push_notification(new.counselor_id, 'counseling', 'Jadwal sesi konseling diubah',
      'Sekarang ' || fmt_wib(new.starts_at) || ' bersama ' || student_name, '/counselor/schedule', 'appointment', new.counseling_appointment_id,
      'appt-moved:' || id_text || ':' || extract(epoch from new.starts_at)::bigint);
  end if;
  return new;
end $$;

drop trigger if exists counseling_appointments_notify_participants on counseling_appointments;
create trigger counseling_appointments_notify_participants
  after insert or update of status, starts_at, counselor_id on counseling_appointments
  for each row execute function notify_appointment_participants();

-- A request closed before any session existed; once a session exists its own notice covers it
create or replace function notify_request_cancelled()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled'
     and not exists (select 1 from counseling_appointments where counseling_request_id = new.counseling_request_id) then
    perform push_notification(new.student_id, 'counseling', 'Permintaan konseling dibatalkan',
      'Kamu bisa mengajukan permintaan baru kapan saja.', '/schedule', 'counseling_request', new.counseling_request_id,
      'request-cancelled:' || new.counseling_request_id);
  end if;
  return new;
end $$;

drop trigger if exists counseling_requests_notify_student on counseling_requests;
create trigger counseling_requests_notify_student
  after update of status on counseling_requests
  for each row execute function notify_request_cancelled();

create or replace function notify_exception_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare counselor_name text;
begin
  select coalesce(left(name,80),'Konselor') into counselor_name from users where user_id=new.counselor_id;
  if tg_op = 'INSERT' then
    insert into admin_notifications(admin_user_id,category,title,context,entity_type,entity_id,target_path,dedupe_key)
    select user_id, 'schedule', 'Pengajuan izin konselor',
      left(counselor_name || ': ' || fmt_wib_span(new.starts_at, new.ends_at, new.full_day)
        || case when cardinality(new.affected_appointment_ids) > 0
                then ' · ' || cardinality(new.affected_appointment_ids) || ' sesi terdampak' else '' end, 300),
      'counselor_exception_request', new.counselor_exception_request_id, '/counseling', 'exception:' || new.counselor_exception_request_id
    from users where role = 'admin'
    on conflict (admin_user_id, dedupe_key) where dedupe_key is not null do nothing;
  elsif old.status = 'pending' and new.status in ('approved','rejected') then
    perform push_notification(new.counselor_id, 'schedule',
      case new.status when 'approved' then 'Pengajuan izinmu disetujui' else 'Pengajuan izinmu ditolak' end,
      fmt_wib_span(new.starts_at, new.ends_at, new.full_day) || coalesce(' · ' || nullif(btrim(new.decision_note), ''), ''),
      '/counselor/availability', 'counselor_exception_request', new.counselor_exception_request_id,
      'exception-decided:' || new.counselor_exception_request_id);
  end if;
  return new;
end $$;

drop trigger if exists counselor_exception_requests_notify on counselor_exception_requests;
create trigger counselor_exception_requests_notify
  after insert or update of status on counselor_exception_requests
  for each row execute function notify_exception_request();

-- The dashboard's bell listens on the same change channel as the rest of the live view (009)
drop trigger if exists notifications_notify_dashboard on notifications;
create trigger notifications_notify_dashboard after insert or update or delete on notifications
  for each statement execute function notify_dashboard_change();
drop trigger if exists admin_notifications_notify_dashboard on admin_notifications;
create trigger admin_notifications_notify_dashboard after insert or update or delete on admin_notifications
  for each statement execute function notify_dashboard_change();

insert into schema_migrations(version) values ('011_notifications') on conflict(version) do nothing;
commit;
