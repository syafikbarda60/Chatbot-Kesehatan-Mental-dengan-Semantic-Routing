// components/ui/Card.tsx
// shadcn-style Card primitives for React Native
// Clean, modular, cohesive surfaces

import React from 'react';
import { View, Text, Platform, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@prototype/ui-shared';
import { NeuView } from './NeuView';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';

export interface CardProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  const { colors } = useTheme();

  return (
    <NeuView radius={24} style={[styles.card, style || {}]}>
      {children}
    </NeuView>
  );
};

export interface CardHeaderProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, style }) => {
  return <View style={[styles.header, style]}>{children}</View>;
};

export interface CardTitleProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, style }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.title, { color: colors.onSurface }, style]}>
      {children}
    </Text>
  );
};

export interface CardDescriptionProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.description, { color: colors.onSurfaceVariant }, style]}
    >
      {children}
    </Text>
  );
};

export interface CardContentProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const CardContent: React.FC<CardContentProps> = ({ children, style }) => {
  return <View style={[styles.content, style]}>{children}</View>;
};

export interface CardFooterProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, style }) => {
  return <View style={[styles.footer, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xxl,
    borderWidth: 0,
    padding: Spacing.base + 4,
    
    marginVertical: Spacing.xs,
  },
  header: {
    marginBottom: Spacing.md,
    gap: 4,
  },
  title: {
    fontSize: Typography.md + 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: Typography.xs + 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 18,
  },
  content: {
    gap: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.base,
    gap: Spacing.sm,
  },
});

export default Card;
