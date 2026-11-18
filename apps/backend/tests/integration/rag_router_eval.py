"""Semantic-router quality gate — the frozen fixtures, through the real router.

Runs the actual `services.chatbot.core.semantic_router` (real Ollama embeddings, real
crisis gate, no mocks) over `fixtures/rag_router_cases.json` and fails loudly when a gate
is missed. Retrieval and generation are covered in `stack_smoke.py`, not here.

    cd apps/backend
    venv/bin/python tests/integration/rag_router_eval.py

Exit codes: 0 all gates pass, 1 a gate failed, 2 the stack is not available (SKIP).
"""

import argparse
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "rag_router_cases.json")
LABELS = ("guardrail", "conversational", "rag", "provenance")
# Gate values are documented in docs/rag-semantic-routing-testing.md.
MACRO_PRECISION = 0.85
MACRO_RECALL = 0.85


def skip(reason: str) -> None:
    print(f"SKIP router evaluation: {reason}")
    sys.exit(2)


def ollama_problem() -> str | None:
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3) as response:
            models = {m["name"] for m in json.load(response)["models"]}
    except Exception as error:
        return f"Ollama is not reachable ({error})"
    if "nomic-embed-text-v2-moe:latest" not in models:
        return "embedding model nomic-embed-text-v2-moe is not pulled"
    return None


def route(router, is_crisis, text: str) -> str:
    # The deterministic gate is part of the product decision, exactly as chat.py uses it.
    return "guardrail" if is_crisis(text) else (router(text).name or "conversational")


def evaluate(case_set: dict, name: str, router, is_crisis, gates: bool) -> bool:
    print(f"\n== {name} ==")
    rows = [(label, route(router, is_crisis, text), text)
            for label in LABELS for text in case_set.get(label, [])]
    per = {label: {"tp": 0, "fp": 0, "fn": 0} for label in LABELS}
    for expected, predicted, _ in rows:
        if expected == predicted:
            per[expected]["tp"] += 1
        else:
            per[expected]["fn"] += 1
            if predicted in per:
                per[predicted]["fp"] += 1

    print("| expected \\ predicted | " + " | ".join(LABELS) + " |")
    print("| --- |" + " ---: |" * len(LABELS))
    for expected in LABELS:
        print(f"| {expected} | " + " | ".join(
            str(sum(1 for e, p, _ in rows if e == expected and p == predicted)) for predicted in LABELS) + " |")

    precisions, recalls = [], []
    for label, counts in per.items():
        precision = counts["tp"] / (counts["tp"] + counts["fp"]) if counts["tp"] + counts["fp"] else 0.0
        recall = counts["tp"] / (counts["tp"] + counts["fn"]) if counts["tp"] + counts["fn"] else 0.0
        precisions.append(precision)
        recalls.append(recall)
        print(f"  {label:14} precision={precision:.3f} recall={recall:.3f}")
    macro_p, macro_r = sum(precisions) / len(precisions), sum(recalls) / len(recalls)
    accuracy = sum(1 for expected, predicted, _ in rows if expected == predicted) / len(rows)
    print(f"  macro precision={macro_p:.3f} macro recall={macro_r:.3f} accuracy={accuracy:.3f}")
    for expected, predicted, text in rows:
        if expected != predicted:
            print(f"  MISS expected={expected:14} got={predicted:14} {text!r}")

    passed = True
    if gates:
        for label, value, gate in (("macro precision", macro_p, MACRO_PRECISION),
                                   ("macro recall", macro_r, MACRO_RECALL)):
            if value < gate:
                print(f"  GATE FAILED {label} {value:.3f} < {gate}")
                passed = False

    if "paraphrases" in case_set:
        print(f"\n== {name}: paraphrases (consistency and correctness) ==")
        consistent = correct = 0
        for expected, group in case_set["paraphrases"]:
            predictions = [route(router, is_crisis, text) for text in group]
            consistent += len(set(predictions)) == 1
            correct += all(p == expected for p in predictions)
            print(f"  {'PASS' if all(p == expected for p in predictions) else 'FAIL'} "
                  f"{expected:14} {predictions}")
        total = len(case_set["paraphrases"])
        print(f"  consistent={consistent}/{total} correct={correct}/{total}")
        if gates and (consistent != total or correct != total):
            print(f"  GATE FAILED paraphrases consistent={consistent}/{total} correct={correct}/{total}")
            passed = False
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description="Semantic-router quality gate.")
    parser.add_argument("--fixtures", default=FIXTURES,
                        help="fixture file; a flat set (labels + paraphrases) runs as one gated set")
    args = parser.parse_args()

    problem = ollama_problem()
    if problem:
        skip(problem)
    from services.chatbot.core import semantic_router  # builds the real router
    from services.chatbot.guardrail import is_crisis

    with open(args.fixtures, encoding="utf-8") as handle:
        cases = json.load(handle)

    if "regression" not in cases:
        passed = evaluate(cases, os.path.basename(args.fixtures), semantic_router, is_crisis, gates=True)
        print("\nALL PASSED" if passed else "\nFAILED")
        return 0 if passed else 1

    regression = dict(cases["regression"], paraphrases=cases["regression_paraphrases"])
    passed = evaluate(regression, "regression (calibration set)", semantic_router, is_crisis, gates=True)
    for name in ("heldout_v1", "heldout_v2"):
        passed &= evaluate(cases[name], name, semantic_router, is_crisis, gates=False)

    print("\n== out of domain (must not route to rag/provenance) ==")
    bad = [text for text in cases["out_of_domain"]
           if route(semantic_router, is_crisis, text) in ("rag", "provenance")]
    for text in cases["out_of_domain"]:
        print(f"  {'FAIL' if text in bad else 'PASS'} {route(semantic_router, is_crisis, text):14} {text!r}")
    if bad:
        print(f"  GATE FAILED {len(bad)} out-of-domain question(s) routed to rag/provenance")
        passed = False

    print("\nALL PASSED" if passed else "\nFAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
