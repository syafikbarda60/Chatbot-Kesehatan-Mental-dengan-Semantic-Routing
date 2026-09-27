import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';

type Tab = { label: string; icon: string; iconActive: string; route: string };

const TABS: Tab[] = [
  { label: 'Home',     icon: 'home-outline',       iconActive: 'home',        route: '/home'     },
  { label: 'Chat'    , icon: 'chatbubble-outline',  iconActive: 'chatbubble',  route: '/chat'     },
  { label: 'Konseling', icon: 'calendar-outline',    iconActive: 'calendar',    route: '/schedule' }, // TEMP HIDDEN
  { label: 'Jurnal',  icon: 'book-outline',        iconActive: 'book',        route: '/journal-history' },
  // { label: 'Hotline', icon: 'call-outline',        iconActive: 'call',        route: '/hotline'  },
  { label: 'Profil',  icon: 'person-outline',      iconActive: 'person',      route: '/profile'  },
];

export default function BottomNav() {
  const insets  = useSafeAreaInsets();
  const { colors } = useTheme();
  const pathname  = usePathname();
  const scales    = useRef(TABS.map(() => new Animated.Value(1))).current;

  const handlePress = (route: string, i: number) => {
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.86, duration: 70, useNativeDriver: true }),
      Animated.timing(scales[i], { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();
    router.push(route as any);
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { bottom: insets.bottom + 10, backgroundColor: colors.background, boxShadow: Neu.raised }]}
    >
      {TABS.map((tab, i) => {
        const active = pathname === tab.route;
        return (
          <Animated.View key={tab.route} style={[s.tabWrap, { transform: [{ scale: scales[i] }] }]}>
            <TouchableOpacity
              style={[s.tab, active && { boxShadow: Neu.inset }]}
              onPress={() => handlePress(tab.route, i)}
              activeOpacity={1}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={22}
                color={active ? colors.primary : colors.tabInactive}
              />
              <Text style={[
                s.label,
                {
                  color: active ? colors.primary : colors.tabInactive,
                  fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row',
    borderRadius: 28,
    padding: 6,
    gap: 4,
  },
  tabWrap: { flex: 1 },
  tab: {
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52, borderRadius: 22,
    gap: 2,
  },
  label: { fontSize: 11, letterSpacing: 0.1 },
});
