// Springy press feedback shared by buttons and tappable cards: shrink a touch on press-in,
// bounce back on release. Runs on the UI thread; skipped when the OS asks for reduced motion.
import { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from 'react-native-reanimated';

export function usePressScale(pressedScale = 0.96) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { if (!reduce) scale.value = withSpring(pressedScale, { damping: 15, stiffness: 400 }); },
    onPressOut: () => { scale.value = withSpring(1, { damping: 10, stiffness: 260 }); },
  };
}
