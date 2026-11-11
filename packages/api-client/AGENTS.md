# @prototype/api-client

Fetch wrappers for the FastAPI backend + cross-platform storage (web/mobile). Consumed as
TS source (`main: src/index.ts`) — no build step, no tests/linter here.

- New endpoints go in the matching module (`admin.ts`, `iteration3.ts`, `iteration4.ts`);
  auth headers, JSON handling, and base URL live in `api.ts` — don't spread them.
- `storage.ts` is the only place touching `localStorage`/`AsyncStorage`.
- `apiChatStream` reads SSE with `expo/fetch`, not the global `fetch` (RN's buffers the whole
  response, so streaming would arrive in one lump). It throws `stream terputus` on a stream that
  ends without `[DONE]` — that is deliberate: a dropped connection must not look like a finished
  answer. The backend's `/chat/stream` always terminates with `data: [DONE]`.

Conventions: [typescript](../../docs/typescript-conventions.md),
[npm workspaces](../../docs/npm-workspaces-conventions.md).
