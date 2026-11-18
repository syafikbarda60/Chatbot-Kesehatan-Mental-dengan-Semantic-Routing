# Semantic Router conventions

Intent routing lives in `apps/backend/services/chatbot/`. Library: `semantic-router`
(`>=0.0.72`). The router is the decision layer — it picks a route; each route then has its
own handler.

## Pipeline

```
user message
   → semantic_router(message)          core.py  (the only entry point)
       ├─ is_crisis(message)?  ────────→ "guardrail"   <-- deterministic, runs FIRST
       └─ embedding match
           ├─ "guardrail"      → HARDCODED_RESPONSE             guardrail.py
           ├─ "conversational" → LLM reply                      conversational.py
           └─ "rag"            → retrieve_docs() → LLM answer   rag.py
```

After the crisis gate, `core.chat_stream` refuses direct requests to expose internal
instructions with a fixed reply. This narrow pattern check is not a complete injection defence.
A supplied `route=` cannot override deterministic crisis detection. Then it calls
`strip_profanity()` (guardrail.py):
curses-only input returns the fixed `PROFANITY_REPLY`, otherwise the stripped message
goes to the model. Crisis always wins — a profanity-laced crisis message still gets
`HARDCODED_RESPONSE`.

`core.py` builds the single router and exposes `chat_stream(user_message, session_id=None,
user_id=None, route=None)`, with `chat(...)` as that generator joined. Callers that already routed
(`routes/chat.py` does, for the guardrail decision) pass `route=` so the message is not embedded
twice; `route=None` routes internally. The HTTP layer turns the generator into SSE — see
[fastapi-conventions.md](fastapi-conventions.md).

```python
semantic_router = SemanticRouter(
    routes=[guardrail_route, conversational_route, rag_route, provenance_route],
    encoder=OllamaEncoder(name="nomic-embed-text-v2-moe"),
    top_k=10,
    aggregation="max",
    auto_sync="local",
)
```

Speech-to-intent calls are `semantic_router(message)` → `.name` is the matched route
(falls back to `"conversational"` when `None`).

## Router tuning: `max` aggregation, per-route thresholds

`core.ROUTE_THRESHOLDS` holds one decision threshold per route, set on the `Route` objects;
the library default (0.5 everywhere, `mean` aggregation, `top_k=5`) meant only the five
nearest utterances — often all from one route — were considered, and the mean diluted one
strong match with four weak neighbours. On the frozen fixtures that sent 21 of 24 misses to
the fallback instead of their route. With `aggregation="max"`, `top_k=10` and the calibrated
thresholds the labelled sets pass both macro gates.

Rules:

- Thresholds are **decision** thresholds; the evaluation pass marks live in
  `tests/integration/rag_router_eval.py` (`MACRO_PRECISION` / `MACRO_RECALL` = 0.85).
  Never lower a pass mark to make a run green.
- Calibrate on `fixtures/rag_router_cases.json` → `regression`, then check `heldout_*`.
  Adding utterances to the sets you just measured is overfitting, not generalisation.
- `is_crisis()` stays the safety boundary. A route utterance that duplicates a deterministic
  phrase ("capek hidup", "melukai keluarga") pulls ordinary messages into the crisis route on
  embedding distance alone; keep those phrases in `CRISIS_PHRASES` and out of the route.
- Every tuning change must keep `rag_router_eval.py` green, including the paraphrase
  **correctness** count and the out-of-domain checks — consistency alone can be consistently
  wrong.

## Crisis detection is NOT left to the router

`guardrail.is_crisis()` uses normalized phrases and bounded intent/action/target patterns
**before** the embedding match. Slang `bundir` folds to `bunuh diri`; farewell text is only an
additional signal when paired with a wish that others no longer need to care for the speaker.
These are heuristics, not clinical risk assessment. All four route decisions in `routes/chat.py` import `semantic_router` from
`core.py`, which is the wrapper function — so the keyword net cannot be bypassed.

The router alone is not a safety boundary. In testing it missed:

