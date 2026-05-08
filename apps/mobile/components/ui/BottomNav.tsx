import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../constants/ThemeContext';

type Tab = { label: string; icon: string; iconActive: string; route: string };

const TABS: Tab[] = [
  { label: 'Home',     icon: 'home-outline',       iconActive: 'home',        route: '/home'    },
  { label: 'Dialogue', icon: 'chatbubble-outline',  iconActive: 'chatbubble',  route: '/chat'    },
  { label: 'Quiz',     icon: 'help-circle-outline', iconActive: 'help-circle', route: '/journal' },
  { label: 'Profile',  icon: 'person-outline',      iconActive: 'person',      route: '/profile' },
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
    <View style={[
      s.bar,
      {
        paddingBottom: insets.bottom + 6,
        backgroundColor: colors.surfaceContainerLowest + 'F4',
        borderTopColor: colors.outlineVariant + '25',
        shadowColor: colors.onSurface,
      }
    ]}>
      {TABS.map((tab, i) => {
        const active = pathname === tab.route;
        return (
          <Animated.View key={tab.route} style={[s.tabWrap, { transform: [{ scale: scales[i] }] }]}>
            <TouchableOpacity style={s.tab} onPress={() => handlePress(tab.route, i)} activeOpacity={1}>
              {/* Active indicator top pill */}
              {active && (
                <View style={[s.pill, { backgroundColor: colors.primaryContainer }]} />
              )}
              <Ionicons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={24}
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
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 12,
  },
  tabWrap: { flex: 1 },
  tab: {
    alignItems: 'center', paddingVertical: 6,
    gap: 3, position: 'relative',
  },
  pill: {
    position: 'absolute', top: -8,
    width: 32, height: 3, borderRadius: 999,
  },
  label: { fontSize: 10, letterSpacing: 0.2 },
});
