# Expo conventions

The student application is TypeScript on **Expo SDK 54** with **expo-router**:

- `apps/mobile` — Expo React Native 0.81, student app (`newArchEnabled: false`).

The administrator dashboard at `apps/dashboard` is Next.js and does not follow Expo bundling conventions.

Core React Native rules live in [react-native-conventions.md](react-native-conventions.md); routing in
[expo-router-conventions.md](expo-router-conventions.md).

## Expo modules in use

| Module | Use |
|--------|-----|
| `expo-router` | routing/navigation |
| `expo-font` + `@expo-google-fonts/plus-jakarta-sans` | Plus Jakarta Sans |
| `expo-splash-screen` | splash / `AnimatedSplashScreen` |
| `expo-status-bar` | status bar |
| `expo-linear-gradient`, `expo-blur` | visual effects |
| `@expo/vector-icons` | icons |
| `expo-haptics`, `expo-linking` | haptics, deep links |

## `app.json` config

- Plugins and deep-link configuration are defined by `apps/mobile/app.json`.
- Env is `EXPO_PUBLIC_*` only ([security-conventions.md](security-conventions.md)).

## Components

- Local UI kit in `apps/mobile/components/ui/` plus feature folders under `components/<feature>/`,
  each with an `index.ts` barrel; shared theme/typography from `@prototype/ui-shared` —
  see [react-native-ui-conventions.md](react-native-ui-conventions.md).
- Components are `PascalCase.tsx`; hooks are `useX.ts`.

## Data & state

- All network calls go through `@prototype/api-client` — never `fetch` directly in a screen.
- Auth via `useAuth()` from `@prototype/ui-shared`; chat logic in `apps/mobile/hooks/useChat.ts`.

## Env

`apps/mobile/.env` holds `EXPO_PUBLIC_*` only. `API_BASE_URL` in `api-client` defaults to
`http://localhost:8000` (Android emulator: `http://10.0.2.2:8000`), overridable at build time with
`EXPO_PUBLIC_API_URL`. Never expose backend secrets — [security-conventions.md](security-conventions.md).

## Run

```bash
cd apps/mobile     && npx expo start   # a = Android, i = iOS, w = web
```

## Monorepo gotcha

The mobile app's `metro.config.js` sets `watchFolders = [workspaceRoot]`, `nodeModulesPaths` for root +
app, and `disableHierarchicalLookup = true`. Keep this when touching mobile bundler config so
`@prototype/*` resolves. See [npm-workspaces-conventions.md](npm-workspaces-conventions.md).
