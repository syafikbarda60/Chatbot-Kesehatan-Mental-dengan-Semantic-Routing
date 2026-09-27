// components/ui/Dialog.tsx
// shadcn-style Dialog/Modal primitive for React Native
// Elegant floating dialog with backdrop and modular composition

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
  TextStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';
import { useTheme, Neu } from '@prototype/ui-shared';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  children,
}) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          speed: 25,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={() => onOpenChange(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onOpenChange(false)}
        >
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
                backgroundColor: colors.overlay,
              },
            ]}
          />
        </Pressable>

        {/* Dialog Content Card */}
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.background,
              boxShadow: Neu.raised,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export interface DialogHeaderProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
  children,
  style,
}) => {
  return <View style={[styles.header, style]}>{children}</View>;
};

export interface DialogTitleProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

export const DialogTitle: React.FC<DialogTitleProps> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.title, { color: colors.onSurface }, style]}>
      {children}
    </Text>
  );
};

export interface DialogDescriptionProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({
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

export interface DialogContentProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  style,
}) => {
  return <View style={[styles.content, style]}>{children}</View>;
};

export interface DialogFooterProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const DialogFooter: React.FC<DialogFooterProps> = ({
  children,
  style,
}) => {
  return <View style={[styles.footer, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontHeadingSemi,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: Typography.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 22,
  },
  content: {
    paddingVertical: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});

export default Dialog;
