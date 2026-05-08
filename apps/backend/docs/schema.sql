-- =========================================================
-- Sanctuary — Complete Supabase SQL Schema
-- Jalankan di Supabase Dashboard → SQL Editor
-- =========================================================

-- ── RESET: Drop semua tabel lama (urutan: child → parent) ──────────────────
-- Ini aman di-run ulang untuk fresh install atau schema update

drop trigger if exists consultation_restore_slot  on consultations;
drop trigger if exists consultation_mark_slot     on consultations;
drop trigger if exists consultations_updated_at   on consultations;
drop trigger if exists profiles_updated_at        on profiles;
drop trigger if exists on_auth_user_created       on auth.users;

drop function if exists restore_slot_on_cancel()   cascade;
drop function if exists mark_slot_unavailable()    cascade;
drop function if exists set_updated_at()           cascade;
drop function if exists handle_new_user()          cascade;
drop function if exists match_documents(vector, float, int) cascade;

drop table if exists consultations   cascade;
drop table if exists counselor_slots cascade;
drop table if exists messages        cascade;
drop table if exists chat_sessions   cascade;
drop table if exists guardrail_logs  cascade;
drop table if exists hotlines        cascade;
drop table if exists assessments     cascade;
drop table if exists documents       cascade;
drop table if exists profiles        cascade;

-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;


-- =========================================================
-- ── TABLE: profiles
-- Extended user data, sync dari auth.users via trigger
-- =========================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  nim         text unique,                          -- NIM mahasiswa
  role        text not null default 'mahasiswa'
                check (role in ('mahasiswa', 'operator', 'admin')),
  avatar_url  text,
  phone       text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table profiles enable row level security;

create policy "users_own_profile" on profiles
  for all using (auth.uid() = id);

create policy "operator_admin_view_profiles" on profiles
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('operator', 'admin')
  );

-- Auto-create profile saat user baru register
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role, nim)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'mahasiswa'),
    new.raw_user_meta_data ->> 'nim'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- =========================================================
-- ── TABLE: assessments (CB-01, CB-02, CB-10)
-- Hasil kuesioner mandiri mahasiswa
-- =========================================================
create table if not exists assessments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  answers      jsonb not null,     -- [{question_id, score}]
  total_score  int  not null,
  risk_level   text not null check (risk_level in ('low', 'medium', 'high')),
  notes        text,               -- catatan opsional
  created_at   timestamptz default now()
);

create index if not exists idx_assessments_user_id    on assessments(user_id);
create index if not exists idx_assessments_risk_level on assessments(risk_level);
create index if not exists idx_assessments_created_at on assessments(created_at desc);

alter table assessments enable row level security;

create policy "mahasiswa_own_assessments" on assessments
  for all using (auth.uid() = user_id);

create policy "operator_admin_read_assessments" on assessments
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('operator', 'admin')
  );


-- =========================================================
-- ── TABLE: guardrail_logs (CB-02, CB-04)
-- Log deteksi konten self-harm / high-risk notification ke Operator
-- =========================================================
create table if not exists guardrail_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  session_id       text,
  triggered_input  text,
  source           text default 'chat'   -- 'chat' | 'assessment'
                     check (source in ('chat', 'assessment')),
  assessment_id    uuid references assessments(id) on delete set null,
  is_read          boolean default false,  -- sudah dibaca operator?
  notified_at      timestamptz default now()
);

create index if not exists idx_guardrail_user_id    on guardrail_logs(user_id);
create index if not exists idx_guardrail_is_read    on guardrail_logs(is_read);
create index if not exists idx_guardrail_notified   on guardrail_logs(notified_at desc);

alter table guardrail_logs enable row level security;

create policy "system_insert_guardrail_logs" on guardrail_logs
  for insert with check (true);

create policy "operator_admin_read_guardrail_logs" on guardrail_logs
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('operator', 'admin')
  );


-- =========================================================
-- ── TABLE: hotlines (CB-03)
-- Daftar kontak layanan darurat
-- =========================================================
create table if not exists hotlines (
  id          serial primary key,
  name        text not null,
  number      text not null,
  description text,
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table hotlines enable row level security;

-- Semua user bisa baca, hanya admin yang bisa ubah
create policy "public_read_hotlines" on hotlines
  for select using (active = true);

create policy "admin_manage_hotlines" on hotlines
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Seed data awal
insert into hotlines (name, number, description) values
  ('Into The Light Indonesia', '119 ext 8',      'Layanan crisis center nasional'),
  ('Yayasan Pulih',            '(021) 788-42580', 'Konseling psikologis'),
  ('IGD Rumah Sakit Terdekat', '118',             'Unit gawat darurat')
on conflict do nothing;


-- =========================================================
-- ── TABLE: chat_sessions (CB-07, CB-08)
-- Sesi percakapan mahasiswa dengan chatbot
-- =========================================================
create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text,                         -- auto-generated dari pesan pertama
  is_active   boolean default true,
  created_at  timestamptz default now(),
  ended_at    timestamptz
);

