// components/ui/Dialog.tsx
// shadcn-style Dialog/Modal primitive for React Native
// Elegant floating dialog with backdrop and modular composition

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';
import { useTheme, Neu } from '@prototype/ui-shared';
import { EXIT, FADE_MS, SPRING } from './motion';

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
  const reduce = useReducedMotion();
  // Stays true through the close animation. Unmounting on `open=false` (the old early
  // return) cut the dialog off mid-frame, so the fade-out never actually played.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // iOS alert motion: settles down from slightly larger on a critically damped spring.
      progress.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, SPRING);
    } else if (mounted) {
      progress.value = withTiming(0, EXIT, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // progress is a stable shared value; mounted is read only to skip a closed first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.4),
    transform: [{ scale: reduce ? 1 : 1.08 - 0.08 * progress.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
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
              { backgroundColor: colors.overlay },
              backdropStyle,
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
            },
            cardStyle,
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
    ...StyleSheet.absoluteFill,
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
