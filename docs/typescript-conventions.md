# TypeScript conventions

All frontend/package code is **TypeScript 5.9** with `"strict": true`.

## Config

- `apps/mobile/tsconfig.json` extends `expo/tsconfig.base`; `apps/dashboard/tsconfig.json` is
  standalone Next.js config (`jsx: react-jsx`, `moduleResolution: bundler`).
- `@/*` resolves relative to the app root (e.g. `@/components/themed-text`, `@/constants/theme`).
- Shared packages have **no tsconfig and no build step**: `main` points at `src/index.ts`
  ([npm-workspaces-conventions.md](npm-workspaces-conventions.md)).

## Conventions

- `strict` is on — handle `null`/`undefined` explicitly.
- Export an `interface` next to each API helper for its payload/response (`ChatPayload`, `JournalPayload`,
  `DashboardData`, `LoginResponse`, ...). Prefix option-bag interfaces with the function (`FetchOptions`).
- Use `type` for unions/aliases (`role: 'mahasiswa' | 'konselor' | ...`), `interface` for object shapes.
- Prefer `unknown` over `any` in new code; the codebase has some legacy `any` (e.g. `apiRegister(payload: any)`) —
  don't copy it.
- `import type { ... }` for type-only imports.
- Files: components `PascalCase.tsx`, hooks/utilities `camelCase.ts`, barrels `index.ts`.
- Avoid `enum`; use string-literal unions to match Pydantic `Literal`s on the backend.
- Dashboard lint: ESLint 9 flat config with `eslint-config-next`, run via `npm run dashboard:lint`.
