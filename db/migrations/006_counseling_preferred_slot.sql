-- Iteration 4.2 (after 005_naming): the mobile app books counseling through the same request -> admin
-- assignment flow the dashboard runs, instead of the legacy counseling_slots/counseling_bookings tables.
-- A request can now carry the slot the student picked from the counselor's availability;
-- the admin confirms it (or assigns another time) from the dashboard queue.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

alter table counseling_requests
  add column if not exists preferred_counselor_id uuid references users(user_id) on delete set null,
  add column if not exists preferred_starts_at timestamptz,
  add column if not exists preferred_ends_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'counseling_requests_preferred_slot_check') then
    alter table counseling_requests add constraint counseling_requests_preferred_slot_check
      check ((preferred_starts_at is null) = (preferred_ends_at is null)
             and (preferred_starts_at is null or preferred_ends_at > preferred_starts_at));
  end if;
end $$;

-- Pending picks hold their slot, so the open-slot lookup below needs them by counselor/time.
create index if not exists idx_counseling_requests_preferred
  on counseling_requests(preferred_counselor_id, preferred_starts_at) where status = 'requested';

-- Bookable slots for one counselor, in fixed-length sessions, from now on.
--
-- SECURITY DEFINER because students cannot read availability rules, blocked periods or
-- other students' appointments (RLS), and must not: this returns only free start/end
-- pairs, never who holds a taken one. Same pattern as list_konselor().
--
-- A slot is open when it lies inside an active availability window (weekly rules and the
-- single-date ones the dashboard calendar creates alike, read in the rule's own timezone),
-- overlaps no blocked period, no active appointment, and no other student's pending pick.
-- The same conditions the admin's assign endpoint enforces, so an offered slot is one the
-- admin can actually confirm.
create or replace function counseling_open_slots(
  p_counselor uuid, p_from date, p_to date, p_minutes int default 60
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  with days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
    -- Bounded here too, since sajiwa_app can call this directly.
    where p_minutes between 15 and 240 and p_to - p_from between 0 and 92
  ),
  windows as (
    select (dd.day + r.start_time) at time zone r.timezone as w_start,
           (dd.day + r.end_time) at time zone r.timezone as w_end
    from days dd
    join counselor_availability_rules r
      on r.counselor_id = p_counselor
     and r.active
     and r.day_of_week = extract(dow from dd.day)::int
     and dd.day between coalesce(r.effective_from, '-infinity'::date) and coalesce(r.effective_to, 'infinity'::date)
    join users u on u.user_id = r.counselor_id and u.role = 'konselor'
    left join counselor_profiles cp on cp.user_id = u.user_id
    where coalesce(cp.active, true)
  ),
  slots as (
    select s as starts_at, s + make_interval(mins => p_minutes) as ends_at
    from windows w,
         generate_series(w.w_start, w.w_end - make_interval(mins => p_minutes), make_interval(mins => p_minutes)) s
  )
  select s.starts_at, s.ends_at
  from slots s
  where s.starts_at > now()
    and not exists (
      select 1 from counselor_blocked_periods b
      where b.counselor_id = p_counselor
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.starts_at, s.ends_at, '[)'))
    and not exists (
      select 1 from counseling_appointments a
      where a.counselor_id = p_counselor and a.status in ('confirmed', 'rescheduled')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(s.starts_at, s.ends_at, '[)'))
    and not exists (
      select 1 from counseling_requests q
      where q.preferred_counselor_id = p_counselor and q.status = 'requested'
        and tstzrange(q.preferred_starts_at, q.preferred_ends_at, '[)') && tstzrange(s.starts_at, s.ends_at, '[)'))
  order by s.starts_at;
$$;

grant execute on function counseling_open_slots(uuid, date, date, int) to sajiwa_app;

insert into schema_migrations(version) values ('006_counseling_preferred_slot') on conflict(version) do nothing;
commit;
