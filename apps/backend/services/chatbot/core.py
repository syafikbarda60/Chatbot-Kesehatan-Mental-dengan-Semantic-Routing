from dataclasses import dataclass

from semantic_router import SemanticRouter
from semantic_router.encoders import OllamaEncoder
from services.chatbot.guardrail import (
    guardrail_route,
    HARDCODED_RESPONSE,
    is_crisis,
    strip_profanity,
    PROFANITY_REPLY,
)
from services.chatbot.conversational import conversational_route, build_messages as conversational_messages
from services.chatbot.history import load_history
from services.chatbot.llm import llm
from services.chatbot.provenance import provenance_route, provenance_reply, PROVENANCE_ROUTE
from services.chatbot.rag import (
    rag_route,
    build_messages as rag_messages,
    NO_CONTEXT_REPLY,
    EMBED_MODEL,
)

# No fallback encoder: OllamaEncoder() does not raise here, it raises inside SemanticRouter's
# first embed — so a dead Ollama fails loudly at import instead of silently mis-routing. A
# zero-vector mock only looks like graceful degradation; every message would match the same route.
encoder = OllamaEncoder(name=EMBED_MODEL)

_router = SemanticRouter(
    routes=[guardrail_route, conversational_route, rag_route, provenance_route],
    encoder=encoder,
    auto_sync="local"
)


@dataclass
class RouteResult:
    name: str | None


def semantic_router(message: str) -> RouteResult:
    """Route a message, checking crisis phrases deterministically before the fuzzy match.

    Every route decision in the API goes through here, so the keyword net cannot be
    bypassed by a paraphrase the router fails to match (see guardrail.is_crisis).
    """
    if is_crisis(message):
        return RouteResult(name="guardrail")
    return _router(message)


def chat_stream(
    user_message: str,
    session_id: str | None = None,
    user_id: str | None = None,
    route: str | None = None,
):
    """Yield the reply in chunks. `chat()` is this joined, so the two paths cannot drift.

    `route` is accepted so callers that already routed do not pay for it twice.
    """
    route = route or (semantic_router(user_message).name or "conversational")

    if route == "guardrail":
        yield HARDCODED_RESPONSE
        return

    # Deterministic: asked where its knowledge comes from, the model invented sources and a
    # clinical background. The corpus is the only honest answer, and it is a database read.
    if route == PROVENANCE_ROUTE:
        yield provenance_reply()
        return

    # After the crisis gate: strip ID/JV curses so the model never mirrors them back
    # (measured — see guardrail.PROFANITY). Pure-curse input gets the fixed reply.
    message = strip_profanity(user_message)
    if not message:
        yield PROFANITY_REPLY
        return

    history = load_history(session_id, user_id)

    if route == "rag":
        messages = rag_messages(message, history)
        if messages is None:
            yield NO_CONTEXT_REPLY
            return
    else:
        messages = conversational_messages(message, history)

    for chunk in llm.stream(messages):
        if chunk.content:
            yield chunk.content


def chat(
    user_message: str,
    session_id: str | None = None,
    user_id: str | None = None,
    route: str | None = None,
) -> str:
    return "".join(chat_stream(user_message, session_id=session_id, user_id=user_id, route=route))

if __name__ == "__main__":
    tests = [
        "saya mau bunuh diri",
        "saya tidak mau hidup lagi",
        "saya ingin menyakiti diri sendiri",
        "halo aku lagi sedih",
        "aku ngerasa sendirian banget",
        "aku butuh teman bicara",
        "apa itu depresi?",
        "gejala depresi apa saja?",
        "bagaimana cara mengatasi depresi?",
    ]
    for t in tests:
        print(f"User : {t}")
        print(f"Bot  : {chat(t)}\n")
