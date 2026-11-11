// Privacy consent, shown once per account before the app is used.
// A full-screen, iOS-style walkthrough: an intro, then one privacy point per page, paged
// sideways. Transitions follow the finger rather than playing on a timer — the icon grows
// in and the text trails it slightly (parallax), and the page dots stretch toward the page
// being reached. All of it runs on the UI thread; with "reduce motion" on, pages just page.
//
// Every claim below is checked against what the backend actually does; see the comments
// next to each point. Do not soften or extend them without re-checking the code.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiAcceptPrivacyConsent, apiGetPrivacyConsent } from '@prototype/api-client';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu, useAuth } from '@prototype/ui-shared';
// Direct file import: going through the chat barrel would cycle back into ui/index
import { Companion } from '../chat/Companion';
import { Button } from './Button';
import { haptic } from './haptics';
import { offsetOf, PagerDots } from './Pager';
import { EXIT, SPRING } from './motion';

type Point = { icon: keyof typeof Ionicons.glyphMap; tone: 'sage' | 'navy' | 'amber'; title: string; body: string };

const POINTS: Point[] = [
  {
    icon: 'lock-closed',
    tone: 'sage',
    // routes/chat.py encrypts message content with Fernet before it is stored
    title: 'Ceritamu disimpan terenkripsi',
    body: 'Isi percakapan dengan Sajiwa diacak sebelum disimpan, jadi tidak bisa dibaca begitu saja dari database.',
  },
  {
    icon: 'book',
    tone: 'sage',
    // db/init/01_schema.sql: policy "mahasiswa_own_journals" limits rows to the owner
    title: 'Jurnalmu hanya milikmu',
    body: 'Catatan jurnal hanya bisa dibuka lewat akunmu sendiri. Konselor dan admin tidak bisa membacanya.',
  },
  {
    icon: 'alert-circle',
    tone: 'amber',
    // routes/chat.py logs a guardrail signal; /admin/attention returns name + time only
    title: 'Tanda bahaya diteruskan, isinya tidak',
    body: 'Kalau aplikasi mendeteksi tanda krisis, konselor kampus menerima namamu dan waktunya saja, demi keselamatanmu. Isi pesanmu tidak ikut dikirim.',
  },
  {
    icon: 'clipboard',
    tone: 'navy',
    // routes/admin.py list_assessments exposes severity + identity, not per-item answers
    title: 'Hasil asesmen dilihat konselor',
    body: 'Skor dan tingkat hasil asesmenmu bisa dilihat konselor kampus agar mereka bisa menindaklanjuti.',
  },
  {
    icon: 'heart',
    tone: 'navy',
    title: 'Sajiwa bukan pengganti tenaga profesional',
    body: 'Sajiwa menemani, bukan memberi diagnosis. Dalam keadaan darurat, hubungi 112 atau IGD terdekat.',
  },
];

// Intro + one page per point
const PAGE_COUNT = POINTS.length + 1;

