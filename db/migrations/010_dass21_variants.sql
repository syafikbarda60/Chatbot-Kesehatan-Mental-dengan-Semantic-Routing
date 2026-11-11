-- Iteration 4.6 (after 009_realtime_notify): DASS-21 variants and the instrument the app shows.
--
-- A variant offers whole DASS-21 subscales (7, 14 or 21 items) with the validated wording and
-- the official norm per subscale, so its results and risk notifications mean what the full
-- instrument's do. Picking single items is deliberately impossible: the norms do not hold then.
--
-- shown_in_app marks the one instrument the mobile app asks students to fill in. The partial
-- unique index makes "one at a time" a database fact, not something the API has to remember.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

alter table assessment_instruments
  add column if not exists dass21_subscales text[],
  add column if not exists shown_in_app boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='assessment_instruments_dass21_subscales_check') then
    alter table assessment_instruments add constraint assessment_instruments_dass21_subscales_check
      check (dass21_subscales is null or (cardinality(dass21_subscales) between 1 and 3
        and dass21_subscales <@ array['depression','anxiety','stress']::text[]));
  end if;
end $$;

create unique index if not exists uq_assessment_instrument_shown_in_app
  on assessment_instruments((true)) where shown_in_app;

-- Until an admin picks another, students keep getting the full DASS-21 they had before.
update assessment_instruments set shown_in_app=true
where lower(code)='dass-21'
  and not exists (select 1 from assessment_instruments where shown_in_app);

insert into schema_migrations(version) values ('010_dass21_variants') on conflict(version) do nothing;
commit;
