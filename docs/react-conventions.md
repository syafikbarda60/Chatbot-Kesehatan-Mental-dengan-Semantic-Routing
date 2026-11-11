# React conventions

**React 19** is used in both frontend apps (and `react-dom` for the Next.js dashboard). Function components + hooks only.

## Conventions

- Function components, one per file, named after the file (`Button.tsx` → `export function Button`).
- Hooks: built-ins (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`); custom hooks are
  `useX` and live in `hooks/` or a shared package (`useAuth`, `useChat`, `useAnimatedEntrance`,
  `useColorScheme`, `useThemeColor`).
- Memoize callbacks passed to effects/children with `useCallback`; derive values with `useMemo`
  rather than recalculating in render.
- Global state via **React Context**, not a state library: `ThemeProvider` / `ThemeContext` in
  `@prototype/ui-shared`; consume with the exported hook.
- Effects that load persisted data run once on mount (see `useAuth`); always clean up subscriptions.
- Use `"use client"` only for dashboard components that require browser APIs, state, effects, or event handlers.
- The mobile application remains Expo Router; dashboard routes use the Next.js App Router.

## Component composition

- Presentational components in `components/`; feature folders (`components/chat/`, `components/home/`)
  re-export via `index.ts`.
- Mobile screens own data-fetching (via `@prototype/api-client`); dashboard features fetch through
  `apps/dashboard/lib/api/client.ts`. Pass props down.
- Prefer composition/props over inheritance or render-prop gymnastics; no class components.

Related: [react-native-conventions.md](react-native-conventions.md), [react-native-ui-conventions.md](react-native-ui-conventions.md).
