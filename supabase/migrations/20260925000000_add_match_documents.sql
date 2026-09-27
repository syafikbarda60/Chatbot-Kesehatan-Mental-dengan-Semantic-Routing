-- RAG retrieval used by apps/backend/services/chatbot/rag.py (retrieve_docs).
-- Previously only in apps/backend/docs/migration.sql, so databases built from
-- migrations were missing it (PGRST202 on /chat/stream RAG route).
create or replace function public.match_documents(
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
  from public.documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
