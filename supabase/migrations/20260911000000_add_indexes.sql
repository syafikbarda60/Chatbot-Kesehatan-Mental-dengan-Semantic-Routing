-- Database indexes for performance optimization
-- Run after init_schema.sql and add_journals_table.sql

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_created_at 
ON public.messages (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_created_at 
ON public.messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_session_user_created 
ON public.messages (session_id, user_id, created_at DESC);

-- Chat sessions indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_started 
ON public.chat_sessions (user_id, started_at DESC);

-- Guardrail logs indexes
CREATE INDEX IF NOT EXISTS idx_guardrail_logs_session_created 
ON public.guardrail_logs (session_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardrail_logs_user_created 
ON public.guardrail_logs (session_id, triggered_at DESC);

-- Assessments indexes
CREATE INDEX IF NOT EXISTS idx_assessments_user_taken 
ON public.assessments (user_id, taken_at DESC);

-- Journal indexes
CREATE INDEX IF NOT EXISTS idx_journals_user_created 
ON public.journals (user_id, created_at DESC);

-- Documents table - HNSW index for vector similarity search
-- Note: Requires pgvector >= 0.5.0
-- Create after documents table has data for best performance
-- CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw 
-- ON public.documents USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (works with older pgvector)
-- Run after populating documents table
-- CREATE INDEX IF NOT EXISTS idx_documents_embedding_ivfflat 
-- ON public.documents USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Booking indexes
CREATE INDEX IF NOT EXISTS idx_booking_konsultasi_user_status 
ON public.booking_konsultasi (user_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_konsultasi_jadwal_status 
ON public.booking_konsultasi (jadwal_id, status);

-- Jadwal indexes
CREATE INDEX IF NOT EXISTS idx_jadwal_konsultasi_konselor_tanggal 
ON public.jadwal_konsultasi (konselor_id, tanggal);

CREATE INDEX IF NOT EXISTS idx_jadwal_konsultasi_status_tanggal 
ON public.jadwal_konsultasi (status, tanggal);

-- Hotline table (small, but for completeness)
CREATE INDEX IF NOT EXISTS idx_hotline_nama 
ON public.hotline (nama);

-- Users table (for role-based queries)
CREATE INDEX IF NOT EXISTS idx_users_role 
ON public.users (role);

-- Partial index for active sessions (not ended)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active 
ON public.chat_sessions (user_id, started_at DESC) 
WHERE ended_at IS NULL;

-- Composite index for message search by route
CREATE INDEX IF NOT EXISTS idx_messages_route_created 
ON public.messages (route_used, created_at DESC);