create index if not exists idx_chat_sessions_user_id on chat_sessions(user_id);

alter table chat_sessions enable row level security;

create policy "mahasiswa_own_sessions" on chat_sessions
  for all using (auth.uid() = user_id);


-- =========================================================
-- ── TABLE: messages (CB-08)
-- Log percakapan terenkripsi (Fernet/AES di Python sebelum insert)
-- =========================================================
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,               -- bisa UUID atau string
  user_id     uuid references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     jsonb not null,              -- {"encrypted": "<fernet_token>"}
  route_used  text,                        -- 'rag' | 'conversational' | 'guardrail'
  created_at  timestamptz default now()
);

create index if not exists idx_messages_session_id on messages(session_id);
create index if not exists idx_messages_user_id    on messages(user_id);
create index if not exists idx_messages_created_at on messages(created_at desc);

alter table messages enable row level security;

create policy "mahasiswa_own_messages" on messages
  for all using (auth.uid() = user_id);


-- =========================================================
-- ── TABLE: documents (CB-06 — RAG pgvector)
-- Dokumen referensi medis tervalidasi + embedding vektor
-- =========================================================
create table if not exists documents (
  id        bigserial primary key,
  content   text    not null,
  embedding vector(768),            -- nomic-embed-text-v2-moe output dim
  metadata  jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_documents_embedding
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS: publik read (dokumen referensi tidak sensitif)
alter table documents enable row level security;
create policy "public_read_documents" on documents for select using (true);
create policy "admin_manage_documents" on documents
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Function: ANN search untuk RAG (CB-06)
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
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;


-- =========================================================
-- ── TABLE: counselor_slots
-- Slot waktu konsultasi yang dibuka oleh Operator
-- =========================================================
create table if not exists counselor_slots (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid references auth.users(id) on delete cascade,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  is_available boolean default true,
  location     text,                   -- online / ruang BK / dll
  notes        text,
  created_at   timestamptz default now(),

  constraint slot_time_valid check (end_time > start_time)
);

create index if not exists idx_slots_operator_id  on counselor_slots(operator_id);
create index if not exists idx_slots_start_time   on counselor_slots(start_time);
create index if not exists idx_slots_is_available on counselor_slots(is_available);

alter table counselor_slots enable row level security;

create policy "operator_manage_own_slots" on counselor_slots
  for all using (auth.uid() = operator_id);

create policy "admin_manage_all_slots" on counselor_slots
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "mahasiswa_view_available_slots" on counselor_slots
  for select using (is_available = true);


-- =========================================================
-- ── TABLE: consultations
-- Booking jadwal konsultasi mahasiswa ↔ operator
-- =========================================================
create table if not exists consultations (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references auth.users(id) on delete cascade,
  operator_id  uuid references auth.users(id) on delete set null,
  slot_id      uuid references counselor_slots(id) on delete set null,

  -- Waktu di-copy dari slot saat booking (tidak berubah jika slot diedit)
  scheduled_at timestamptz not null,
  end_at       timestamptz not null,

  status       text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'cancelled', 'completed')),

  student_notes  text,      -- catatan dari mahasiswa saat booking
  operator_notes text,      -- catatan konselor setelah sesi
  cancel_reason  text,      -- alasan pembatalan

  -- Link ke asesmen jika konsultasi dipicu risk tinggi
  triggered_by_assessment_id uuid references assessments(id) on delete set null,

  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_consult_student_id   on consultations(student_id);
create index if not exists idx_consult_operator_id  on consultations(operator_id);
create index if not exists idx_consult_scheduled_at on consultations(scheduled_at);
create index if not exists idx_consult_status       on consultations(status);

alter table consultations enable row level security;

create policy "mahasiswa_own_consultations" on consultations
  for all using (auth.uid() = student_id);

create policy "operator_view_assigned" on consultations
  for select using (auth.uid() = operator_id);

create policy "operator_update_assigned" on consultations
  for update using (auth.uid() = operator_id);

create policy "admin_all_consultations" on consultations
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- =========================================================
-- ── TRIGGERS
-- =========================================================

-- 1. Auto updated_at untuk profiles
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger consultations_updated_at
  before update on consultations
  for each row execute function set_updated_at();

-- 2. Slot → is_available = false saat booking
create or replace function mark_slot_unavailable()
returns trigger language plpgsql as $$
begin
  if new.slot_id is not null then
    update counselor_slots set is_available = false where id = new.slot_id;
  end if;
  return new;
end;
$$;

create trigger consultation_mark_slot
  after insert on consultations
  for each row execute function mark_slot_unavailable();

-- 3. Slot → is_available = true saat konsultasi di-cancel
create or replace function restore_slot_on_cancel()
returns trigger language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    if new.slot_id is not null then
      update counselor_slots set is_available = true where id = new.slot_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger consultation_restore_slot
  after update on consultations
  for each row execute function restore_slot_on_cancel();
