// Companion character that reacts to the conversation.
// Idle: breathes, bobs and sways. Face change: the old pose squashes out, the new one
// pops in (only one pose is ever visible, so no ghosting), then plays a motion that
// fits the emotion and settles into that emotion's resting pose.
import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, Easing, Pressable, StyleSheet, AccessibilityInfo } from 'react-native';
import { EXPRESSION_STATUS, type Expression } from '@prototype/utils';
import { CHARACTER } from '../../constants/character';

const TAP_FACES: Expression[] = ['wink', 'jempol', 'tertawa', 'semangat', 'menyapa'];
const ALL = Object.values(CHARACTER);
const SOFT = Easing.bezier(0.45, 0, 0.55, 1);

type Vals = { hop: Animated.Value; tilt: Animated.Value; shake: Animated.Value; stretch: Animated.Value };

// Resting head tilt (deg) after the motion finishes: gives each emotion a held posture
const REST_TILT: Partial<Record<Expression, number>> = { berpikir: -5, bingung: 4, mengantuk: 7, malu: -3 };

const t = (v: Animated.Value, toValue: number, duration: number, easing = SOFT) =>
  Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
const bounce = (v: Animated.Value, toValue: number, friction = 5, tension = 140) =>
  Animated.spring(v, { toValue, friction, tension, useNativeDriver: true });

// One motion per emotion (hop: 1 = 12px up, tilt: degrees, shake: px, stretch: 1 = normal)
const MOTION: Record<Expression, (v: Vals) => Animated.CompositeAnimation> = {
  senang: ({ hop }) => Animated.sequence([t(hop, 0.6, 140), bounce(hop, 0)]),
  menyapa: ({ tilt, hop }) => Animated.parallel([
    Animated.sequence([t(hop, 0.5, 140), bounce(hop, 0)]),
    Animated.sequence([t(tilt, 7, 130), t(tilt, -6, 170), t(tilt, 6, 170), t(tilt, -4, 170), t(tilt, 0, 200)]),
  ]),
  semangat: ({ hop, stretch }) => Animated.sequence([
    Animated.parallel([t(stretch, 0.9, 90), t(hop, 0, 90)]),
    Animated.parallel([t(stretch, 1.08, 150), t(hop, 1.2, 150, Easing.out(Easing.quad))]),
    Animated.parallel([bounce(stretch, 1), t(hop, 0, 200, Easing.in(Easing.quad))]),
    t(hop, 0.6, 120, Easing.out(Easing.quad)),
    bounce(hop, 0),
  ]),
  tertawa: ({ shake, stretch }) => Animated.parallel([
    Animated.sequence([t(shake, 3, 60), t(shake, -3, 70), t(shake, 3, 70), t(shake, -3, 70), t(shake, 2, 70), t(shake, 0, 80)]),
    Animated.sequence([t(stretch, 1.05, 120), t(stretch, 0.97, 120), t(stretch, 1.03, 120), bounce(stretch, 1)]),
  ]),
  wink: ({ tilt, hop }) => Animated.parallel([
    Animated.sequence([t(tilt, 8, 160), t(tilt, 0, 360)]),
    Animated.sequence([t(hop, 0.3, 140), bounce(hop, 0)]),
  ]),
  jempol: ({ stretch }) => Animated.sequence([t(stretch, 1.12, 150, Easing.out(Easing.back(2))), bounce(stretch, 1, 4, 120)]),
  // Calm: no hop, just a slow settle — never bouncy in a heavy moment
  tenang: ({ stretch }) => Animated.sequence([t(stretch, 0.97, 500), t(stretch, 1, 700)]),
  berpikir: ({ tilt }) => t(tilt, REST_TILT.berpikir!, 500),
  bingung: ({ tilt }) => Animated.sequence([t(tilt, -7, 180), t(tilt, 7, 220), t(tilt, -5, 220), t(tilt, REST_TILT.bingung!, 260)]),
  terkejut: ({ hop, stretch }) => Animated.sequence([
    Animated.parallel([t(hop, 1.5, 120, Easing.out(Easing.quad)), t(stretch, 1.12, 120)]),
    Animated.parallel([bounce(hop, 0, 6, 110), bounce(stretch, 1, 6, 110)]),
  ]),
  malu: ({ stretch, tilt }) => Animated.parallel([
    Animated.sequence([t(stretch, 0.9, 220), t(stretch, 0.96, 500)]),
    t(tilt, REST_TILT.malu!, 400),
  ]),
  mengantuk: ({ tilt, hop }) => Animated.parallel([
    t(tilt, REST_TILT.mengantuk!, 1200),
    Animated.sequence([t(hop, -0.25, 900), t(hop, -0.15, 600)]),
  ]),
};

