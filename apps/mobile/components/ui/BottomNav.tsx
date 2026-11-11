import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Neu, useTheme } from '@prototype/ui-shared';
import { Fab, FAB_SIZE } from './Fab';
import { haptic } from './haptics';

// Geometry of the floating bar and the chat button above it, measured from the safe-area
// bottom. Kept here, next to the styles that produce it, because every screen that shows
// the bar derives its bottom padding from it.
const BAR_OFFSET = 10;            // bar's gap above the safe area (styles.bar `bottom`)
const BAR_HEIGHT = 64;            // 6 padding + 52 tab + 6 padding
const FAB_GAP = 14;              // between the bar's top edge and the button

/**
 * Bottom padding (add `insets.bottom`) a scrolling screen with the bar needs so its last
 * item can scroll fully clear of both the bar and the chat button. The button floats over
 * content mid-scroll, as on WhatsApp, but nothing can end up stuck underneath it.
 */
export const BOTTOM_CLEARANCE = BAR_OFFSET + BAR_HEIGHT + FAB_GAP + FAB_SIZE + 16;

type Tab = {
  label: string;
  icon: string;
  iconActive: string;
  route: string;
};

const TABS: Tab[] = [
  {
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    route: '/home',
  },
  {
    label: 'Chat',
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
    route: '/chat',
  },
  {
    label: 'Asesmen',
    icon: 'clipboard-outline',
    iconActive: 'clipboard',
    route: '/assessment',
  },
  {
    label: 'Konseling',
    icon: 'calendar-outline',
    iconActive: 'calendar',
    route: '/schedule',
  },
  {
    label: 'Jurnal',
    icon: 'book-outline',
    iconActive: 'book',
    route: '/journal-history',
  },
  {
    label: 'Profil',
    icon: 'person-outline',
    iconActive: 'person',
    route: '/profile',
  },
];

// ── Swiping between tabs ─────────────────────────────────────────
// A sideways swipe on a tab screen opens the neighbouring tab (the gesture lives in the
// root layout). Chat is left out: it is a full-screen conversation without the bar, and a
// stray sideways drag there should not throw you out of it.
type Dir = 'next' | 'prev';
const SWIPE_ROUTES = TABS.map((t) => t.route).filter((r) => r !== '/chat');
export const isSwipeTab = (pathname: string) => SWIPE_ROUTES.includes(pathname);

// Direction of the switch in flight, read by the root layout to pick the transition.
// Module state, not context: only one tab switch can be in flight at a time.
let switching: Dir | null = null;
let reset: ReturnType<typeof setTimeout> | undefined;
export const tabAnimation = () =>
  switching === 'next' ? 'slide_from_right' : switching === 'prev' ? 'slide_from_left' : 'none';

function switchTab(route: string, dir: Dir | null = null) {
  switching = dir;
  clearTimeout(reset);
  // Long enough for the navigator to read it for the incoming screen, short enough that a
  // later, unrelated replace (sign-in → home) still opens without motion.
  reset = setTimeout(() => { switching = null; }, 500);
  router.replace(route as never);
}

// A screen holding unsaved input (a half-answered assessment, a draft) locks the swipe so
// an accidental drag cannot throw the input away. Tapping a tab still works: that is deliberate.
let locked = false;
export function useTabSwipeLock(lock: boolean) {
  useEffect(() => {
    locked = lock;
    return () => { locked = false; };
  }, [lock]);
}

export function swipeTab(pathname: string, dir: Dir) {
  const i = SWIPE_ROUTES.indexOf(pathname);
  const to = SWIPE_ROUTES[i + (dir === 'next' ? 1 : -1)];
  if (locked || i < 0 || !to) return;
  haptic.select();
  switchTab(to, dir);
}

// Floating bar; the active tab sits in a sunken well.
// A tap switches instantly; a swipe slides in from the side it came from.
export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const pathname = usePathname();

  return (
    <>
    {/* Chat shortcut, bottom right like WhatsApp's. Sits above the bar, never on it, and
        is not rendered on the chat screen itself — that screen has no BottomNav. It
        appears with the bar rather than animating in: tabs switch instantly by design, so
        an entrance would replay on every tab tap. */}
    <Fab
      icon="chatbubble-ellipses"
      onPress={() => router.replace('/chat' as never)}
      accessibilityLabel="Cerita ke Sajiwa"
      accessibilityHint="Membuka percakapan dengan Sajiwa"
      // Lines up with the bar's rounded right end rather than the screen edge.
      style={{ right: 16, bottom: insets.bottom + BAR_OFFSET + BAR_HEIGHT + FAB_GAP }}
    />

    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          bottom: insets.bottom + BAR_OFFSET,
          backgroundColor: colors.background,
          boxShadow: Neu.raised,
        },
      ]}
    >
      {TABS.map(tab => {
        const active =
          pathname === tab.route ||
          pathname.startsWith(`${tab.route}/`);

        const color = active
          ? colors.primary
          : colors.tabInactive;

        return (
          <Pressable
            key={tab.route}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active && { boxShadow: Neu.inset },
            ]}
            onPress={() => {
              if (!active) {
                // replace, not push: tabs are siblings, like a native tab bar. Pushing
                // stacked a fresh, fully mounted copy of every tab visited (home → chat →
                // home → chat kept four screens alive), so memory and render work grew for
                // the whole session. Tab screens already disable swipe-back, so the stack
                // history bought nothing.
                switchTab(tab.route);
              }
            }}
          >
            <Ionicons
              name={
                (active
                  ? tab.iconActive
                  : tab.icon) as React.ComponentProps<
                  typeof Ionicons
                >['name']
              }
              size={21}
              color={color}
            />

            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color,
                  fontFamily: active
                    ? 'PlusJakartaSans_700Bold'
                    : 'PlusJakartaSans_500Medium',
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    borderRadius: 28,
    padding: 6,
    gap: 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    gap: 2,
    paddingHorizontal: 2,
  },
  label: {
    maxWidth: '100%',
    fontSize: 9,
    letterSpacing: 0,
    textAlign: 'center',
  },
});