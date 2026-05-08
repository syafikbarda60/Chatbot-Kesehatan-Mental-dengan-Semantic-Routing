// components/home/MoodSelector.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export const MOODS = [
  { emoji: '😄', label: 'Bahagia', value: 1 },
  { emoji: '😊', label: 'Baik',    value: 2 },
  { emoji: '😐', label: 'Biasa',   value: 5 },
  { emoji: '😔', label: 'Sedih',   value: 7 },
  { emoji: '😰', label: 'Cemas',   value: 9 },
];

interface Props { selected: number | null; onSelect: (value: number) => void }

export const MoodSelector: React.FC<Props> = ({ selected, onSelect }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {MOODS.map((m) => {
        const active = selected === m.value;
        return (
          <TouchableOpacity
            key={m.value}
            style={[
              styles.item,
              { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryContainer + '30' : colors.surface }
            ]}
            onPress={() => onSelect(m.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <Text style={[styles.label, { color: active ? colors.primary : colors.textMuted }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: Spacing.xs },
  item:  {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 4,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: Typography.xs - 1, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center' },
});

export default MoodSelector;
