# React Native UI / design system conventions

The visual layer: **Sajiwa Design System** (Material-3-derived, neumorphic), shared animations, icons, and charts.

## Theme (source of truth)

- `@prototype/ui-shared/src/theme.ts` exports `SajiwaColors` (+ typography) — a Material 3 palette
  keyed by role: `primary`, `surface`, `surfaceContainer*`, `onPrimary`, `error`, `outline`, plus
  convenience aliases (`card`, `border`, `textPrimary`, `textSecondary`, `divider`).
- Wrap the app in `ThemeProvider` (done in `app/_layout.tsx`); read colors via the theme hook.
- **Never hardcode hex values** in components — use `SajiwaColors.*`.
- Base background is `#E4E8EE` with feature accents `primary` (navy, chat), `sage` (journal),
  `amber` (counseling), and coral (crisis only); mobile `app.json` uses the same `#E4E8EE` for
  splash/adaptive icon backgrounds.

## Typography

- Font family **Plus Jakarta Sans** (plus Inter/Poppins packages installed), loaded in the root layout
  via `@expo-google-fonts/plus-jakarta-sans` + `expo-font`. Don't add per-screen font loading.
- Use the typography tokens from the theme rather than raw `fontSize`/`fontWeight` where provided.

## Animation

- **react-native-reanimated 4** with **react-native-worklets**; shared entrance animation lives in
  `@prototype/ui-shared/src/useAnimatedEntrance.ts`. Use it instead of ad-hoc animations.
- Simple fade-ins use `components/ui/FadeIn.tsx`.
- Gestures via `react-native-gesture-handler`; the root is wrapped in `GestureHandlerRootView`.

## Icons & graphics

- Icons: `@expo/vector-icons` — prefer the app's existing icon usage.
- Gradients/blur: `expo-linear-gradient`, `expo-blur`.

## Component rules

- Reusable primitives in `components/ui/` (`Button`, `Badge`, `Divider`, `FadeIn`, `BottomNav`);
  feature components in `components/<feature>/` with an `index.ts` barrel.
- Every new shared visual primitive goes in `components/ui/` and is exported from its barrel.
- Keep spacing/padding consistent by reusing existing components before adding new styles.
