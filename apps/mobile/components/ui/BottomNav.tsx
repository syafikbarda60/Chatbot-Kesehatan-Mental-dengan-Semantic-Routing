import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';

type Tab = { label: string; icon: string; iconActive: string; route: string };

const TABS: Tab[] = [
  { label: 'Home',      icon: 'home-outline',       iconActive: 'home',       route: '/home' },
  { label: 'Chat',      icon: 'chatbubble-outline', iconActive: 'chatbubble', route: '/chat' },
  { label: 'Konseling', icon: 'calendar-outline',   iconActive: 'calendar',   route: '/schedule' },
  { label: 'Jurnal',    icon: 'book-outline',       iconActive: 'book',       route: '/journal-history' },
  { label: 'Profil',    icon: 'person-outline',     iconActive: 'person',     route: '/profile' },
];

// Floating bar; the active tab sits in a sunken well. No motion on switch.
export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const pathname = usePathname();

  return (
    <View accessibilityRole="tablist" style={[s.bar, { bottom: insets.bottom + 10, backgroundColor: colors.background, boxShadow: Neu.raised }]}>
      {TABS.map((tab) => {
        const active = tab.route === pathname;
        const color = active ? colors.primary : colors.tabInactive;
        return (
          <Pressable
            key={tab.route}
            style={[s.tab, active && { boxShadow: Neu.inset }]}
            onPress={() => !active && router.push(tab.route as any)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={(active ? tab.iconActive : tab.icon) as any} size={22} color={color} />
            <Text style={[s.label, { color, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', borderRadius: 28, padding: 6, gap: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 22, gap: 2 },
  label: { fontSize: 11, letterSpacing: 0.1 },
});
