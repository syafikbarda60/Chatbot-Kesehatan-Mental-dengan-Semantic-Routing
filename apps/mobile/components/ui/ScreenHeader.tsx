import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme, Spacing } from '@prototype/ui-shared';
import { IconButton } from './IconButton';

interface Props {
  title: string;
  subtitle?: string;
  /** Short context above the title (a date, a section). Set in tracked caps, like Home. */
  eyebrow?: string;
  back?: boolean;          // show a back button (stack screens)
  right?: React.ReactNode; // optional action slot
}

export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

export const ScreenHeader: React.FC<Props> = ({ title, subtitle, eyebrow, back, right }) => {
  const { colors } = useTheme();
  return (
    <View style={s.row}>
      {back && <IconButton icon="arrow-back" label="Kembali" onPress={goBack} />}
      <View style={s.text}>
        {eyebrow ? <Text style={[s.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text> : null}
        <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={[s.sub, { color: colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  text: { flex: 1, gap: 5 },
  // Tracked-out caps read as a deliberate eyebrow rather than leftover label text
  eyebrow: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 27, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, lineHeight: 33 },
  sub: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20 },
});

export default ScreenHeader;
