# @prototype/ui-shared

Shared theme, auth hook, and entrance animation for the Expo (mobile) app. Consumed as TS source
(`main: src/index.ts`). Depends on `@prototype/api-client` for auth calls.

- `theme.ts` is the design system's single source of truth — no ad-hoc colors in apps;
  reach for `ThemeContext` over prop-drilling styles.
- `useAuth` is the one auth state hook; the mobile app wraps its root with it.

Conventions: [typescript](../../docs/typescript-conventions.md),
[react](../../docs/react-conventions.md),
[UI/design system](../../docs/react-native-ui-conventions.md),
[npm workspaces](../../docs/npm-workspaces-conventions.md).
