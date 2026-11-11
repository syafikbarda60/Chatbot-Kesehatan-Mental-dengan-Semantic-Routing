-- Iteration 4: additive, versioned assessment instruments.
-- Existing assessment rows remain valid and retain their stored score/severity.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

create table if not exists assessment_instruments (
  instrument_id uuid primary key default gen_random_uuid(),
  code varchar(40) not null,
  name varchar(160) not null,
  description text,
  active boolean not null default true,
  created_by uuid references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references users(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_assessment_instruments_code_ci
  on assessment_instruments(lower(code));

create table if not exists assessment_instrument_versions (
  instrument_version_id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references assessment_instruments(instrument_id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status varchar(20) not null default 'draft' check (status in ('draft','published','archived')),
  expected_question_count integer not null default 21 check (expected_question_count > 0),
  authoritative_config boolean not null default false,
  scoring_config jsonb,
  created_by uuid references users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references users(user_id) on delete restrict,
  updated_at timestamptz not null default now(),
  published_by uuid references users(user_id) on delete restrict,
  published_at timestamptz,
  unique (instrument_id, version_number),
  check ((status = 'published' and published_at is not null and published_by is not null) or status <> 'published')
);
create unique index if not exists uq_one_published_instrument_version
  on assessment_instrument_versions(instrument_id) where status = 'published';

create table if not exists assessment_questions (
  assessment_question_id uuid primary key default gen_random_uuid(),
  instrument_version_id uuid not null references assessment_instrument_versions(instrument_version_id) on delete cascade,
  item_key varchar(60) not null,
  category varchar(20) not null check (category in ('depression','anxiety','stress')),
  position integer not null check (position > 0),
  wording text not null check (length(btrim(wording)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument_version_id, item_key),
  unique (instrument_version_id, position)
);
create index if not exists idx_assessment_questions_version_category
  on assessment_questions(instrument_version_id, category, position);

create table if not exists assessment_answer_options (
  assessment_answer_option_id uuid primary key default gen_random_uuid(),
  assessment_question_id uuid not null references assessment_questions(assessment_question_id) on delete cascade,
  position integer not null check (position >= 0),
  label text not null check (length(btrim(label)) > 0),
  score integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_question_id, position)
);

alter table assessments
  add column if not exists instrument_version_id uuid
    references assessment_instrument_versions(instrument_version_id) on delete restrict;
create index if not exists idx_assessments_instrument_version
  on assessments(instrument_version_id) where instrument_version_id is not null;

create table if not exists assessment_category_results (
  assessment_category_result_id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(assessment_id) on delete cascade,
  instrument_version_id uuid not null references assessment_instrument_versions(instrument_version_id) on delete restrict,
  category varchar(20) not null check (category in ('depression','anxiety','stress')),
  raw_score integer not null,
  scaled_score numeric,
  severity varchar(40),
  created_at timestamptz not null default now(),
  unique (assessment_id, category)
);
create index if not exists idx_assessment_category_results_version
  on assessment_category_results(instrument_version_id, category);

alter table report_export_audits
  add column if not exists scope jsonb not null default '{"faculty_ids":[],"academic_unit_ids":[]}'::jsonb;

create or replace function reject_published_assessment_definition_change()
returns trigger language plpgsql as $$
declare
  version_status varchar(20);
begin
  if tg_table_name = 'assessment_instrument_versions' then
    if old.status in ('published','archived') then
      if tg_op = 'DELETE' then
        raise exception 'Published assessment versions cannot be deleted';
      end if;
      if not (old.status = 'published' and new.status = 'archived'
        and new.instrument_version_id = old.instrument_version_id
        and new.instrument_id = old.instrument_id
        and new.version_number = old.version_number
        and new.expected_question_count = old.expected_question_count
        and new.authoritative_config = old.authoritative_config
        and new.scoring_config is not distinct from old.scoring_config
        and new.created_by is not distinct from old.created_by
        and new.created_at = old.created_at
        and new.published_by is not distinct from old.published_by
        and new.published_at is not distinct from old.published_at) then
        raise exception 'Published assessment versions are immutable';
      end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select v.status into version_status
  from assessment_instrument_versions v
  where v.instrument_version_id = coalesce(new.instrument_version_id, old.instrument_version_id);
  if version_status in ('published','archived') then
    raise exception 'Questions and options in published assessment versions are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists assessment_version_immutable on assessment_instrument_versions;
create trigger assessment_version_immutable
  before update or delete on assessment_instrument_versions
  for each row execute function reject_published_assessment_definition_change();

drop trigger if exists assessment_question_immutable on assessment_questions;
create trigger assessment_question_immutable
  before insert or update or delete on assessment_questions
  for each row execute function reject_published_assessment_definition_change();

create or replace function reject_published_assessment_option_change()
returns trigger language plpgsql as $$
declare
  version_status varchar(20);
begin
  select v.status into version_status
  from assessment_questions q
  join assessment_instrument_versions v on v.instrument_version_id = q.instrument_version_id
  where q.assessment_question_id = coalesce(new.assessment_question_id, old.assessment_question_id);
  if version_status in ('published','archived') then
    raise exception 'Options in published assessment versions are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists assessment_option_immutable on assessment_answer_options;
create trigger assessment_option_immutable
  before insert or update or delete on assessment_answer_options
  for each row execute function reject_published_assessment_option_change();

alter table assessment_instruments enable row level security;
alter table assessment_instrument_versions enable row level security;
alter table assessment_questions enable row level security;
alter table assessment_answer_options enable row level security;
alter table assessment_category_results enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='assessment_instruments' and policyname='admin_manage_assessment_instruments') then
    create policy "admin_manage_assessment_instruments" on assessment_instruments for all
      using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "authorized_read_assessment_instruments" on assessment_instruments for select
      using (active and current_user_role() in ('mahasiswa','konselor','pemangku_jabatan'));
    create policy "admin_manage_assessment_versions" on assessment_instrument_versions for all
      using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "authorized_read_published_assessment_versions" on assessment_instrument_versions for select
      using (status='published' and current_user_role() in ('mahasiswa','konselor','pemangku_jabatan'));
    create policy "admin_manage_assessment_questions" on assessment_questions for all
      using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "authorized_read_published_assessment_questions" on assessment_questions for select
      using (exists (select 1 from assessment_instrument_versions v where v.instrument_version_id=assessment_questions.instrument_version_id and v.status='published')
        and current_user_role() in ('mahasiswa','konselor','pemangku_jabatan'));
    create policy "admin_manage_assessment_options" on assessment_answer_options for all
      using (current_user_role()='admin') with check (current_user_role()='admin');
    create policy "authorized_read_published_assessment_options" on assessment_answer_options for select
      using (exists (select 1 from assessment_questions q join assessment_instrument_versions v on v.instrument_version_id=q.instrument_version_id where q.assessment_question_id=assessment_answer_options.assessment_question_id and v.status='published')
        and current_user_role() in ('mahasiswa','konselor','pemangku_jabatan'));
    create policy "student_read_own_category_results" on assessment_category_results for select
      using (exists (select 1 from assessments a where a.assessment_id=assessment_category_results.assessment_id and a.user_id=app_user_id()));
    create policy "authorized_read_category_results" on assessment_category_results for select
      using (current_user_role() in ('konselor','admin','pemangku_jabatan'));
    create policy "student_insert_own_category_results" on assessment_category_results for insert
      with check (exists (select 1 from assessments a join assessment_instrument_versions v on v.instrument_version_id=a.instrument_version_id
        where a.assessment_id=assessment_category_results.assessment_id and a.user_id=app_user_id()
          and a.instrument_version_id=assessment_category_results.instrument_version_id and v.status='published'));
  end if;
end $$;

insert into assessment_instruments(code,name,description)
values('DASS-21','DASS-21','Instrumen Depression, Anxiety, and Stress Scales — 21 items')
on conflict do nothing;

insert into assessment_instrument_versions(instrument_id,version_number,status,expected_question_count,authoritative_config)
select instrument_id,1,'draft',21,false from assessment_instruments where lower(code)='dass-21'
on conflict(instrument_id,version_number) do nothing;

insert into schema_migrations(version) values('002_iteration4') on conflict(version) do nothing;

grant select,insert,update,delete on
  assessment_instruments, assessment_instrument_versions, assessment_questions,
  assessment_answer_options, assessment_category_results to sajiwa_app;

commit;
