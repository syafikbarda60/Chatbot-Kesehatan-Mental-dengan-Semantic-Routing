import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme, Spacing } from '@prototype/ui-shared';
import { IconButton } from './IconButton';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;          // show a back button (stack screens)
  right?: React.ReactNode; // optional action slot
}

export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

export const ScreenHeader: React.FC<Props> = ({ title, subtitle, back, right }) => {
  const { colors } = useTheme();
  return (
    <View style={s.row}>
      {back && <IconButton icon="arrow-back" label="Kembali" onPress={goBack} />}
      <View style={s.text}>
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
  text: { flex: 1 },
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.7, lineHeight: 32 },
  sub: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginTop: 2 },
});

export default ScreenHeader;
