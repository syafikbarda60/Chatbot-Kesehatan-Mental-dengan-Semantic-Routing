import os

from langchain_ollama import ChatOllama

# Single client for every generation call (conversational.py, rag.py). Defaults are all
# deliberate: num_ctx bounds prompt growth now that history is prepended, the keep-alive
# avoids reloading the model per request, and the httpx timeout stops a dead Ollama from
# parking a threadpool worker forever.
#
# 300s, not 60s: on the CPU-only reference machine (Ryzen 5 7520U, 8B Q4_K_M) a RAG answer
# measured 81-181s, so a 60s read timeout aborted the stream mid-answer and surfaced as
# `generation_failed`. The response-time target is tracked separately; a slow machine must
# not turn a long answer into an error. Raise it only if the measured ceiling grows.
# The team's fine-tuned 8B is the default; OLLAMA_CHAT_MODEL=llama3.2:3b is the lighter
# fallback when RAM is short, at a clear cost in coherence in Bahasa Indonesia.
llm = ChatOllama(
    model=os.getenv("OLLAMA_CHAT_MODEL", "llama3-8b-instruct:Q4_K_M"),
    temperature=float(os.getenv("OLLAMA_TEMPERATURE", "0.6")),
    num_ctx=int(os.getenv("OLLAMA_NUM_CTX", "4096")),
    keep_alive="10m",
    client_kwargs={"timeout": float(os.getenv("OLLAMA_TIMEOUT", "300"))},
)
