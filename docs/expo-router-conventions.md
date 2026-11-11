# Expo Router conventions

`apps/mobile` uses **expo-router 6** for file-based routing/navigation; the dashboard is Next.js
App Router ([nextjs-conventions.md](nextjs-conventions.md)). React Navigation 7 is the engine
underneath expo-router — never mount your own `NavigationContainer` or navigator, and prefer
`useRouter()` / `useLocalSearchParams()` over React Navigation hooks in screens.

## Structure

- `app/` is the route tree; every file is a screen. `app/_layout.tsx` is the root layout.
- Layouts render `<Stack>` / `<Tabs>` from `expo-router` with app-wide `screenOptions`.
- `(group)` folders are route groups with no URL segment.
- Screens are registered explicitly in the root `<Stack>` (`index`, `register`, `home`, `admin`,
  `chat`, `journal`, `assessment`, `stats`, `profile`, `schedule`, `journal-history`);
  `forgot-password` is reached via `router.push` only.
- Bottom navigation is the app's own `components/ui/BottomNav.tsx`, not a React Navigation tab bar.

## Navigation

- Imperative navigation: `router.push(...)` / `router.replace(...)` from `useRouter()`.
- Read params with `useLocalSearchParams()`.
- Use `Link`/`router` — never `navigation.navigate` directly from screens.

## Config

- Enabled via the `expo-router` plugin in `apps/mobile/app.json`; deep-link scheme `sajiwa`.

## Rules

- New screen = new file under `app/` + a `<Stack.Screen>` entry in the root layout.
- Keep layouts thin (providers, fonts, splash); put feature logic in `hooks/` and `components/`.
- Route files should not import each other; share through `components/`/`hooks/`.