interface Props {
  expression: Expression;
  size?: number;          // <= ~120 keeps the 486px sources crisp
  interactive?: boolean;  // tap for a playful reaction
}

export const Companion: React.FC<Props> = ({ expression, size = 104, interactive = true }) => {
  const [override, setOverride] = useState<Expression | null>(null);
  const target = override ?? expression;
  const [shown, setShown] = useState<Expression>(target);

  const idle = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const vals = useRef<Vals>({
    hop: new Animated.Value(0),
    tilt: new Animated.Value(REST_TILT[target] ?? 0),
    shake: new Animated.Value(0),
    stretch: new Animated.Value(1),
  }).current;

  const reduceMotion = useRef(false);
  const animating = useRef(false);
  const shownRef = useRef<Expression>(target);
  const latest = useRef<Expression>(target);
  const tapIdx = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((rm) => {
        reduceMotion.current = !!rm;
        if (rm) return;
        loops = [
          Animated.loop(Animated.sequence([t(idle, 1, 1600), t(idle, 0, 1600)])),
          Animated.loop(Animated.sequence([t(sway, 1, 2600), t(sway, -1, 2600)])),
        ];
        loops.forEach((l) => l.start());
      });
    return () => {
      loops.forEach((l) => l.stop());
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const runSwap = () => {
    const next = latest.current;
    if (animating.current || next === shownRef.current) return;
    if (reduceMotion.current) {
      shownRef.current = next;
      setShown(next);
      vals.tilt.setValue(REST_TILT[next] ?? 0);
      return;
    }
    animating.current = true;
    const calm = next === 'tenang';
    Animated.timing(pop, { toValue: 0, duration: calm ? 180 : 110, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      shownRef.current = next;
      setShown(next);
      // Reset transient motion; tilt eases from the previous rest pose inside the motion
      vals.hop.setValue(0);
      vals.shake.setValue(0);
      vals.stretch.setValue(1);
      const settleTilt = REST_TILT[next] === undefined ? t(vals.tilt, 0, 300) : null;
      Animated.parallel([
        calm ? t(pop, 1, 420) : bounce(pop, 1, 5, 170),
        MOTION[next](vals),
        ...(settleTilt && next !== 'menyapa' && next !== 'wink' ? [settleTilt] : []),
      ]).start(() => {
        animating.current = false;
        runSwap(); // a newer face arrived mid-animation: go straight to it
      });
    });
  };

  useEffect(() => {
    latest.current = target;
    runSwap();
  }, [target]);

  useEffect(() => {
    setOverride(null);
  }, [expression]);

  const handleTap = () => {
    if (expression === 'tenang') {
      // Heavy moment: stay calm, just a soft nod
      if (!reduceMotion.current) Animated.sequence([t(vals.hop, -0.3, 260), t(vals.hop, 0, 360)]).start();
      return;
    }
    setOverride(TAP_FACES[tapIdx.current++ % TAP_FACES.length]);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setOverride(null), 2000);
  };

  const translateY = Animated.add(
    idle.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
    vals.hop.interpolate({ inputRange: [-1, 2], outputRange: [12, -24] }),
  );
  const rotate = Animated.add(sway.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }), vals.tilt)
    .interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });
  const breathe = idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  // Volume-preserving squash & stretch
  const scaleY = Animated.multiply(breathe, vals.stretch);
  const scaleX = vals.stretch.interpolate({ inputRange: [0.8, 1.2], outputRange: [1.12, 0.92] });
  const popScaleX = pop.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });
  const popScaleY = pop.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const popOpacity = pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <Pressable
      onPress={interactive ? handleTap : undefined}
      disabled={!interactive}
      style={{ width: size, height: size + 12, alignItems: 'center', justifyContent: 'flex-end' }}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`Sajiwa ${EXPRESSION_STATUS[shown]}${interactive ? '. Ketuk untuk menyapa.' : ''}`}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transformOrigin: 'bottom',
          transform: [{ translateY }, { translateX: vals.shake }, { rotate }, { scaleX }, { scaleY }],
        }}
      >
        <Animated.Image
          source={CHARACTER[shown]}
          resizeMode="contain"
          style={{
            width: size,
            height: size,
            transformOrigin: 'bottom',
            opacity: popOpacity,
            transform: [{ scaleX: popScaleX }, { scaleY: popScaleY }],
          }}
        />
      </Animated.View>
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
