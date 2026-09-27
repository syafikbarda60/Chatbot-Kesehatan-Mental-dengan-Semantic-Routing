// 2x2 grid of neumorphic mood chips; the selected one sinks in.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Neu } from '@prototype/ui-shared';
import { MOODS, Mood } from '../constants/moods';

interface Props {
  value: Mood | null;
  onChange: (m: Mood) => void;
}

export const MoodPicker: React.FC<Props> = ({ value, onChange }) => {
  const { colors } = useTheme();
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Suasana hati">
      {MOODS.map((m) => {
        const selected = value === m.key;
        const tint = selected ? m.color : colors.onSurfaceVariant;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={m.label}
            style={[s.chip, { backgroundColor: colors.background, boxShadow: selected ? Neu.inset : Neu.raisedSm }]}
          >
            <Ionicons name={m.icon} size={18} color={tint} />
            <Text
              style={[
                s.text,
                { color: tint, fontFamily: selected ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' },
              ]}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flexBasis: '45%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  text: { fontSize: 14 },
});

export default MoodPicker;
