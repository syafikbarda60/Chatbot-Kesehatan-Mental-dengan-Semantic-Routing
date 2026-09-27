// Companion character. Static everywhere by default; `animated` (chat only) adds a quiet
// face change (fade out, swap, fade in with a small rise) and a barely-there idle breath.
// One face is visible at a time, so there is never a ghost of the previous pose.
import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, Easing, Pressable, StyleSheet, AccessibilityInfo } from 'react-native';
import { EXPRESSION_STATUS, isHeavy, type Expression } from '@prototype/utils';
import { CHARACTER } from '../../constants/character';

const TAP_FACES: Expression[] = ['wink', 'jempol', 'senang', 'menyapa'];
const ALL = Object.values(CHARACTER);
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const t = (v: Animated.Value, toValue: number, duration: number) =>
  Animated.timing(v, { toValue, duration, easing: EASE, useNativeDriver: true });

interface Props {
  expression: Expression;
  size?: number;
  animated?: boolean;     // chat only
  interactive?: boolean;  // tap for a playful face (animated mode only)
}

export const Companion: React.FC<Props> = ({ expression, size = 104, animated = false, interactive = animated }) => {
  if (!animated) {
    return (
      <Image
        source={CHARACTER[expression]}
        resizeMode="contain"
        style={{ width: size, height: size }}
        accessibilityRole="image"
        accessibilityLabel={`Sajiwa ${EXPRESSION_STATUS[expression]}`}
      />
    );
  }
  return <LiveCompanion expression={expression} size={size} interactive={interactive} />;
};

const LiveCompanion: React.FC<Required<Omit<Props, 'animated'>>> = ({ expression, size, interactive }) => {
  const [override, setOverride] = useState<Expression | null>(null);
  const target = override ?? expression;
  const [shown, setShown] = useState<Expression>(target);

  const fade = useRef(new Animated.Value(1)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);
  const busy = useRef(false);
  const shownRef = useRef(target);
  const latest = useRef(target);
  const tapIdx = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((rm) => {
        reduceMotion.current = !!rm;
        if (rm) return;
        loop = Animated.loop(Animated.sequence([t(breath, 1, 2400), t(breath, 0, 2400)]));
        loop.start();
      });
    return () => {
      loop?.stop();
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const swap = () => {
    const next = latest.current;
    if (busy.current || next === shownRef.current) return;
    if (reduceMotion.current) {
      shownRef.current = next;
      setShown(next);
      return;
    }
    busy.current = true;
    const slow = isHeavy(next);
    t(fade, 0, 120).start(() => {
      shownRef.current = next;
      setShown(next);
      t(fade, 1, slow ? 360 : 220).start(() => {
        busy.current = false;
        swap(); // a newer face arrived meanwhile
      });
    });
  };

  useEffect(() => {
    latest.current = target;
    swap();
  }, [target]);

  useEffect(() => setOverride(null), [expression]);

  const handleTap = () => {
    if (isHeavy(expression)) return; // heavy moment: no playful faces
    setOverride(TAP_FACES[tapIdx.current++ % TAP_FACES.length]);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setOverride(null), 1800);
  };

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    <Pressable
      onPress={interactive ? handleTap : undefined}
      disabled={!interactive}
      style={{ width: size, height: size }}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`Sajiwa ${EXPRESSION_STATUS[shown]}${interactive ? '. Ketuk untuk menyapa.' : ''}`}
    >
      <Animated.Image
        source={CHARACTER[shown]}
        resizeMode="contain"
        style={{ width: size, height: size, transformOrigin: 'bottom', opacity: fade, transform: [{ translateY }, { scale }] }}
      />
      {/* Decode every face up front so a swap never waits on image loading */}
      <View style={s.preload}>
        {ALL.map((src, i) => <Image key={i} source={src} style={s.preloadImg} />)}
      </View>
    </Pressable>
  );
};

const s = StyleSheet.create({
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' },
  preloadImg: { width: 1, height: 1 },
});

export default Companion;
