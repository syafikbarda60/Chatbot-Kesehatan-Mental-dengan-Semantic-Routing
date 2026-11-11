"""Prompt history assembly, kept free of the semantic router so it stays cheap to import.

`core.py` builds a SemanticRouter at import time (and embeds every utterance), so anything
importing it needs a live Ollama and an ENCRYPTION_KEY. This module needs neither, which is
what lets `tests/test_chat_history.py` check the crisis filter without a model.
"""

from langchain_core.messages import AIMessage, HumanMessage

from core.db import query
from core.security import decrypt_text

# How much history is prepended to the prompt. HISTORY_CHAR_CAP stands in for a token count —
# no tokenizer dependency, and it keeps the prompt under OLLAMA_NUM_CTX.
HISTORY_TURNS = 10
HISTORY_CHAR_CAP = 4000

# Both rows of a crisis exchange carry this route (routes/chat.py).
GUARDRAIL_ROUTE = "guardrail"


def load_history(session_id: str | None, user_id: str | None) -> list:
    """Recent turns for the prompt, oldest first. Never returns crisis content.

    The `route_used is distinct from 'guardrail'` filter is a safety requirement, not an
    optimisation: docs/ollama-conventions.md forbids sending guardrail (crisis) messages to the
    LLM, and `is distinct from` also covers legacy rows where route_used is NULL.
    """
    if not session_id or not user_id:
        return []

    rows = query(
        "select role, content from messages "
        "where session_id = %s and route_used is distinct from %s "
        "order by created_at desc, role limit %s",
        (session_id, GUARDRAIL_ROUTE, HISTORY_TURNS), user_id=user_id,
    )

    # `role` breaks ties within a turn: both rows share one transaction timestamp, and
    # newest-first this puts the reply before the question, so reversing restores turn order.

    # Walk newest-first so exhausting the budget drops the *oldest* turns, then reverse for the
    # prompt. Breaking instead of truncating is deliberate: a half message reads worse than none.
    taken, budget = [], HISTORY_CHAR_CAP
    for row in rows:
        try:
            text = decrypt_text(row["content"])
        except Exception:
            continue                    # one unreadable row must not break the request
        if not text:
            continue
        if len(text) > budget:
            break
        budget -= len(text)
        taken.append(HumanMessage(text) if row["role"] == "user" else AIMessage(text))
    # A killed /chat/stream leaves the newest row as an unanswered user message; the retry
    # re-adds it as the current HumanMessage, so drop it instead of sending it twice. Only when
    # the newest stored row is that user turn — an unreadable newer reply must not trigger this.
    if rows and rows[0]["role"] == "user" and taken and isinstance(taken[0], HumanMessage):
        taken.pop(0)
    return list(reversed(taken))
