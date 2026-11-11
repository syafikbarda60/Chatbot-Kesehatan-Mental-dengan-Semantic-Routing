// One motion language for the whole app, tuned on the privacy walkthrough, the screen whose
// movement already felt right. Every animation picks one of these instead of its own numbers,
// so a dialog, a drawer, a toast and a button press each move differently but plainly belong
// to the same app: one soft spring family for arriving, one quick accelerating curve for leaving.
import { Platform, Easing as RNEasing } from 'react-native';
import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** Arriving: screen content, sheets, dialogs, drawers, chat bubbles. Soft, settles without a visible bounce. */
export const SPRING = { damping: 26, stiffness: 220, mass: 0.9 } as const;
/** Direct feedback under a finger (press, send). The same feel, about twice as quick. */
export const SPRING_QUICK = { damping: 30, stiffness: 420, mass: 0.7 } as const;
/** Things that must stop exactly at their target: filling bars, unfolding panels, a banner at the screen edge. */
export const SPRING_FILL = { ...SPRING, overshootClamping: true } as const;

/** Leaving: short and accelerating, so whatever goes away never lingers. */
export const EXIT_MS = 200;
/** Plain fades: web entrances (Reanimated's web layout path mispositions sliding ones) and reduced motion. */
export const FADE_MS = 220;
const EXIT_BEZIER = [0.4, 0, 1, 1] as const;

/** Exit timing for Reanimated's withTiming. */
export const EXIT = { duration: EXIT_MS, easing: Easing.bezier(...EXIT_BEZIER) };
/** The same exit curve for React Native's Animated. */
export const EXIT_EASING_RN = RNEasing.bezier(...EXIT_BEZIER);

/** Entering animation for a layout builder (FadeInDown, FadeInLeft, …) on the shared spring. */
export const arrive = (builder: { springify(): ReturnType<typeof FadeInDown.springify> }) =>
  Platform.OS === 'web'
    ? FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.System)
    : builder
        .springify()
        .damping(SPRING.damping)
        .stiffness(SPRING.stiffness)
        .mass(SPRING.mass)
        .reduceMotion(ReduceMotion.System);
