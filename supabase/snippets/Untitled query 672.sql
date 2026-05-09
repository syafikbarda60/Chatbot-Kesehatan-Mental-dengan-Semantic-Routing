-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assessments (
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instrument_type character varying NOT NULL,
  answers jsonb NOT NULL,
  score integer NOT NULL,
  severity character varying NOT NULL,
  taken_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assessments_pkey PRIMARY KEY (assessment_id),
  CONSTRAINT assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.booking_konsultasi (
  booking_id uuid NOT NULL DEFAULT gen_random_uuid(),
  jadwal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'menunggu'::character varying CHECK (status::text = ANY (ARRAY['menunggu'::character varying, 'dikonfirmasi'::character varying, 'selesai'::character varying, 'dibatalkan'::character varying]::text[])),
  catatan text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_konsultasi_pkey PRIMARY KEY (booking_id),
  CONSTRAINT booking_konsultasi_jadwal_id_fkey FOREIGN KEY (jadwal_id) REFERENCES public.jadwal_konsultasi(jadwal_id),
  CONSTRAINT booking_konsultasi_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.chat_sessions (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  title text,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.documents (
  document_id bigint NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  content text NOT NULL,
  embedding USER-DEFINED,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (document_id)
);
CREATE TABLE public.guardrail_logs (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  triggered_input text NOT NULL,
  triggered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT guardrail_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT guardrail_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(session_id)
);
CREATE TABLE public.hotline (
  hotline_id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  nomor character varying NOT NULL,
  deskripsi text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hotline_pkey PRIMARY KEY (hotline_id)
);
CREATE TABLE public.jadwal_konsultasi (
  jadwal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  konselor_id uuid NOT NULL,
  tanggal date NOT NULL,
  waktu_mulai time without time zone NOT NULL,
  waktu_selesai time without time zone NOT NULL,
  status character varying NOT NULL DEFAULT 'tersedia'::character varying CHECK (status::text = ANY (ARRAY['tersedia'::character varying, 'dipesan'::character varying, 'selesai'::character varying, 'dibatalkan'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT jadwal_konsultasi_pkey PRIMARY KEY (jadwal_id),
  CONSTRAINT jadwal_konsultasi_konselor_id_fkey FOREIGN KEY (konselor_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.messages (
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  role character varying NOT NULL,
  content text NOT NULL,
  route_used character varying,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(session_id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL,
  nama character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  nim character varying,
  role character varying NOT NULL DEFAULT 'mahasiswa'::character varying CHECK (role::text = ANY (ARRAY['mahasiswa'::character varying, 'konselor'::character varying, 'admin'::character varying, 'pemangku_jabatan'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);