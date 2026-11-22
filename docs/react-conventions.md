# React conventions

**React 19** is used in the mobile app and the separate `sajiwa-dashboard` repository. This document covers mobile/shared React; dashboard rules live with that repository. Function components + hooks only.

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
- The mobile application uses Expo Router; dashboard routes use the Next.js App Router in its own repository.

## Component composition

- Presentational components in `components/`; feature folders (`components/chat/`, `components/home/`)
  re-export via `index.ts`.
- Mobile screens own data-fetching via `@prototype/api-client`; pass props down.
- Prefer composition/props over inheritance or render-prop gymnastics; no class components.

Dashboard React conventions: [sajiwa-dashboard/docs/react-conventions.md](https://github.com/melakhaa/sajiwa-dashboard/blob/main/docs/react-conventions.md).

Related: [react-native-conventions.md](react-native-conventions.md), [react-native-ui-conventions.md](react-native-ui-conventions.md).
