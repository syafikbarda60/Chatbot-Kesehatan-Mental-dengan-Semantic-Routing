# Running the RAG and semantic-routing tests

How to run the checks that guard the chatbot's routing, crisis gate, retrieval, citations and
ingestion — and what their results do and do not prove. The current measured numbers and the
remaining gaps are at the bottom of this page.

## 1. What exists

| Tier | Runner | Needs |
| --- | --- | --- |
| Unit | `npm test` (or the per-file commands below) | Python 3.12 venv only |
| Integration: API + DB + RLS | `npm run test:integration` → `stack_smoke.py`, `db/test_rls.sql` | Docker (Postgres), uvicorn, Ollama |
| Integration: router quality | `rag_router_eval.py` (inside the same command) | Ollama + embedding model |
| Integration: retrieval quality | `rag_retrieval_eval.py` (inside the same command) | Ollama + Postgres + stored corpus |

`npm run test:integration` runs all of them in that order. Each evaluator skips **loudly with
exit 2** when a dependency check fails (Ollama down, embedding model not pulled, DB unreachable);
the shell runner reports the skip and continues. The retrieval evaluator currently does not
explicitly detect an empty corpus in preflight; do not treat its preflight as a corpus check. A gate failure exits 1 and stops the run.

## 2. Setup

Once, from the repository root:

```bash
npm install                    # workspaces + git hooks
cd apps/backend
python3.12 -m venv venv        # semantic-router has no 3.13+ wheels
venv/bin/python -m pip install -r requirements.txt
cp .env.example .env           # fill DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
```

Full install/infra notes: [development conventions](development-conventions.md).

## 3. Unit tier (no database, no model)

```bash
# From the repository root — every workspace plus the backend
npm test

# Backend only
npm run backend:test:unit
```

The files that matter for this area, run individually from `apps/backend`:

```bash
for test in test_rag_citation test_embed_chunking test_provenance test_guardrail \
            test_chat_history test_chat_stream test_chat_sessions; do
  venv/bin/python -m unittest discover -s tests/unit -p "${test}.py" -v || exit 1
done
```

| File | Tests | What it pins |
| --- | ---: | --- |
| `test_rag_citation.py` | 7 | Citation reaching the prompt, filename fallback, retrieved instructions kept out of the system role, neighbour slices |
| `test_embed_chunking.py` | 6 | 500/50 chunk contract, empty input, DOCX paragraph/table order, no ingestion on import |
| `test_provenance.py` | 4 | Corpus-based fixed reply, "AI, not a psychologist" claim, empty-corpus fallback, sample utterances |
| `test_guardrail.py` | 16 | Crisis normalization, intent/action/target patterns, paired farewell cues, conservative negation policy, profanity preserving medical terms |
| `test_chat_policy.py` | 8 | Fixed internal-instruction/personal-medical/private-data refusals, crisis priority over supplied routes, normal generation, diagnosis-report negative controls, fixed provenance and empty-context responses |
| `test_chat_history.py` | 6 | Prompt budget, crisis rows filtered in SQL, ordering, unanswered-turn handling |
| `test_chat_stream.py` | 5 | SSE framing, `[DONE]`, error frame without `[DONE]`, persistence failures |
| `test_chat_sessions.py` | 5 | Session scoping, previews, encrypted persistence |

These do not measure embedding accuracy, retrieval quality, generated-answer grounding, or the
real dispatcher's route decisions — that is what the integration evaluators are for.

## 4. Integration tier

### Prepare the stack

These write real rows and clean up after themselves. Use a **dedicated local database**, never
production or a shared student database.

```bash
docker compose up -d                 # Postgres 17 + pgvector, migrations run on boot
docker compose ps                     # sajiwa-db must be healthy
```

Ollama, in another terminal:

```bash
ollama serve
ollama pull nomic-embed-text-v2-moe   # router + retrieval embeddings
```

