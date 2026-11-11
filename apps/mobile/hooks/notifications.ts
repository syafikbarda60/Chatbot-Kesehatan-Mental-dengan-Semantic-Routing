// The parts of expo-notifications the daily check-in and the inbox use, imported file by file.
// The package entry also loads its push-topic module, whose native half is missing
// from Expo Go on Android (SDK 57), so importing 'expo-notifications' crashes the whole app
// there. Local notifications need none of it. Go back to `import * as Notifications from
// 'expo-notifications'` once the app runs on a development build or Expo Go ships the module.
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  clearLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
export { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications/build/NotificationChannelManager.types';
export { AndroidNotificationPriority, SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';

// Sajiwa navy: Android tints the status-bar icon and accents with it (iOS always shows the app icon)
export const ACCENT = '#26356E';
export type { NotificationResponse } from 'expo-notifications/build/Notifications.types';
