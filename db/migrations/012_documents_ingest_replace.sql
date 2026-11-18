-- Ingestion replacement: scripts/embed.py must be able to swap one source's chunks atomically.
--
-- The existing policies let the app role insert and read documents, and let an admin manage
-- them; nothing allowed the offline ingestion script to delete the chunks it is replacing, so
-- a re-run could only duplicate them. This policy is scoped to a transaction-local flag that
-- only the ingestion script sets — application requests never do.
--
-- `set local app.embedding_ingest = 'on'` inside the replacement transaction is the only way
-- to satisfy it; RLS still hides every row from a request that does not set it.

drop policy if exists "documents_replace_for_ingest" on documents;
create policy "documents_replace_for_ingest" on documents for delete
  using (current_setting('app.embedding_ingest', true) = 'on');

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'documents'
                   and policyname = 'documents_replace_for_ingest') then
    raise exception 'documents_replace_for_ingest policy was not created';
  end if;
end $$;