Generation model (needed by `stack_smoke.py`'s chat checks, not by the two evaluators):

```bash
# Team fine-tune is imported from GGUF, not pulled — see ollama-conventions.md
ollama list   # expect llama3-8b-instruct:Q4_K_M (or set OLLAMA_CHAT_MODEL)
```

Ingest the corpus **once** if `documents` is empty:

```bash
cd apps/backend
venv/bin/python scripts/embed.py            # dry run: chunk count and lengths, writes nothing
venv/bin/python scripts/embed.py --apply    # atomic per-source replace, backup path printed
```

Start the API in another terminal:

```bash
cd apps/backend
venv/bin/uvicorn main:app --reload
```

### Run everything

```bash
# From the repository root
npm run test:integration
```

That executes, in order:

1. `apps/backend/tests/integration/stack_smoke.py` — API over HTTP, real SQL/triggers/RLS,
   chat, crisis battery, streaming, report-to-team, cleanup.
2. `tests/integration/rag_router_eval.py` — router quality gates.
3. `tests/integration/rag_retrieval_eval.py` — retrieval gates against the stored corpus.
4. `db/test_rls.sql` — RLS/auth self-check (one transaction, rolled back).

If Docker is down the whole tier prints `SKIP integration: …` and exits 0 — a skip is not a
pass.

### Run the evaluators alone

```bash
cd apps/backend
venv/bin/python tests/integration/rag_router_eval.py
venv/bin/python tests/integration/rag_retrieval_eval.py
```

Both accept `--fixtures <file>`. The default integration runner also executes the
`*_cases_remediation.json` regression sets. Prompt-injection generation runs separately:

```bash
venv/bin/python tests/integration/chat_adversarial_eval.py --output /tmp/sajiwa-adversarial.json
```

This runner records full synthetic answers. Exit 0 means only its automated checks passed;
rows marked `review_required` still require review. Historical single-turn attacks use real
chat dispatch. Multi-turn and document attacks use real prompt assembly/model generation with
synthetic history or a substituted DB boundary; they do not prove HTTP persistence or RLS.

Other evaluator commands:


```bash
venv/bin/python tests/integration/rag_router_eval.py \
  --fixtures tests/integration/fixtures/rag_router_cases_frozen.json
venv/bin/python tests/integration/rag_retrieval_eval.py \
  --fixtures tests/integration/fixtures/rag_retrieval_cases_frozen.json
```

Exit codes: `0` all gates pass, `1` a gate failed, `2` dependencies unavailable (SKIP).

## 5. Fixtures: regression vs frozen

| File | Role | Rule |
| --- | --- | --- |
| `fixtures/rag_router_cases.json` | `regression` (100 messages, 8 paraphrase groups) + `heldout_v1`/`heldout_v2` | Used for calibration. Its numbers are **training-set** numbers. |
| `fixtures/rag_router_cases_frozen.json` | Originally frozen, then used for two crisis fixes and subsequent regression checks | **Not untouched anymore.** Its initial result was 94%; 96% was after fixes. |
| `fixtures/rag_retrieval_cases.json` | 15 in-domain + 5 out-of-domain | Same rule; phrase oracle must exist in the source DOCX. |
| `fixtures/rag_retrieval_cases_frozen.json` | Same shape, initially written before execution | Subsequently included in retrieval threshold calibration; now regression evidence. |
| `fixtures/rag_router_cases_remediation.json` | 17 November: 100 messages + 8 paraphrase groups | Initial accuracy 77%; now used for remediation, **not independent evaluation**. One original question overlapped an older fixture. |
| `fixtures/rag_retrieval_cases_remediation.json` | New wording, existing source-verified phrase oracles | Initially 12/15 hits and one OOD leak; now threshold-calibration regression. |
| `fixtures/chat_adversarial_cases.json` | Eight historical + eight newer attacks, one history and one document injection | Regression, with manual answer review; not a universal injection defence test. |

Fixtures are checked in, so a change is visible in history. `--fixtures` exists so the frozen
set can be run without touching the regression file.

## 6. Gates (fixed in the evaluators, not in the fixtures)

| Gate | Value | Where |
| --- | --- | --- |
| Macro precision / recall (router) | ≥ 0.85 each | `rag_router_eval.py` |
| Paraphrase consistency **and** correctness | all groups | `rag_router_eval.py` |
| Out-of-domain → not `rag`/`provenance` | all | `rag_router_eval.py` |
| Hit Rate@5 | ≥ 0.80 | `rag_retrieval_eval.py` |
| Out-of-domain retrieval → no context | all | `rag_retrieval_eval.py` |
| Per-query retrieval latency | < 3 s | `rag_retrieval_eval.py` |
| Results/score/citation shape | k entries, > 0.3, citation present | `rag_retrieval_eval.py` |

Never lower a pass mark, relabel a fixture, or add a test sentence to the utterance list to make
a run green. Record the date, commit and configuration whenever you quote a number.

## 7. Reading a failure

- `SKIP … the sajiwa-db container is not up` / `docker is not running` — the tier did nothing.
- `SKIP router evaluation: Ollama is not reachable` — start Ollama or pull the model.
- `SKIP retrieval evaluation: database is not reachable` — `DATABASE_URL` or the stack is wrong.
- `MISS expected=… got=…` — the router put a labelled message on another route; check whether it
  is a crisis miss (safety, fix first) or a quality miss.
- `GATE FAILED Hit Rate…` — retrieval regressed; check the corpus fingerprint before re-tuning.
- `generation_failed` in `stack_smoke` — generation, not routing; see the API log (the route and
  session are now logged with the traceback).

## 8. Current results (16 November 2026)

Historical results below (16 November), **not current independent evidence**. The column
previously described as untouched was run again after fixes; that description was incorrect.

| Check | Regression (tuned) | Previously frozen, then used for fixes |
| --- | ---: | ---: |
| Router macro precision / recall | 100% / 100% | **96,1% / 96,0%** |
| Router accuracy | 100% | **96,0%** |
| Paraphrases consistent / correct | 8/8 / 8/8 | **8/8 / 8/8** |
| Hit Rate@5 | 13/15 (86,7%) | **13/15 (86,7%)** |
| Out-of-domain without context | 5/5 | **5/5** |
| Retrieval latency (max) | 0,075 s | **0,061 s** |
| Answer citation | 4/4 | **4/4** |
| Prompt injection | — | **6/8** |

`npm test` (172 backend tests + workspace suites) and `npm run test:integration` (no skips)
both pass on that date.

## 9. Known gaps

- **Prompt injection:** historical repetition/translation attacks leaked instructions (2/8).
  Direct internal-instruction requests now have a fixed refusal before generation, after the
  crisis gate. This is a narrow pattern check, not protection against all paraphrases, encoded
  attacks or multi-turn attacks. Retrieved text is now a user-role data message, not system
  instructions. Model compliance still needs live adversarial testing and answer review.
- **Negation:** a message that quotes or negates a crisis phrase ("aku nggak akan bunuh diri")
  still shows the crisis card. This conservative policy is retained pending counselor review;
  false positives can interrupt support and create staff alerts, so they are not harmless.
- **Educational crisis questions:** "kapan pasien dengan ide bunuh diri perlu dirawat?" is
  routed to guardrail for the same reason.
- **Generation latency:** the <40 s target is not enforced. On the CPU-only reference machine a
  RAG answer measured 111–209 s; `stack_smoke` only proves an answer completes.
- **Grounding:** citation presence is checked; whether the claims are supported is not. That
  needs human review.
- **Bias:** the frozen set was written by the same agent that wrote the fix, the labels have no
  independent review, the retrieval oracle is phrase-based, and samples are small (15 retrieval
  cases ≈ 62–96% at 95% CI). Treat the percentages as regression evidence, not a generalisation
  claim.

## 10. Remediation measurements (17 November 2026)

Full evidence, reproduction commands and remaining failures:
[remediation results](rag-semantic-routing-testing-results.md).

The 17 November initial run used 100 classification questions and 40 paraphrases, generated
by the session model, not DeepSeek. It had no exact utterance overlap, but one question matched
an older evaluation fixture. Classification accuracy was **77%**, crisis recall **21/25**,
provenance recall **9/25**, and paraphrase groups **7/8**. Retrieval had **12/15** phrase hits
and **4/5** OOD queries returned no context. These fixtures are now explicitly regression data.

Changes were made after failing tests at the agreed seams:

- Crisis slang normalization and bounded intent/action/target patterns, with negative controls;
  paired farewell cues retain the existing fixed crisis response and its safety question.
- Separate identity/source utterances from conversational greetings; unchanged route thresholds.
- Retrieval threshold **0.35**, chosen across all three existing retrieval sets, not a one-query
  special case. No re-ingestion, reranker or chunking change; remaining semantic misses persist.
- Retrieved text is user-role data rather than system instructions. Direct requests for internal
  instructions, personal diagnosis/prescribing, or other users' records return fixed refusals
  before generation. These narrow patterns do not replace RLS or prevent every paraphrase.

| Measurement | Before | After (same regression set, tuned) |
| --- | ---: | ---: |
| Router accuracy | 77% | 99% |
| Crisis recall | 21/25 | 25/25 |
| Provenance recall | 9/25 | 25/25 |
| Paraphrase groups correct/consistent | 7/8 | 8/8 |
| Retrieval phrase Hit Rate@5 | 12/15 | 12/15 |
| OOD with empty retrieval | 4/5 | 5/5 |

The original router regression remains 100%; the older `frozen` set is now 97% (regression,
not independent evidence). Retrieval phrase hits remain 13/15, 13/15, 12/15 across the three
sets; all 15 OOD queries are empty. The test gate remains ≥80%, not lowered.

A **new post-remediation set** (`rag_router_cases_holdout_20261117.json`, 40 questions and four
3-phrase groups) was frozen before execution. It scored **39/40 (97.5%)**, macro P **97.73%**,
macro R **97.5%**, and 4/4 paraphrase groups. **One crisis case still missed**: intent to jump
onto railway tracks. No routing fix used that result. The evaluator's macro gates exit 0,
but this does **not** satisfy the all-crises-detected safety requirement. This small set was
written by the same agent, not independent clinical reviewers.

Reproduce the supplementary router check:

```bash
venv/bin/python tests/integration/rag_router_eval.py \
  --fixtures tests/integration/fixtures/rag_router_cases_holdout_20261117.json
```

Negation/quotation suppression is deliberately deferred until counselor review. No claim of
production safety or general injection resistance follows from the passing regression gates.
