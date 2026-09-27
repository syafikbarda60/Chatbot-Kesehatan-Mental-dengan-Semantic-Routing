// Non-blocking feedback, told by the companion: a small face + speech bubble that drops in under
// the status bar, never covers the page or blocks touches, and dismisses itself (or on tap).
// Use for "saved / failed" results; keep real modals for decisions (e.g. delete).
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import type { Expression } from '@prototype/utils';
import { CHARACTER } from '../../constants/character';

// The companion's face carries the tone, so the bubble needs no icons or colored stripes
const FACE: Record<'success' | 'error' | 'info', Expression> = { success: 'jempol', error: 'bingung', info: 'senang' };

type ToastType = 'success' | 'error' | 'info';
interface ToastState { type: ToastType; message: string; id: number }
interface ToastApi { show: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380; // small phones: smaller face and text so the bubble keeps room
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() =>
      setToast(null),
    );
  }, [anim]);

  const show = useCallback(
    (message: string, type: ToastType = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type, id: Date.now() });
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
      // Longer messages and errors stay a little longer
      timer.current = setTimeout(hide, Math.min(6000, 2400 + message.length * 30) + (type === 'error' ? 1200 : 0));
    },
    [anim, hide],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        // box-none: only the toast itself is touchable, the page underneath stays usable
        <View style={[s.host, { top: insets.top + 6 }]}>
          <Animated.View
            style={{
              width: '100%', // definite width so the bubble wraps instead of running off-screen
              alignItems: 'center',
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            }}
          >
            <Pressable
              onPress={hide}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Sajiwa: ${toast.message}`}
              accessibilityHint="Ketuk untuk menutup"
              style={s.row}
            >
              {/* The sticker already has its own white die-cut border: no container needed */}
              <Image source={CHARACTER[FACE[toast.type]]} style={compact ? s.faceSm : s.face} resizeMode="contain" />
              <View style={[s.bubble, { backgroundColor: colors.background, boxShadow: Neu.raised }]}>
                <Text style={[s.text, compact && s.textSm, { color: colors.onSurface }]}>{toast.message}</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

const s = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000, pointerEvents: 'box-none' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, maxWidth: 440 },
  face: { width: 58, height: 58, marginBottom: -6 },
  faceSm: { width: 46, height: 46, marginBottom: -4 },
  // Speech bubble whose tail corner points at the companion, like its chat bubbles
  bubble: { flexShrink: 1, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, borderBottomLeftRadius: 6 },
  text: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },
  textSm: { fontSize: 13, lineHeight: 18 },
});

export default ToastProvider;
