# Sajiwa administrator dashboard

The production administrator frontend is a Next.js application at `apps/dashboard`.

## Local commands

Run dependency installation from the repository root, then:

```powershell
npm run dashboard:dev
npm run dashboard:typecheck
npm run dashboard:lint
npm run dashboard:test
npm run dashboard:build
```

Unit tests run with `npm run dashboard:test`. The browser journeys that exercise this app
live in `e2e/` at the repository root (`npm run test:e2e`, full stack required). See
[testing conventions](../../docs/testing-conventions.md).

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the FastAPI origin. This public variable must contain an origin only, never a token, database URL, or secret.

For a frontend-only local preview, set `NEXT_PUBLIC_PREVIEW_MODE=true` in `.env.local` and run `npm run dev`. Preview mode is accepted only when `NODE_ENV=development`; production builds ignore the flag. It supplies an obviously synthetic administrator and centralized fictional data without contacting FastAPI or storing a fake token. Open `http://localhost:3000/overview`.

The application includes the responsive shell, authentication/session integration, role guard, theme and language preferences, operational overview, monitoring, student management, counseling, counselor management, analytics, assessment instruments, emergency contacts, and settings.

The current FastAPI contract issues bearer tokens and has no refresh-token or HttpOnly-cookie flow. The dashboard therefore keeps the token in per-tab `sessionStorage`, validates it through `/auth/me` on startup, and clears it when an authenticated request returns 401. Tokens are never placed in URLs, rendered markup, or application logs.
