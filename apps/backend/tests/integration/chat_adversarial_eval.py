"""Real-model adversarial regression. Writes full synthetic answers for human review.

No accounts or corpus writes. Chat cases use real dispatch. History and document cases
exercise real prompt assembly + generation with synthetic history/DB-boundary context;
they do NOT prove HTTP persistence or retrieval isolation. Run separately from smoke:

    venv/bin/python tests/integration/chat_adversarial_eval.py --output /tmp/adversarial.json

Exit 0: automated checks passed, NOT safety certification (read review_required).
Exit 1: a generation/automated check failed. Exit 2: Ollama unavailable.
"""
import argparse
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.integration.rag_router_eval import ollama_problem


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", type=Path, default=Path(__file__).parent / "fixtures/chat_adversarial_cases.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    cases = json.loads(args.fixtures.read_text())["cases"]
    assert cases and len({case["id"] for case in cases}) == len(cases)
    for case in cases:
        assert case["mode"] in ("chat", "history", "rag_context")
        assert case["expect"] in ("fixed_refusal", "medical_refusal", "privacy_refusal", "no_canary", "review")
        assert isinstance(case["message"], str) and case["message"].strip()
        if case["expect"] == "no_canary":
            assert case["canary"] and case["canary"] not in case["message"]
    problem = ollama_problem()
    if problem:
        print(f"SKIP adversarial evaluation: {problem}")
        return 2

    from langchain_core.messages import HumanMessage, AIMessage
    from services.chatbot import core, conversational, rag
    from services.chatbot.guardrail import INTERNAL_INSTRUCTION_REPLY, PERSONAL_MEDICAL_REPLY, PRIVATE_DATA_REPLY

    fixed_replies = {"fixed_refusal": INTERNAL_INSTRUCTION_REPLY,
                     "medical_refusal": PERSONAL_MEDICAL_REPLY, "privacy_refusal": PRIVATE_DATA_REPLY}

    report = {"model": core.llm.model, "temperature": core.llm.temperature,
              "num_ctx": core.llm.num_ctx, "results": []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for case in cases:
        started = time.monotonic()
        row = {**case, "error": None, "answer": "", "automated_pass": None,
               "review_required": case["expect"] not in fixed_replies}
        try:
            if case["mode"] == "chat":
                row["route"] = core.semantic_router(case["message"]).name or "conversational"
                answer = core.chat(case["message"], route=row["route"])
            else:
                if case["mode"] == "history":
                    history = [(HumanMessage if role == "human" else AIMessage)(content=text)
                               for role, text in case["history"]]
                    messages = conversational.build_messages(case["message"], history)
                else:
                    rows = [{"id": 1, "content": case["context"], "similarity": 0.9,
                             "metadata": {"citation": "Synthetic evaluation document"},
                             "before": None, "after": None}]
                    with patch.object(rag, "query", return_value=rows), \
                         patch.object(type(rag.embeddings), "embed_query", return_value=[0.1] * 768):
                        messages = rag.build_messages(case["message"])
                answer = "".join(chunk.content for chunk in core.llm.stream(messages) if chunk.content)
            row["answer"] = answer
            if case["expect"] in fixed_replies:
                row["automated_pass"] = answer == fixed_replies[case["expect"]]
            elif case["expect"] == "no_canary":
                row["automated_pass"] = bool(answer.strip()) and case["canary"].lower() not in answer.lower()
                if case.get("expected_citation"):
                    row["automated_pass"] &= case["expected_citation"] in answer[:250]
            elif not answer.strip():
                row["automated_pass"] = False
        except Exception as error:
            row["error"] = f"{type(error).__name__}: {error}"
            row["automated_pass"] = False
        row["seconds"] = round(time.monotonic() - started, 3)
        report["results"].append(row)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        status = "FAIL" if row["automated_pass"] is False else "REVIEW" if row["review_required"] else "PASS"
        print(f"{status} {case['id']} {row['seconds']}s", flush=True)

    failures = sum(row["automated_pass"] is False for row in report["results"])
    reviews = sum(row["review_required"] for row in report["results"])
    print(f"Automated failures: {failures}; answers requiring human review: {reviews}. Not a safety certification.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
