#!/usr/bin/env sh
# Integration tier: the API against the real stack (Postgres, Ollama, uvicorn).
#
#   npm run test:integration          (from the repo root)
#
# Skips loudly when the stack is not up, so a unit-only run is never blocked by it.
set -e
cd "$(dirname "$0")/../.."

if ! docker info >/dev/null 2>&1; then
  echo "SKIP integration: docker is not running (RLS self-check and live API not exercised)"
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx sajiwa-db; then
  echo "SKIP integration: the sajiwa-db container is not up (docker compose up -d)"
  exit 0
fi

# Runs an evaluator that exits 2 when its own dependencies are missing (Ollama, corpus).
run_eval() {
  status=0
  venv/bin/python "$@" || status=$?
  case "$status" in
    0) ;;
    2) echo "SKIP $1: its dependencies are not available (see the line above)" ;;
    *) exit "$status" ;;
  esac
}

venv/bin/python tests/integration/stack_smoke.py

# Router quality gates (macro precision/recall, paraphrase correctness, out-of-domain).
run_eval tests/integration/rag_router_eval.py

# Retrieval gates (Hit Rate@5, no-context behaviour, latency) against the stored corpus.
run_eval tests/integration/rag_retrieval_eval.py

# Previously failing evaluation sets are now regression fixtures, not unseen evidence.
run_eval tests/integration/rag_router_eval.py --fixtures tests/integration/fixtures/rag_router_cases_remediation.json
run_eval tests/integration/rag_retrieval_eval.py --fixtures tests/integration/fixtures/rag_retrieval_cases_remediation.json

docker exec -i -e PGPASSWORD=sajiwa_app sajiwa-db \
  psql -v ON_ERROR_STOP=1 -U sajiwa_app -d sajiwa < ../../db/test_rls.sql
