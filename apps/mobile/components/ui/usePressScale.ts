// Press feedback shared by buttons and tappable cards: shrink a touch on press-in, settle
// back on release, on the app's quick spring (see motion.ts): just under critical damping, so
// the release is lively but never visibly overshoots, which would read as a toy.
// Runs on the UI thread; skipped when the OS asks for reduced motion.
import { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from 'react-native-reanimated';
import { SPRING_QUICK } from './motion';

export function usePressScale(pressedScale = 0.96) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { if (!reduce) scale.value = withSpring(pressedScale, SPRING_QUICK); },
    onPressOut: () => { scale.value = withSpring(1, SPRING_QUICK); },
  };
}
