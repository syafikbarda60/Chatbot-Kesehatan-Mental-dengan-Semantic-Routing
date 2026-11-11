# npm workspaces conventions

Root `package.json` declares `workspaces: ["apps/*", "packages/*"]`. Shared code is imported
as `@prototype/*` and has **no build step** — each package's `main` points at `src/index.ts`,
so Metro/Node pick up source edits directly.

## Shared packages

### `@prototype/api-client` (`packages/api-client`)

The single HTTP layer. `src/api.ts` wraps `fetch` with base URL, JSON headers, optional Bearer:

```ts
apiFetch<T>(path, { method, body, auth = true, base })  // auth defaults true
```

- Add one typed helper per backend endpoint (`apiChatStream`, `apiSubmitAssessment`, `apiSaveJournal`, ...).
- Export request/response interfaces next to the helper.
- Streaming endpoints use `apiChatStream`, which reads the SSE body with `expo/fetch` (React Native's
  global `fetch` buffers the whole response; on web that module is just `globalThis.fetch`) and
  throws if the stream ends without `[DONE]` — a bare close is a truncated reply.
- `auth: false` for login/register/hotline/guardrail.
- `apiLogin` persists token + user via `src/storage.ts`.
- `src/admin.ts`, `src/admin-operations.ts`, `src/iteration3.ts`, and `src/iteration4.ts` hold the
  dashboard/assessment helpers (`apiGetAdminAssessments`, `apiGetUserDetail`, `apiGetAttention`,
  `apiGetHotlines`, `apiGetAnalytics`, `apiGetInstrumentVersion`, `apiSaveInstrumentDraft`,
  `apiSubmitInstrumentAssessment`, `apiGetComparisonAnalytics`,
  `apiGetMultiCounselorCalendar`, ...) and their row/page interfaces. `src/index.ts` re-exports
  every module.
- Failed requests throw `ApiError` (an `Error` subclass carrying `status`); the dashboard client
  maps the status to a safe Bahasa Indonesia message (`apps/dashboard/lib/api/client.ts`).

`src/storage.ts` is the cross-platform token store: `localStorage` on web, `AsyncStorage` on
native. Keys `sajiwa_token`, `sajiwa_user`. Use `getStoredUser` / `clearAuth`; the `*Sync`
variants exist only for the web dashboard.

### `@prototype/ui-shared` (`packages/ui-shared`)

- `theme.ts` — `SajiwaColors` (Material-3 palette) + typography.
- `ThemeContext.tsx` — `ThemeProvider` / theme hook.
- `useAuth.ts` — `useAuth()` state machine (load persisted user, `login`, `logout`).
- `useAnimatedEntrance.ts` — shared entrance animation.

### `@prototype/utils` (`packages/utils`)

- `stressDetection.ts` — keyword-based stress scoring from chat text.
- `aiResponses.ts` — fallback/local response parsers.
- `characterReaction.ts` — companion expression picked from the user's message (crisis-safe mapping).
- `phone.ts` — dialable-number / extension helpers for hotline `tel:` links.

## Conventions

- Edit `src/`; re-export from `src/index.ts` (the only file consumers touch).
- Consume as `@prototype/<name>` — never deep-import `src/...` from an app.
- Run `npm install` from the **root**, not inside an app. Workspaces link through root
  `node_modules`; apps' `metro.config.js` is tuned for it
  ([expo-conventions.md](expo-conventions.md)).
- Avoid duplicating a dependency in both an app and a package; declare it once where it is used.

## Run the workspace

```bash
npm install            # root: installs all workspaces
npm run <script>       # scripts are per-app (see expo-conventions / development-conventions)
```
