-- Sanctuary schema — pure PostgreSQL 17 + pgvector.
-- Applied once by docker compose on an empty volume (db/init/*.sql, alphabetical).
--
-- RLS identity: the backend sets it per transaction with
--   select set_config('app.current_user_id', <uuid>, true)
-- and connects as the non-superuser role `sanctuary_app` (created in 02_auth.sql),
-- so these policies are actually enforced.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ── helpers ──────────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Current request identity, or NULL when anonymous.
create or replace function app_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- ── users ────────────────────────────────────────────────────────────────────

create table if not exists users (
  user_id     uuid primary key default gen_random_uuid(),
  nama        varchar(100) not null,
  email       varchar(100) not null unique,
  nim         varchar(14),
  role        varchar(20)  not null default 'mahasiswa'
                check (role in ('mahasiswa', 'konselor', 'admin', 'pemangku_jabatan')),
  created_at  timestamptz  default now()
);

-- SECURITY DEFINER so policies that need the role do not recurse into users' own RLS.
create or replace function current_user_role()
returns varchar language sql security definer set search_path = public stable as $$
  select u.role from users u where u.user_id = app_user_id();
$$;

alter table users enable row level security;

create policy "users_read_own" on users
  for select using (app_user_id() = user_id);

create policy "admin_manage_all_users" on users
  for all using (current_user_role() in ('admin', 'pemangku_jabatan'));

-- ── assessments (PHQ-9 / GAD-7 / SRQ) ────────────────────────────────────────

create table if not exists assessments (
  assessment_id   uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references users(user_id) on delete cascade,
  instrument_type varchar(20) not null,
  answers         jsonb       not null,
  score           int         not null,
  severity        varchar(20) not null
                    check (severity in ('minimal', 'mild', 'moderate', 'severe')),
  taken_at        timestamptz default now()
);

create index if not exists idx_assessments_user_id  on assessments(user_id);
create index if not exists idx_assessments_severity on assessments(severity);
create index if not exists idx_assessments_taken_at on assessments(taken_at desc);

alter table assessments enable row level security;

create policy "mahasiswa_own_assessments" on assessments
  for all using (app_user_id() = user_id);

create policy "konselor_admin_read_assessments" on assessments
  for select using (current_user_role() in ('konselor', 'admin', 'pemangku_jabatan'));

-- ── jadwal & booking konsultasi ──────────────────────────────────────────────

create table if not exists jadwal_konsultasi (
  jadwal_id     uuid primary key default gen_random_uuid(),
  konselor_id   uuid        not null references users(user_id) on delete cascade,
  tanggal       date        not null,
  waktu_mulai   time        not null,
  waktu_selesai time        not null,
  status        varchar(20) not null default 'tersedia'
                  check (status in ('tersedia', 'dipesan', 'selesai', 'dibatalkan')),
  created_at    timestamptz default now(),
  constraint jadwal_time_valid check (waktu_selesai > waktu_mulai)
);

create index if not exists idx_jadwal_konselor_id on jadwal_konsultasi(konselor_id);
create index if not exists idx_jadwal_tanggal     on jadwal_konsultasi(tanggal);
create index if not exists idx_jadwal_status      on jadwal_konsultasi(status);

alter table jadwal_konsultasi enable row level security;

create policy "konselor_manage_own_jadwal" on jadwal_konsultasi
  for all using (app_user_id() = konselor_id);

create policy "admin_manage_all_jadwal" on jadwal_konsultasi
  for all using (current_user_role() in ('admin', 'pemangku_jabatan'));

create policy "mahasiswa_view_tersedia_jadwal" on jadwal_konsultasi
  for select using (status = 'tersedia');

create table if not exists booking_konsultasi (
  booking_id uuid primary key default gen_random_uuid(),
  jadwal_id  uuid        not null references jadwal_konsultasi(jadwal_id) on delete restrict,
  user_id    uuid        not null references users(user_id) on delete cascade,
  status     varchar(20) not null default 'menunggu'
               check (status in ('menunggu', 'dikonfirmasi', 'selesai', 'dibatalkan')),
  catatan    text,
  created_at timestamptz default now()
);

create index if not exists idx_booking_jadwal_id on booking_konsultasi(jadwal_id);
create index if not exists idx_booking_user_id   on booking_konsultasi(user_id);
create index if not exists idx_booking_status    on booking_konsultasi(status);

alter table booking_konsultasi enable row level security;

create policy "mahasiswa_own_booking" on booking_konsultasi
  for all using (app_user_id() = user_id);

create policy "konselor_view_booking" on booking_konsultasi
  for select using (
    exists (select 1 from jadwal_konsultasi j
            where j.jadwal_id = booking_konsultasi.jadwal_id
              and j.konselor_id = app_user_id())
  );

create policy "konselor_update_booking" on booking_konsultasi
  for update using (
    exists (select 1 from jadwal_konsultasi j
            where j.jadwal_id = booking_konsultasi.jadwal_id
              and j.konselor_id = app_user_id())
  );

create policy "admin_manage_all_booking" on booking_konsultasi
  for all using (current_user_role() in ('admin', 'pemangku_jabatan'));

-- A student must still see the slot behind their own booking once it stops being
-- 'tersedia', otherwise /booking/saya joins to nothing and re-booking returns 404
-- instead of 409.
--
-- SECURITY DEFINER on purpose: the konselor booking policies read jadwal_konsultasi,
-- so a plain subquery here creates a policy recursion cycle between the two tables.
-- Declared after booking_konsultasi because a SQL body is validated at creation.
create or replace function has_booking_for(p_jadwal_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from booking_konsultasi b
    where b.jadwal_id = p_jadwal_id and b.user_id = app_user_id()
  );
$$;

create policy "mahasiswa_view_own_booked_jadwal" on jadwal_konsultasi
  for select using (has_booking_for(jadwal_id));

-- Booking side effects are system state: SECURITY DEFINER so a mahasiswa's insert
-- can flip the counselor's slot even though they cannot update it directly.
create or replace function mark_jadwal_dipesan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update jadwal_konsultasi set status = 'dipesan' where jadwal_id = new.jadwal_id;
  return new;
end;
$$;

create or replace function restore_jadwal_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'dibatalkan' and old.status != 'dibatalkan' then
    update jadwal_konsultasi set status = 'tersedia' where jadwal_id = new.jadwal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_mark_jadwal on booking_konsultasi;
create trigger booking_mark_jadwal
  after insert on booking_konsultasi
  for each row execute function mark_jadwal_dipesan();

drop trigger if exists booking_restore_jadwal on booking_konsultasi;
create trigger booking_restore_jadwal
  after update on booking_konsultasi
  for each row execute function restore_jadwal_on_cancel();

-- ── chat: sessions are client-generated ids, so only messages are stored ─────

create table if not exists messages (
  message_id uuid primary key default gen_random_uuid(),
  session_id text        not null,
  user_id    uuid        references users(user_id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null,  -- Fernet ciphertext; never plaintext (core/security.py)
  route_used text,
  created_at timestamptz default now()
);

create index if not exists idx_messages_session_id on messages(session_id);
create index if not exists idx_messages_user_id    on messages(user_id);
create index if not exists idx_messages_created_at on messages(created_at desc);

alter table messages enable row level security;

create policy "mahasiswa_own_messages" on messages
  for all using (app_user_id() = user_id);

create table if not exists guardrail_logs (
  log_id          uuid primary key default gen_random_uuid(),
  user_id         uuid references users(user_id) on delete set null,
  session_id      text,
  triggered_input text,
  source          text default 'chat' check (source in ('chat', 'assessment')),
  assessment_id   uuid references assessments(assessment_id) on delete set null,
  is_read         boolean default false,
  notified_at     timestamptz default now()
);

create index if not exists idx_guardrail_user_id   on guardrail_logs(user_id);
create index if not exists idx_guardrail_is_read   on guardrail_logs(is_read);
create index if not exists idx_guardrail_notified  on guardrail_logs(notified_at desc);

alter table guardrail_logs enable row level security;

create policy "system_insert_guardrail_logs" on guardrail_logs
  for insert with check (true);

create policy "konselor_admin_read_guardrail_logs" on guardrail_logs
  for all using (current_user_role() in ('konselor', 'admin', 'pemangku_jabatan'));

-- ── journals ─────────────────────────────────────────────────────────────────

create table if not exists journals (
  journal_id uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references users(user_id) on delete cascade,
  content    text        not null,
  mood       varchar(20) check (mood in ('Calm', 'Anxious', 'Focused', 'Tired')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_journals_user_id    on journals(user_id);
create index if not exists idx_journals_created_at on journals(created_at desc);

alter table journals enable row level security;

create policy "mahasiswa_own_journals" on journals
  for all using (app_user_id() = user_id);

drop trigger if exists journals_updated_at on journals;
create trigger journals_updated_at
  before update on journals
  for each row execute function set_updated_at();

-- ── RAG vector store ─────────────────────────────────────────────────────────

create table if not exists documents (
  document_id bigserial primary key,
  content     text not null,
  embedding   vector(768),
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

-- HNSW needs no training population, unlike ivfflat with lists=100.
create index if not exists idx_documents_embedding
  on documents using hnsw (embedding vector_cosine_ops);

alter table documents enable row level security;

create policy "public_read_documents" on documents for select using (true);
create policy "admin_manage_documents" on documents
  for all using (current_user_role() = 'admin');
-- scripts/embed.py runs offline with no request identity.
create policy "documents_insert" on documents for insert with check (true);

create or replace function match_documents(
  query_embedding vector(768),
  match_threshold float default 0.3,
  match_count     int   default 5
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
language sql stable as $$
  select
    document_id as id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── crisis hotlines ──────────────────────────────────────────────────────────

create table if not exists hotline (
  hotline_id uuid primary key default gen_random_uuid(),
  nama       varchar(100) not null,
  nomor      varchar(20)  not null,
  deskripsi  text,
  created_at timestamptz default now()
);

alter table hotline enable row level security;

create policy "public_read_hotline" on hotline for select using (true);
create policy "admin_manage_hotline" on hotline
  for all using (current_user_role() = 'admin');

insert into hotline (nama, nomor, deskripsi) values
  ('Into The Light Indonesia', '119 ext 8',      'Layanan crisis center nasional'),
  ('Yayasan Pulih',            '(021) 788-42580', 'Konseling psikologis'),
  ('IGD Rumah Sakit Terdekat', '118',             'Unit gawat darurat');
