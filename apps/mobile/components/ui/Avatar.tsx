// components/ui/Avatar.tsx
// shadcn-style Avatar primitive for React Native

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageSourcePropType,
} from 'react-native';
import { useTheme } from '@prototype/ui-shared';
import { Typography, BorderRadius } from '@prototype/ui-shared';

export type AvatarSize = 'sm' | 'default' | 'lg' | 'xl';

export interface AvatarProps {
  source?: ImageSourcePropType | { uri: string };
  fallbackText?: string;
  size?: AvatarSize;
  style?: ViewStyle | ViewStyle[];
  fallbackTextStyle?: TextStyle | TextStyle[];
}

export const Avatar: React.FC<AvatarProps> = ({
  source,
  fallbackText,
  size = 'default',
  style,
  fallbackTextStyle,
}) => {
  const { colors } = useTheme();
  const [imageError, setImageError] = useState(false);

  const getDimensions = (): { dimension: number; fontSize: number } => {
    switch (size) {
      case 'sm':
        return { dimension: 32, fontSize: Typography.xs };
      case 'lg':
        return { dimension: 52, fontSize: Typography.base };
      case 'xl':
        return { dimension: 64, fontSize: Typography.lg };
      case 'default':
      default:
        return { dimension: 40, fontSize: Typography.sm };
    }
  };

  const { dimension, fontSize } = getDimensions();
  const hasImage = source && !imageError;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant + '35',
        },
        style,
      ]}
    >
      {hasImage ? (
        <Image
          source={source}
          style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text
          style={[
            styles.fallbackText,
            {
              fontSize,
              color: colors.onSurfaceVariant,
            },
            fallbackTextStyle,
          ]}
        >
          {fallbackText?.substring(0, 2).toUpperCase() || 'U'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  fallbackText: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});

export default Avatar;
