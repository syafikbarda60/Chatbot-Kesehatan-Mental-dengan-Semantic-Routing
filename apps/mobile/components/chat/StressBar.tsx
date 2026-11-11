// components/chat/StressBar.tsx
// Collapsible mental wellness indicator — calm, non-clinical language

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@prototype/ui-shared';
import { useTheme, Neu } from '@prototype/ui-shared';
import { SPRING_FILL } from '../ui/motion';

interface Props {
  level: number;
  onSupportPress?: () => void;
}

type Tier = 'calm' | 'gentle' | 'heavy';

const TIER_CONFIG: Record<Tier, {
  label: string;
  icon: 'checkmark-circle-outline' | 'partly-sunny-outline' | 'rainy-outline';
  colorKey: 'stressLow' | 'stressMid' | 'stressHigh';
  bgKey: 'stressLowBg' | 'stressMidBg' | 'stressHighBg';
  message: string;
  suggestion: string;
  actionLabel: string;
  actionIcon: 'book-outline' | 'leaf-outline' | 'heart-outline';
}> = {
  calm: {
    label: 'Kondisi Baik',
    icon: 'checkmark-circle-outline',
    colorKey: 'stressLow',
    bgKey: 'stressLowBg',
    message: 'Kamu terlihat cukup tenang hari ini.',
    suggestion: 'Lanjutkan cerita, atau coba jurnal singkat.',
    actionLabel: 'Jurnal Hari Ini',
    actionIcon: 'book-outline',
  },
  gentle: {
    label: 'Butuh Perhatian',
    icon: 'partly-sunny-outline',
    colorKey: 'stressMid',
    bgKey: 'stressMidBg',
    message: 'Hari ini agak berat. Itu wajar.',
    suggestion: 'Mau coba latihan napas 1 menit?',
    actionLabel: 'Latihan Napas',
    actionIcon: 'leaf-outline',
  },
  heavy: {
    label: 'Butuh Dukungan',
    icon: 'rainy-outline',
    colorKey: 'stressHigh',
    bgKey: 'stressHighBg',
    message: 'Kamu tidak sendirian. Ada yang bisa bantu.',
    suggestion: 'Hubungi konselor atau terus cerita di sini.',
    actionLabel: 'Hubungi Dukungan',
    actionIcon: 'heart-outline',
  },
};

function getTier(level: number): Tier {
  if (level <= 3) return 'calm';
  if (level <= 6) return 'gentle';
  return 'heavy';
}

export const StressBar: React.FC<Props> = ({ level, onSupportPress }) => {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(10, level));
  const tier = getTier(clamped);
  const config = TIER_CONFIG[tier];

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Reanimated, not the RN Animated JS driver: animating `height` there recomputed layout on
  // the JS thread every frame, so the panel stuttered whenever chat was streaming tokens.
  // On the UI thread it stays smooth regardless of what JS is doing.
  const reduce = useReducedMotion();
  const open = useSharedValue(0);
  const fullHeight = tier !== 'calm' ? 124 : 104;

  useEffect(() => {
    const to = expanded ? 1 : 0;
    // Critically damped: unfolds like an iOS disclosure row, without a bounce at the end.
    open.value = reduce ? withTiming(to, { duration: 0 }) : withSpring(to, SPRING_FILL);
    // open is a stable shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, reduce]);

  const panelStyle = useAnimatedStyle(() => ({ height: open.value * fullHeight, opacity: open.value }));
  // The chevron used to jump 180° at once; now it turns with the panel.
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.value * 180}deg` }] }));

  if (dismissed && tier === 'calm') return null;

  const tierColor = colors[config.colorKey];
  const tierBg = colors[config.bgKey];

  return (
    <View style={[s.wrap, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}>
      {/* Compact row */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        onLongPress={() => tier !== 'calm' && setDismissed(true)}
        style={s.compactRow}
        accessibilityRole="button"
        accessibilityLabel={`Kondisi mental: ${config.label}. Tekan untuk ${expanded ? 'menutup' : 'membuka'} detail.`}
      >
        <View style={[s.iconWrap, { backgroundColor: tierBg }]}>
          <Ionicons name={config.icon} size={16} color={tierColor} />
        </View>

        <View style={s.textGroup}>
          <Text style={[s.tierLabel, { color: colors.onSurface }]}>{config.label}</Text>
          <Text style={[s.tierMessage, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{config.message}</Text>
        </View>

        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      {/* Expanded content */}
      <Animated.View style={[s.expandedContent, panelStyle]}>
        <View style={[s.divider, { backgroundColor: colors.outlineVariant + '40' }]} />
        <View style={s.expandedInner}>
          <Text style={[s.suggestion, { color: colors.onSurfaceVariant }]}>{config.suggestion}</Text>
          <View style={s.actionRow}>
            {tier !== 'calm' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: tierColor }]}
                accessibilityRole="button"
                onPress={() => onSupportPress?.()}
                activeOpacity={0.8}
              >
                <Ionicons name={config.actionIcon} size={16} color="#fff" />
                <Text style={s.actionBtnText}>{config.actionLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}
              accessibilityRole="button"
              onPress={() => tier === 'calm' ? onSupportPress?.() : setExpanded(false)}
              activeOpacity={0.7}
            >
              <Ionicons name={tier === 'calm' ? config.actionIcon : 'chatbubble-outline'} size={15} color={colors.onSurface} />
              <Text style={[s.secondaryBtnText, { color: colors.onSurface }]}>
                {tier === 'calm' ? config.actionLabel : 'Lanjut Cerita'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  compactRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textGroup: { flex: 1, gap: 2 },
  tierLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  tierMessage: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  expandedInner: { gap: Spacing.sm },
  suggestion: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#fff',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});

export default StressBar;