# Mobile — local rules

Student-facing Expo React Native app (expo-router); entry `index.ts`. Run from this directory:
`npx expo start`. No linter configured here.

Unit tests sit beside the source (`*.test.ts`) and run with `npm run test:unit` here, or
`npm test` from the repo root. Rules: [testing conventions](../../docs/testing-conventions.md).

Conventions: [expo](../../docs/expo-conventions.md), [expo-router](../../docs/expo-router-conventions.md),
[react-native](../../docs/react-native-conventions.md), [UI/design system](../../docs/react-native-ui-conventions.md).

Chat streaming (`hooks/useChat.ts`): clear `isTyping` on the first **token**, not the first SSE
frame, and keep message bubbles memoised. Why: the "Streaming chat" section of
[react-native](../../docs/react-native-conventions.md).
