// Non-blocking feedback, told by the companion. It arrives as a frosted glass sheet that slides
// down from the top edge: what's under it is blurred so the message stands out, but it's anchored
// to the screen edge (not floating over content) and the rest of the page stays usable.
// A thin bar shows the time left; tap to dismiss. Use for "saved / failed"; keep dialogs for decisions.
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import type { Expression } from '@prototype/utils';
import { CHARACTER } from '../../constants/character';
import { haptic } from './haptics';
import { EXIT_EASING_RN, EXIT_MS, SPRING_FILL } from './motion';

type ToastType = 'success' | 'error' | 'info';
interface ToastState { type: ToastType; message: string; id: number }
interface ToastApi { show: (message: string, type?: ToastType) => void }

// The companion's face carries the tone; the timer bar repeats it in color
const FACE: Record<ToastType, Expression> = { success: 'jempol', error: 'bingung', info: 'senang' };

const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [toast, setToast] = useState<ToastState | null>(null);
  const slide = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const timeLeft = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timeLeft.stopAnimation();
    Animated.timing(slide, { toValue: 0, duration: EXIT_MS, easing: EXIT_EASING_RN, useNativeDriver: true }).start(() =>
      setToast(null),
    );
  }, [slide, timeLeft]);

  const show = useCallback(
    (message: string, type: ToastType = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      // Longer messages and errors stay a little longer
      const duration = Math.min(6000, 2600 + message.length * 30) + (type === 'error' ? 1200 : 0);
      setToast({ message, type, id: Date.now() });
      slide.setValue(0);
      timeLeft.setValue(1);
      // Spring, not a fixed-length ease: the sheet decelerates into place the way iOS
      // banners do. Clamped, because any overshoot would open a gap above the top edge.
      Animated.spring(slide, { toValue: 1, ...SPRING_FILL, useNativeDriver: true }).start();
      // Success and failure get the matching iOS notification tap; plain info stays silent.
      if (type === 'success') haptic.success();
      else if (type === 'error') haptic.error();
      Animated.timing(timeLeft, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, duration);
    },
    [slide, timeLeft, hide],
  );

  const tone = toast?.type === 'error' ? colors.error : toast?.type === 'info' ? colors.primary : colors.sage;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {toast && (
        <Animated.View
          style={[
            s.sheet,
            {
              opacity: slide,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }],
            },
          ]}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Sajiwa: ${toast.message}`}
            accessibilityHint="Ketuk untuk menutup"
            style={s.clip}
          >
            {/* Frosted glass: blur of what's underneath + a tint so text always has contrast */}
            <BlurView
              intensity={Platform.OS === 'android' ? 40 : 60}
              tint="light"
              // No Android blur since SDK 55 (it needs a <BlurTargetView> around the
              // whole screen); the tint below keeps the toast readable on its own
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, s.tint]} />

            <View style={[s.row, { paddingTop: insets.top + 10 }]}>
              <Image source={CHARACTER[FACE[toast.type]]} style={compact ? s.faceSm : s.face} resizeMode="contain" />
              <Text style={[s.text, compact && s.textSm, { color: colors.onSurface }]}>{toast.message}</Text>
            </View>

            {/* Time left before it tucks itself away */}
            <View style={s.track}>
              <Animated.View style={[s.bar, { backgroundColor: tone, transform: [{ scaleX: timeLeft }] }]} />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const s = StyleSheet.create({
  // Anchored to the top edge, full width: reads as part of the screen, not a sticker on top of it
  sheet: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    boxShadow: '0px 12px 28px rgba(28,36,71,0.16)',
  },
  clip: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  tint: { backgroundColor: 'rgba(228,232,238,0.72)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  face: { width: 54, height: 54 },
  faceSm: { width: 44, height: 44 },
  text: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 21 },
  textSm: { fontSize: 14, lineHeight: 19 },
  track: { height: 3, marginHorizontal: 28, marginBottom: 10, borderRadius: 2, backgroundColor: 'rgba(28,36,71,0.08)', overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2, transformOrigin: 'left' },
});

export default ToastProvider;
