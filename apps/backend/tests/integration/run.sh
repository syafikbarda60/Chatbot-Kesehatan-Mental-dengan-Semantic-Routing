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

venv/bin/python tests/integration/stack_smoke.py
docker exec -i -e PGPASSWORD=sajiwa_app sajiwa-db \
  psql -v ON_ERROR_STOP=1 -U sajiwa_app -d sajiwa < ../../db/test_rls.sql
