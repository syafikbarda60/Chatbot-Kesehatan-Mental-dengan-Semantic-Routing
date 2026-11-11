-- B1: additive backend enablement for custom instruments and operations.
begin;
select pg_advisory_xact_lock(hashtext('sajiwa_schema_migrations'));

-- sajiwa_app must already exist (created by db/init/02_auth.sql on fresh volumes).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sajiwa_app') then
    raise exception 'Canonical runtime role sajiwa_app must exist before migration 004';
  end if;
end
$$;

alter table assessment_instrument_versions add column if not exists definition_revision integer not null default 1 check (definition_revision > 0);
alter table assessment_questions drop constraint if exists assessment_questions_category_check;
alter table assessment_questions add constraint assessment_questions_category_check check (category ~ '^[a-z][a-z0-9_-]{0,59}$');

create table if not exists assessment_dimensions (
  dimension_id uuid primary key default gen_random_uuid(), instrument_version_id uuid not null references assessment_instrument_versions(instrument_version_id) on delete cascade,
  code varchar(60) not null check (code ~ '^[a-z][a-z0-9_-]{0,59}$'), name varchar(160) not null, description varchar(1000), position integer not null check (position > 0),
  multiplier numeric(10,4) not null default 1 check (multiplier > 0), interpretation_bands jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  unique (instrument_version_id, code), unique (instrument_version_id, position)
);
create index if not exists idx_assessment_dimensions_version on assessment_dimensions(instrument_version_id, position);
alter table assessment_questions add column if not exists dimension_id uuid references assessment_dimensions(dimension_id) on delete restrict;
create index if not exists idx_assessment_questions_dimension on assessment_questions(dimension_id);

create or replace function reject_locked_assessment_dimension_change()
returns trigger language plpgsql as $$
declare version_status varchar(20);
begin
  select status into version_status from assessment_instrument_versions where instrument_version_id=coalesce(new.instrument_version_id,old.instrument_version_id);
  if version_status in ('published','archived') then raise exception 'Dimensions in published assessment versions are immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists assessment_dimension_immutable on assessment_dimensions;
create trigger assessment_dimension_immutable before insert or update or delete on assessment_dimensions for each row execute function reject_locked_assessment_dimension_change();

create or replace function reject_locked_definition_revision_change()
returns trigger language plpgsql as $$
begin
  if old.status in ('published','archived') and new.definition_revision is distinct from old.definition_revision then
    raise exception 'Published assessment version revisions are immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists assessment_definition_revision_immutable on assessment_instrument_versions;
create trigger assessment_definition_revision_immutable before update on assessment_instrument_versions for each row execute function reject_locked_definition_revision_change();

