"""RAG retrieval gate — Hit Rate@5, out-of-domain behaviour, and per-query latency.

Runs the real `services.chatbot.rag.retrieve_docs` (Ollama embeddings + PostgreSQL +
pgvector) over `fixtures/rag_retrieval_cases.json`.

    cd apps/backend
    venv/bin/python tests/integration/rag_retrieval_eval.py

Exit codes: 0 all gates pass, 1 a gate failed, 2 the stack is not available (SKIP).
"""

import argparse
import json
import os
import statistics
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "rag_retrieval_cases.json")
# Gate values are documented in docs/rag-semantic-routing-testing.md.
HIT_RATE = 0.80
MAX_SECONDS = 3.0


def skip(reason: str) -> None:
    print(f"SKIP retrieval evaluation: {reason}")
    sys.exit(2)


def stack_problem() -> str | None:
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3) as response:
            models = {m["name"] for m in json.load(response)["models"]}
    except Exception as error:
        return f"Ollama is not reachable ({error})"
    if "nomic-embed-text-v2-moe:latest" not in models:
        return "embedding model nomic-embed-text-v2-moe is not pulled"
    try:
        from core.db import query
        query("select 1 from documents limit 1")
    except Exception as error:
        return f"database is not reachable ({error})"
    return None


def normalize(text: str) -> str:
    return " ".join(text.lower().split())


def main() -> int:
    parser = argparse.ArgumentParser(description="RAG retrieval gate.")
    parser.add_argument("--fixtures", default=FIXTURES)
    args = parser.parse_args()

    problem = stack_problem()
    if problem:
        skip(problem)

    from core.db import query
    from services.chatbot.rag import NO_CONTEXT_REPLY, build_messages, retrieve_docs

    with open(args.fixtures, encoding="utf-8") as handle:
        cases = json.load(handle)

    corpus = query(
        "select count(*) as chunks, min(vector_dims(embedding)) as dims_min, "
        "max(vector_dims(embedding)) as dims_max, max(length(content)) as longest "
        "from documents where metadata->>'source' = %s", (cases["source"],))[0]
    print(f"corpus: {corpus}")

    passed = True
    hits, latencies = 0, []
    print("\n== in-domain ==")
    for case in cases["in_domain"]:
        started = time.monotonic()
        docs = retrieve_docs(case["query"], k=cases["k"])
        elapsed = time.monotonic() - started
        latencies.append(elapsed)
        matched = [
            index for index, doc in enumerate(docs)
            if doc.get("metadata", {}).get("source") == cases["source"]
            and any(all(normalize(term) in normalize(doc["content"]) for term in group)
                    for group in case["groups"])
        ]
        hit = bool(matched)
        hits += hit
        scores = [round(float(doc["similarity"]), 3) for doc in docs]
        print(f"  {'HIT ' if hit else 'MISS'} {elapsed:5.3f}s ranks={matched or '-'} scores={scores} {case['query']!r}")
        if elapsed >= MAX_SECONDS:
            print(f"  GATE FAILED latency {elapsed:.3f}s >= {MAX_SECONDS}s")
            passed = False
        if len(docs) > cases["k"]:
            print(f"  GATE FAILED {len(docs)} results > k={cases['k']}")
            passed = False
        if any(float(doc["similarity"]) <= cases["min_similarity"] for doc in docs):
            print("  GATE FAILED a result is at or below the similarity threshold")
            passed = False
        if any(doc.get("metadata", {}).get("citation") != cases["citation"] for doc in docs):
            print("  GATE FAILED a result is missing the expected citation")
            passed = False

    hit_rate = hits / len(cases["in_domain"])
    print(f"\nHit Rate@{cases['k']} = {hits}/{len(cases['in_domain'])} = {hit_rate:.1%} "
          f"(gate >= {HIT_RATE:.0%})")
    if hit_rate < HIT_RATE:
        print("  GATE FAILED Hit Rate below the gate")
        passed = False

    print("\n== out of domain ==")
    for text in cases["out_of_domain"]:
        docs = retrieve_docs(text, k=cases["k"])
        status = "PASS" if not docs else "FAIL"
        print(f"  {status} {len(docs)} result(s) {text!r}")
        if docs:
            passed = False
    for text in cases["out_of_domain"]:
        if build_messages(text) is not None:
            print(f"  GATE FAILED a prompt was built without retrieved context for {text!r}")
            passed = False
    if build_messages(cases["out_of_domain"][0]) is None:
        print(f"  PASS empty context yields the fixed reply path ({NO_CONTEXT_REPLY[:40]!r}...)")
    else:
        print("  GATE FAILED empty retrieval still built a prompt")
        passed = False

    if latencies:
        ordered = sorted(latencies)
        p95 = ordered[min(len(ordered) - 1, round(0.95 * (len(ordered) - 1)))]
        print(f"\nlatency: n={len(latencies)} mean={statistics.mean(ordered):.3f}s "
              f"p95={p95:.3f}s max={max(ordered):.3f}s")

    print("\nALL PASSED" if passed else "\nFAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
