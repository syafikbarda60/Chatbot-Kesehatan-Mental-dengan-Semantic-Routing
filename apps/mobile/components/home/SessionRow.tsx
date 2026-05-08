// components/home/SessionRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface SessionData {
  label: string;
  sub: string;
  time: string;
  dotColor: string;
}

interface Props extends SessionData { onPress?: () => void }

export const SessionRow: React.FC<Props> = ({ label, sub, time, dotColor, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.divider }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>{time}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  text:  { flex: 1, gap: 2 },
  label: { fontSize: Typography.base, fontFamily: 'Inter_500Medium' },
  sub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  time:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
});

export default SessionRow;