create table if not exists assessment_version_reviews (
  review_id uuid primary key default gen_random_uuid(), instrument_version_id uuid not null references assessment_instrument_versions(instrument_version_id) on delete restrict,
  definition_revision integer not null check (definition_revision > 0), status varchar(24) not null check (status in ('pending','revision_requested','approved')),
  submitted_by uuid not null references users(user_id) on delete restrict, submitted_at timestamptz not null default now(), reviewer_counselor_id uuid references users(user_id) on delete restrict,
  decided_at timestamptz, decision_comment varchar(4000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_pending_assessment_review on assessment_version_reviews(instrument_version_id) where status='pending';
create index if not exists idx_assessment_reviews_queue on assessment_version_reviews(status, submitted_at);
create index if not exists idx_assessment_reviews_version on assessment_version_reviews(instrument_version_id, definition_revision desc);
create table if not exists assessment_review_comments (
  review_comment_id uuid primary key default gen_random_uuid(), review_id uuid not null references assessment_version_reviews(review_id) on delete cascade,
  assessment_question_id uuid references assessment_questions(assessment_question_id) on delete set null, author_user_id uuid not null references users(user_id) on delete restrict,
  comment_text varchar(4000) not null check (length(btrim(comment_text)) > 0), created_at timestamptz not null default now()
);
create index if not exists idx_assessment_review_comments on assessment_review_comments(review_id, created_at);

create table if not exists student_support_profiles (
  student_id uuid primary key references users(user_id) on delete cascade,
  mental_health_condition_state varchar(24) not null default 'unknown' check (mental_health_condition_state in ('none','present','unknown','prefer_not_to_say')),
  disability_state varchar(24) not null default 'unknown' check (disability_state in ('none','present','unknown','prefer_not_to_say')),
  condition_details varchar(1000), disability_details varchar(1000), updated_by uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists counseling_resources (
  resource_id uuid primary key default gen_random_uuid(), name varchar(160) not null, resource_type varchar(16) not null check (resource_type in ('physical','virtual')),
  capacity integer not null default 1 check (capacity > 0 and capacity <= 100), location_or_url varchar(500), active boolean not null default true,
  created_by uuid not null references users(user_id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_counseling_resources_name_ci on counseling_resources(lower(name));
create table if not exists counseling_resource_blocks (
  resource_block_id uuid primary key default gen_random_uuid(), resource_id uuid not null references counseling_resources(resource_id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, reason varchar(250), created_by uuid not null references users(user_id) on delete restrict,
  created_at timestamptz not null default now(), check (ends_at > starts_at)
);
create index if not exists idx_resource_blocks_range on counseling_resource_blocks using gist(resource_id, tstzrange(starts_at, ends_at, '[)'));
alter table counseling_appointments add column if not exists resource_id uuid references counseling_resources(resource_id) on delete restrict;
create index if not exists idx_appointments_resource_range on counseling_appointments using gist(resource_id, tstzrange(starts_at, ends_at, '[)')) where resource_id is not null and status in ('confirmed','rescheduled');

alter table hotline add column if not exists verification_status varchar(24) not null default 'verification_required' check (verification_status in ('active','verification_required','inactive'));
alter table hotline add column if not exists verified_at timestamptz;
alter table hotline add column if not exists verified_by uuid references users(user_id) on delete restrict;
alter table hotline add column if not exists verification_note varchar(1000);
alter table hotline add column if not exists updated_at timestamptz not null default now();
alter table hotline add column if not exists updated_by uuid references users(user_id) on delete restrict;
create index if not exists idx_hotline_verification on hotline(verification_status, updated_at desc);

alter table assessment_dimensions enable row level security;
alter table assessment_version_reviews enable row level security;
alter table assessment_review_comments enable row level security;
alter table student_support_profiles enable row level security;
alter table counseling_resources enable row level security;
alter table counseling_resource_blocks enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='assessment_dimensions' and policyname='admin_manage_dimensions') then
    create policy admin_manage_dimensions on assessment_dimensions for all using(current_user_role()='admin') with check(current_user_role()='admin');
    create policy authorized_read_published_dimensions on assessment_dimensions for select using(current_user_role() in ('mahasiswa','konselor','pemangku_jabatan') and exists(select 1 from assessment_instrument_versions v where v.instrument_version_id=assessment_dimensions.instrument_version_id and v.status='published'));
    create policy admin_manage_reviews on assessment_version_reviews for all using(current_user_role()='admin') with check(current_user_role()='admin');
    create policy counselor_read_reviews on assessment_version_reviews for select using(current_user_role()='konselor');
    create policy counselor_decide_reviews on assessment_version_reviews for update using(current_user_role()='konselor') with check(current_user_role()='konselor');
    create policy admin_read_review_comments on assessment_review_comments for select using(current_user_role()='admin');
    create policy counselor_read_review_comments on assessment_review_comments for select using(current_user_role()='konselor');
    create policy counselor_manage_review_comments on assessment_review_comments for all using(current_user_role()='konselor' and author_user_id=app_user_id()) with check(current_user_role()='konselor' and author_user_id=app_user_id());
    create policy admin_manage_support_profiles on student_support_profiles for all using(current_user_role()='admin') with check(current_user_role()='admin');
    create policy counselor_read_support_profiles on student_support_profiles for select using(current_user_role()='konselor');
    create policy student_read_own_support_profile on student_support_profiles for select using(student_id=app_user_id());
    create policy authenticated_read_resources on counseling_resources for select using(app_user_id() is not null);
    create policy admin_manage_resources on counseling_resources for all using(current_user_role()='admin') with check(current_user_role()='admin');
    create policy counselor_read_resource_blocks on counseling_resource_blocks for select using(current_user_role()='konselor');
    create policy admin_manage_resource_blocks on counseling_resource_blocks for all using(current_user_role()='admin') with check(current_user_role()='admin');
  end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='assessment_instrument_versions' and policyname='counselor_read_review_versions') then
    create policy counselor_read_review_versions on assessment_instrument_versions for select using(current_user_role()='konselor' and exists(select 1 from assessment_version_reviews r where r.instrument_version_id=assessment_instrument_versions.instrument_version_id));
    create policy counselor_read_review_instruments on assessment_instruments for select using(current_user_role()='konselor' and exists(select 1 from assessment_instrument_versions v join assessment_version_reviews r on r.instrument_version_id=v.instrument_version_id where v.instrument_id=assessment_instruments.instrument_id));
    create policy counselor_read_review_questions on assessment_questions for select using(current_user_role()='konselor' and exists(select 1 from assessment_version_reviews r where r.instrument_version_id=assessment_questions.instrument_version_id));
    create policy counselor_read_review_options on assessment_answer_options for select using(current_user_role()='konselor' and exists(select 1 from assessment_questions q join assessment_version_reviews r on r.instrument_version_id=q.instrument_version_id where q.assessment_question_id=assessment_answer_options.assessment_question_id));
    create policy counselor_read_review_dimensions on assessment_dimensions for select using(current_user_role()='konselor' and exists(select 1 from assessment_version_reviews r where r.instrument_version_id=assessment_dimensions.instrument_version_id));
  end if;
  if not exists(select 1 from pg_policies where tablename='hotline' and policyname='verified_hotline_visibility') then
    create policy verified_hotline_visibility on hotline as restrictive for select using(verification_status='active' or current_user_role()='admin');
  end if;
end $$;
grant select,insert,update,delete on
  assessment_dimensions, assessment_version_reviews, assessment_review_comments,
  student_support_profiles, counseling_resources, counseling_resource_blocks to sajiwa_app;
grant execute on function reject_locked_assessment_dimension_change() to sajiwa_app;
grant execute on function reject_locked_definition_revision_change() to sajiwa_app;
insert into schema_migrations(version) values ('004_backend_enablement') on conflict(version) do nothing;
commit;
