// Taptic feedback, used the way iOS uses it: a light tick when a choice changes, and a
// notification pattern when an action succeeds or fails. Not on every press — iOS buttons
// are silent, and buzzing on each tap reads as cheap rather than native.
// Fire-and-forget: the OS honors the user's own haptics setting, web has no engine, and
// a missing one must never surface as an error in the UI.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS !== 'web';

export const haptic = {
  /** A selection moved: a day, a time slot, a month. */
  select: () => { if (enabled) Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  error: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};