- "aku udah minum obat banyak"
- "aku pegang pisau sekarang"
- "aku mau loncat dari gedung"

and all three were handled as ordinary conversation by the LLM, with no hotline card and
nothing written to `guardrail_logs`. Embedding distance is not a safety property.

Rules when touching this:

- Add deterministic coverage first (normalization, a phrase, or a bounded pattern). Avoid
  copying every failing sentence into fuzzy utterances: that can pull ordinary distress into
  guardrail. Validate positive and negative cases. Write phrases in canonical form —
  `_normalize()` folds leet/alay spelling (`bunuh d1r1` → `bunuh diri`), letter
  elongation (`matiii` → `mati`), and slang (`gw`→`aku`, `gak`→`tidak`, `idup`→`hidup`,
  `udah`→`sudah`, `pengen`→`ingin`) before matching, so `CRISIS_PHRASES` should not
  accumulate variant spellings. Slang not in `_SLANG` still needs its own phrase or
  map entry.
- Utterances help the fuzzy matcher with paraphrases — those still want colloquial
  wording.
- Bias toward matching until a reviewed negation/quotation policy exists. False positives
  can interrupt support and create staff alerts; they are not cost-free. A false negative
  means a student in crisis may reach ordinary generation.
- Profanity is **not** a route — `PROFANITY` tokens (Indonesian + Javanese only) are
  stripped in `strip_profanity()`, with `_FILLER` dropped alongside so curses-only
  input collapses to `""` and gets `PROFANITY_REPLY`. English cursing is deliberately
  absent: llama3.2 absorbs it on its own (measured — `scripts/profanity_probe.py`),
  while it mirrors ID/JV curses back at the student. Add new tokens to `PROFANITY`,
  whole-token matching only.
- Keep the battery in `apps/backend/tests/integration/stack_smoke.py` green; it asserts every crisis phrasing is
  flagged, that the reply is the fixed hotline text, and that ordinary distress still
  reaches the normal path.

## Defining a route

Each route is a `semantic_router.Route(name, utterances=[...])`. Utterances are **Indonesian**
and are the only thing that trains the match — adding a capability usually means adding
utterances, not new branching logic.

- **guardrail** (`guardrail.py`) — self-harm / harm-to-others phrases. Handler returns the
  fixed `HARDCODED_RESPONSE` with hotlines. Never route this to an LLM.
- **conversational** (`conversational.py`) — greetings and emotional support. Persona "Sajiwa",
  warm Bahasa Indonesia `SYSTEM_PROMPT`.
- **rag** (`rag.py`) — factual mental-health questions; see
  [ollama-conventions.md](ollama-conventions.md) for retrieval + generation.
- **provenance** (`provenance.py`) — "where did you get that?", "are you a psychologist?",
  "do you have client experience?". Handler returns `provenance_reply()`, built from the
  citations actually in `documents`; the model is never asked. Left to generation, it invented
  a reading list and a client history.

## Conventions

- **Two routes never reach the LLM**: `guardrail` (crisis) and `provenance` (where the
  knowledge came from, and what the assistant is not). If an answer is something the model can
  only guess at, make it a route with a fixed reply — a prompt rule was tried for provenance and
  the 8B model rephrased the same invention ("aku telah membaca banyak buku pengembangan diri").
  A fixed reply also answers instantly, without a 2-minute generation.
- Keep one file per route; export the `Route` object and its handler.
- `semantic_router` is a module-level singleton in `core.py` — don't rebuild per request.
- `auto_sync="local"`; the router embeds every route utterance when it is constructed, so a dead
  Ollama raises at **import** and the backend refuses to start (no zero-vector fallback — that would
  mis-route silently). See [ollama-conventions.md](ollama-conventions.md).
- Expose results over HTTP as `{ route, is_high_risk, response }` (`routes/chat.py`).
- Every chatbot file has an `if __name__ == "__main__":` block of sample utterances to
  smoke-test routing. Use it when tuning utterances.
