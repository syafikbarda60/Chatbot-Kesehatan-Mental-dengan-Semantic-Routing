# Ollama & LangChain conventions

All generation and embeddings run **locally via Ollama**, reached through **LangChain as a thin
LLM/message adapter** (`langchain-core` messages, `langchain-ollama` clients) plus the raw `ollama`
client for ingestion. There are **no chains, agents, retrievers, or vector-store abstractions** —
RAG retrieval is hand-written SQL against PostgreSQL + pgvector. No hosted LLM provider.

## Models

| Purpose | Model | Client |
|---------|-------|--------|
| Intent routing | `nomic-embed-text-v2-moe` | `semantic_router.encoders.OllamaEncoder` |
| Chat generation | `llama3-8b-instruct:Q4_K_M` (team fine-tune; `OLLAMA_CHAT_MODEL=llama3.2:3b` when RAM is short) | `langchain_ollama.ChatOllama` |
| RAG query embeddings | `nomic-embed-text-v2-moe` | `langchain_ollama.OllamaEmbeddings` (`embed_query`) |
| Document ingestion embeddings | `nomic-embed-text-v2-moe` | `ollama.embed(...)` |

## Generation

One shared client, `services/chatbot/llm.py` — import it, never construct another `ChatOllama`.
Prompt building and generation are separate: `build_messages()` lives in `conversational.py`
(persona) or `rag.py` (retrieved context, or `None` → `NO_CONTEXT_REPLY`), and `core.chat_stream`
is the only caller that generates. `/chat` is that generator joined; `/chat/stream` forwards it as
SSE — so the two endpoints cannot answer differently.

```python
from langchain_core.messages import HumanMessage, SystemMessage
from services.chatbot.llm import llm

messages = [SystemMessage(content=system), *history, HumanMessage(content=user)]
for chunk in llm.stream(messages):      # what core.chat_stream does
    yield chunk.content
```

- Use `llm.stream(...)`, not `invoke` — one token path, not two that can drift apart.
- Instructions always go in a `SystemMessage`, never a `HumanMessage`: shared roles are the easy
  prompt-injection path.
- Do not introduce LCEL chains or LangGraph; keep calls direct and generation stateless per call.
- `llm.py` pins `num_ctx`, `keep_alive`, and an httpx timeout, all overridable via
  `OLLAMA_NUM_CTX` / `OLLAMA_TEMPERATURE` / `OLLAMA_TIMEOUT`. A fresh client silently loses them.
- Never send guardrail (crisis) messages to the LLM — see
  [semantic-router-conventions.md](semantic-router-conventions.md).

## Conversation memory

"Memory" is the last `HISTORY_TURNS` rows re-read per request by
`services/chatbot/history.py` (`load_history`) and prepended oldest-first — never assembled by
hand, no Redis needed. Three load-bearing rules there: `route_used is distinct from 'guardrail'`
(crisis turns must never reach the LLM by the history path); a trailing unanswered user turn is
dropped, so a killed stream's question is not sent twice when it is retried; and the
`HISTORY_CHAR_CAP` bound keeps the prompt under `num_ctx`.

## RAG ingestion & retrieval

`apps/backend/scripts/embed.py` reads `apps/backend/docs/*.docx`, extracts paragraphs + tables,
chunks at `size=500 / overlap=50`, embeds, and inserts into `documents` (`metadata.source`,
`metadata.chunk`). Retrieval is `select * from match_documents(%s::vector, 0.3, k)` through
`core/db.py` — see [postgresql-conventions.md](postgresql-conventions.md).

- Pin model names; all call sites share `EMBED_MODEL` from `services/chatbot/rag.py`.
- Every chunk carries `metadata.citation` — the label a student sees, written by
  `scripts/embed.py` from its `CITATIONS` map (`"Buku Depresi REVISI FINAL.docx"` →
  `"Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)"`). The raw filename is internal and
  must not reach the model. A new document with no entry is ingested with `null` and the prompt
  falls back to its filename — add the entry when you add the file.
- `build_messages` prefixes each chunk with `[<citation>]` and `RAG_SYSTEM_PROMPT` requires the
  answer to open with it. That is what makes a follow-up "sumbernya dari mana?" answerable from
  conversation history. Changing a citation is metadata-only: backfill with
  `update documents set metadata = metadata || jsonb_build_object('citation', …)` — no
  re-embed, because the vectors do not change.
- `scripts/embed.py` **inserts, it does not replace**: re-running it against a populated
  database duplicates every chunk. Clear or scope `documents` first.
- `nomic-embed-text-v2-moe` requires task prefixes and does not add them itself: documents are
  embedded as `"search_document: "`, queries as `"search_query: "`. The `QUERY_PREFIX` /
  `DOCUMENT_PREFIX` constants in `rag.py` are the single source of truth — keep the pair matched
  or similarity degrades silently. Changing either invalidates every stored vector: re-embed via
  `scripts/embed.py`. `OllamaEmbeddings` is a module-level singleton in `rag.py`.

## Failure mode

If Ollama isn't running the backend **fails to start**: `SemanticRouter(...)` embeds every route
utterance at import, so the exception surfaces there and nothing serves. That is deliberate — a
zero-vector fallback would route everything to one route while looking healthy. See
[semantic-router-conventions.md](semantic-router-conventions.md).

`ponytail:` comments mark known limits (e.g. no per-user rate limit on generation).

## Run

```bash
ollama serve
ollama pull nomic-embed-text-v2-moe
# Generation model is imported from a GGUF, not pulled: HF stores it on Xet and
# `ollama pull hf.co/...` aborts with "blocked redirect to a different host".
curl -L -o ~/models/local_model.Q4_K_M.gguf \
  https://huggingface.co/SekarBestNY/llama-3-8b-instruct-gguf/resolve/main/local_model.Q4_K_M.gguf
printf 'FROM %s\n' ~/models/local_model.Q4_K_M.gguf > ~/models/Modelfile
ollama create llama3-8b-instruct:Q4_K_M -f ~/models/Modelfile
```