/** Icon and text of one page, moving at two speeds so the page reads as layered. */
const Page: React.FC<{
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  reduce: boolean;
  art: React.ReactNode;
  children: React.ReactNode;
}> = ({ index, width, scrollX, reduce, art, children }) => {
  const artStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const p = offsetOf(scrollX.value, index, width);
    return {
      opacity: interpolate(p, [-1, 0, 1], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [-1, 0, 1], [width * 0.3, 0, -width * 0.3], Extrapolation.CLAMP) },
        { scale: interpolate(p, [-1, 0, 1], [0.55, 1, 0.55], Extrapolation.CLAMP) },
      ],
    };
  });

  // Text lags behind the art: a gentler slide and a quicker fade, the iOS parallax feel
  const textStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const p = offsetOf(scrollX.value, index, width);
    return {
      opacity: interpolate(p, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(p, [-1, 0, 1], [width * 0.12, 0, -width * 0.12], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={[s.page, { width }]} accessible accessibilityRole="summary">
      <View style={s.pageInner}>
        <Animated.View style={[s.artSlot, artStyle]}>{art}</Animated.View>
        <Animated.View style={[s.textBlock, textStyle]}>{children}</Animated.View>
      </View>
    </View>
  );
};

export const ConsentSheet: React.FC = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const enter = useSharedValue(0); // 0 hidden, 1 shown
  const scrollX = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const userId = (user as { user_id?: string } | null)?.user_id;

  // Ask once per account: the acceptance is stored with the account on the server, so a
  // new phone, a reinstall, or cleared app data does not ask again.
  useEffect(() => {
    let cancelled = false;
    if (!isLoggedIn || !userId) { setOpen(false); return; }
    apiGetPrivacyConsent()
      .then((c) => { if (!cancelled && !c.accepted_at) setOpen(true); })
      // Unknown is treated as not yet accepted: asking twice is better than never asking
      .catch(() => { if (!cancelled) setOpen(true); });
    return () => { cancelled = true; };
  }, [isLoggedIn, userId]);

  useEffect(() => {
    if (!open) return;
    setPage(0);
    setSaveError(false);
    scrollX.value = 0;
    enter.value = reduce ? 1 : withSpring(1, SPRING);
  }, [open, reduce, enter, scrollX]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Track the page the scroll lands on, from the UI thread, so it works the same on web
  // (no momentum events there) and gives one haptic tick per page reached.
  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (now, before) => {
      if (before !== null && now !== before) runOnJS(setPage)(now);
    },
    [width],
  );
  useEffect(() => { if (page > 0) haptic.select(); }, [page]);

  const goTo = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: !reduce });
  }, [scrollRef, width, reduce]);

  const close = useCallback((after: () => void) => {
    if (reduce) { setOpen(false); after(); return; }
    enter.value = withTiming(0, EXIT, (done) => {
      if (done) {
        runOnJS(setOpen)(false);
        runOnJS(after)();
      }
    });
  }, [enter, reduce]);

  // Closes only once the server has it; otherwise the next sign-in would ask again
  const accept = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await apiAcceptPrivacyConsent();
      haptic.success();
      close(() => {});
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Consent has to be refusable, or it is not consent
  const decline = () => close(() => { logout().then(() => router.replace('/')); });

  const last = page >= PAGE_COUNT - 1;
  const primary = () => (last ? accept() : goTo(page + 1));
  // Android back: step back through the pages first, then decline from the first one
  const back = () => (page > 0 ? goTo(page - 1) : decline());

  const screenStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [36, 0]) }],
  }));

  if (!open) return null;

  const TONE = { sage: colors.sage, navy: colors.primary, amber: colors.amber };

  // The art for a point: a raised disc holding a sunken well, the icon inside — the same
  // neumorphic "portal" the sign-in screen uses for the companion.
  const disc = (p: Point) => (
    <View style={[s.disc, { backgroundColor: colors.background, boxShadow: Neu.raised }]}>
      <View style={[s.well, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
        <Ionicons name={p.icon} size={54} color={TONE[p.tone]} />
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={back}>
      <Animated.View style={[s.screen, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }, screenStyle]}>
        <View style={s.topBar}>
          <Text style={[s.eyebrow, { color: colors.textMuted }]}>Sebelum mulai</Text>
          <Text style={[s.counter, { color: colors.textMuted }]} accessibilityLabel={`Halaman ${page + 1} dari ${PAGE_COUNT}`}>
            {page + 1}/{PAGE_COUNT}
          </Text>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={s.pager}
        >
          <Page
            index={0}
            width={width}
            scrollX={scrollX}
            reduce={reduce}
            art={<Companion expression="tenang" size={190} />}
          >
            <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">Privasi ceritamu</Text>
            <Text style={[s.body, { color: colors.onSurfaceVariant }]}>
              Sebelum kita ngobrol, ini cara Sajiwa menjaga ceritamu. Geser untuk membaca satu per satu.
            </Text>
          </Page>

          {POINTS.map((p, i) => (
            <Page key={p.title} index={i + 1} width={width} scrollX={scrollX} reduce={reduce} art={disc(p)}>
              <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">{p.title}</Text>
              <Text style={[s.body, { color: colors.onSurfaceVariant }]}>{p.body}</Text>
              {i === POINTS.length - 1 && (
                <Text style={[s.footnote, { color: colors.textMuted }]}>
                  Kamu bisa menghapus jurnal kapan saja lewat halaman Jurnal.
                </Text>
              )}
            </Page>
          ))}
        </Animated.ScrollView>

        <View style={s.dots}>
          <PagerDots count={PAGE_COUNT} width={width} scrollX={scrollX} color={colors.primary} />
        </View>

        <View style={s.actions}>
          {saveError && (
            <Text style={[s.error, { color: colors.error }]} accessibilityLiveRegion="polite">
              Persetujuan belum tersimpan. Periksa koneksimu, lalu coba lagi.
            </Text>
          )}
          <Button
            loading={saving}
            label={last ? 'Saya mengerti dan setuju' : 'Lanjut'}
            onPress={primary}
            icon={last ? undefined : <Ionicons name="arrow-forward" size={18} color="#fff" />}
          />
          <Pressable onPress={decline} accessibilityRole="button" style={s.decline} hitSlop={8}>
            <Text style={[s.declineText, { color: colors.onSurfaceVariant }]}>Belum sekarang, keluar dulu</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
};

const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  eyebrow: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  counter: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },

  // The Modal hands web focus to the scroll area, which drew a black focus box around the
  // whole page. Keyboard users still page with the buttons, which keep their focus ring.
  pager: { flex: 1, outlineWidth: 0 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  // Readable line length on a tablet or a wide browser window too
  pageInner: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 34 },
  artSlot: { alignItems: 'center', justifyContent: 'center', minHeight: 210 },
  disc: { width: 196, height: 196, borderRadius: 98, alignItems: 'center', justifyContent: 'center' },
  well: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  textBlock: { alignItems: 'center', gap: 12 },
  title: { fontSize: 27, lineHeight: 33, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, textAlign: 'center' },
  body: { fontSize: 15.5, lineHeight: 24, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  footnote: { fontSize: 12.5, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: 4 },

  dots: { marginBottom: 22 },

  actions: { gap: 4, paddingHorizontal: 24, width: '100%', maxWidth: 488, alignSelf: 'center' },
  error: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', marginBottom: 8 },
  decline: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  declineText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

export default ConsentSheet;
