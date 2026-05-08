import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const MOODS = [
  { emoji: '😄', label: 'Bahagia', value: 1 },
  { emoji: '😊', label: 'Baik', value: 2 },
  { emoji: '😐', label: 'Biasa', value: 5 },
  { emoji: '😔', label: 'Sedih', value: 7 },
  { emoji: '😰', label: 'Cemas', value: 9 },
];

interface Props { selected: number | null; onSelect: (v: number) => void }

export const MoodSelector: React.FC<Props> = ({ selected, onSelect }) => (
  <View style={styles.row}>
    {MOODS.map((m) => {
      const active = selected === m.value;
      return (
        <TouchableOpacity
          key={m.value}
          style={[styles.item, active && styles.itemActive]}
          onPress={() => onSelect(m.value)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{m.emoji}</Text>
          <Text style={[styles.label, active && styles.labelActive]}>{m.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    backgroundColor: Colors.surface,
  },
  itemActive: {
    borderColor: Colors.white,
    backgroundColor: Colors.card,
  },
  emoji: { fontSize: 20 },
  label: {
    fontSize: Typography.xs - 1,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  labelActive: { color: Colors.textPrimary },
});

export default MoodSelector;
