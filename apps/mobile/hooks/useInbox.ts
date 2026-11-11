// The student's inbox. While the app is open it asks the server every minute (and on every
// return to the foreground), banners what is new, and keeps session reminders scheduled on the
// phone itself, so those ring even when the app is closed.
// No push server: a change made while the app is closed is bannered the next time it opens.
// Moving to real push needs a development build (Expo Go on Android has no push module).
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@prototype/ui-shared';
import { apiGetMyCounselingRequests, apiGetMyNotifications, type MyNotification } from '@prototype/api-client';
import * as Notifications from './notifications';
import { freshAlerts, reminderPlan } from './inbox';

const POLL_MS = 60_000;
const CHANNEL = 'counseling';
const ALERTED = 'inbox.alerted';
const native = Platform.OS !== 'web';
// Counseling news matters more than a greeting: heads-up on Android, still an ordinary alert on iOS
const LOOK = { color: Notifications.ACCENT, priority: Notifications.AndroidNotificationPriority.HIGH, interruptionLevel: 'active' as const };

type Inbox = { items: MyNotification[]; unread: number };
let inbox: Inbox = { items: [], unread: 0 };
const listeners = new Set<() => void>();
const publish = (next: Inbox) => { inbox = next; listeners.forEach((listener) => listener()); };

/** Home's badge and the Notifikasi screen read the same list. */
export function useInboxState() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => inbox);
}

/** Optimistic: one item (or all, without an id) reads as handled before the server answers. */
export function markReadLocally(id?: string) {
  const now = new Date().toISOString();
  const items = inbox.items.map((n) => (!id || n.notification_id === id) && !n.read_at ? { ...n, read_at: now } : n);
  publish({ items, unread: items.filter((n) => !n.read_at).length });
}

export async function refreshInbox() {
  const result = await apiGetMyNotifications();
  publish({ items: result.notifications, unread: result.unread });
  if (native) await banner(result.notifications);
}

async function banner(items: MyNotification[]) {
  const stored = await AsyncStorage.getItem(ALERTED).catch(() => null);
  const alerted = new Set<string>(stored ? JSON.parse(stored) : []);
  // First run on this phone: what already exists is history, not news
  const fresh = stored === null ? [] : freshAlerts(items, alerted);
  for (const n of fresh) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body ?? '', ...LOOK, data: { kind: 'inbox' } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    }).catch(() => {});
  }
  items.forEach((n) => alerted.add(n.notification_id));
  await AsyncStorage.setItem(ALERTED, JSON.stringify([...alerted].slice(-200))).catch(() => {});
}

async function planReminders() {
  const { requests } = await apiGetMyCounselingRequests();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.content.data?.kind === 'reminder')
    .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  for (const r of reminderPlan(requests)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder:${r.key}`,
      content: { title: r.title, body: r.body, ...LOOK, data: { kind: 'reminder' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

function open(response: Notifications.NotificationResponse) {
  const kind = response.notification.request.content.data?.kind;
  if (kind !== 'inbox' && kind !== 'reminder') return;
  // Notifikasi is a stack screen, Konseling a tab (tabs are siblings: replace)
  if (kind === 'inbox') router.push('/notifications'); else router.replace('/schedule');
  Notifications.clearLastNotificationResponseAsync().catch(() => {});
}

/** `ready`: the navigator is mounted and the launch redirect is done, so a tap's route sticks. */
export function useInbox(ready: boolean) {
  const { user, isLoading } = useAuth();
  const student = user?.role === 'mahasiswa';

  useEffect(() => {
    if (isLoading) return;
    if (!student) { publish({ items: [], unread: 0 }); return; }
    if (native && Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Konseling', importance: Notifications.AndroidImportance.HIGH,
        lightColor: Notifications.ACCENT, vibrationPattern: [0, 250, 150, 250],
        // Who a student sees and when stays off the lock screen
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      }).catch(() => {});
    }
    const sync = () => {
      refreshInbox().catch(() => {});
      if (native) planReminders().catch(() => {});
    };
    sync();
    const timer = setInterval(() => { if (AppState.currentState === 'active') refreshInbox().catch(() => {}); }, POLL_MS);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => { clearInterval(timer); foreground.remove(); };
  }, [isLoading, student]);

  useEffect(() => {
    if (!native || !ready || !student) return;
    // A tap that launched the app arrives before this listener exists
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready, student]);
}
