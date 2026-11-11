// E2E tier runner — drives the real dashboard in a real browser through betterwright.
//
// One journey per file in e2e/scenarios/. Each runs in its own browser session
// (`e2e-<name>`) and the session is closed afterwards, so no journey can depend on state
// another one left behind. Skips loudly when the stack is not up: a skipped E2E run must be
// visible, never a silent pass.
//
//   npm run test:e2e
//
// Requirements: docker compose up -d, uvicorn on :8000 (with Ollama), `next dev` on :3000,
// and seeded dev accounts (apps/backend/scripts/seed_dev_users.py).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DASHBOARD = 'http://localhost:3000';
const API = 'http://localhost:8000';

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

const missing = [];
if (!(await reachable(`${DASHBOARD}/login`))) missing.push(`dashboard ${DASHBOARD} (npm run dashboard:dev)`);
if (!(await reachable(`${API}/health`))) missing.push(`api ${API} (docker compose up -d, then venv/bin/uvicorn main:app)`);

if (missing.length) {
  console.log(`SKIP e2e: not reachable — ${missing.join(', ')}`);
  process.exit(0);
}

const scenarios = readdirSync(new URL('./scenarios/', import.meta.url))
  .filter((file) => file.endsWith('.mjs'))
  .sort();

const failures = [];
for (const file of scenarios) {
  const name = file.replace(/\.mjs$/, '');
  const run = spawnSync(
    'betterwright',
    ['run', fileURLToPath(new URL(`./scenarios/${file}`, import.meta.url)), '--session', `e2e-${name}`, '--close'],
    { encoding: 'utf8' },
  );

  let report = null;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    report = { ok: false, error: (run.stderr || run.stdout || 'no output').trim().slice(0, 400) };
  }

  const passed = report.ok === true;
  const detail = passed ? JSON.stringify(report.result ?? null) : report.error;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${passed ? '' : `  -> ${detail}`}`);
  if (!passed) failures.push(name);
}

console.log(`\n${scenarios.length - failures.length}/${scenarios.length} journeys passed`);
process.exit(failures.length ? 1 : 0);
