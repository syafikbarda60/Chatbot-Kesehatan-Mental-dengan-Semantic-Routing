# Dashboard - local rules

`apps/dashboard` is the active Sajiwa Next.js 16 App Router dashboard, using
workspace `@sajiwa/dashboard`. The Expo dashboard and temporary
`apps/dashboard-next` migration workspace have been retired.

## Commands

Run from the repository root:

```bash
npm run dashboard:dev
npm run dashboard:typecheck
npm run dashboard:lint
npm run dashboard:test   # unit tier for this app
npm run dashboard:build
```

Tiers and the test-first rule: [testing conventions](../../docs/testing-conventions.md).
Unit tests sit beside the source (`*.test.ts`); browser journeys live in `e2e/` at the repo
root and need the full stack up (`npm run test:e2e`).

## Architecture and security

- Keep routes under `app/(admin)/` thin; place domain logic in `features/<domain>/`.
- Use existing API-client layers and preserve authentication and authorization.
- Keep user-facing strings in the central message catalog (Indonesian default, English secondary).
- Preserve existing security headers and CSP; never expose secrets via `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_API_URL` denotes the API origin; preview mode is for development only.
- Do not reintroduce Expo dashboard files or the old `dashboard-next` workspace.

## References

- [Next.js conventions](../../docs/nextjs-conventions.md)
- [TypeScript conventions](../../docs/typescript-conventions.md)
- [React conventions](../../docs/react-conventions.md)
- [Security conventions](../../docs/security-conventions.md)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
