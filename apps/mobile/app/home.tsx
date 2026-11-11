import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle,
  useReducedMotion, useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, BOTTOM_CLEARANCE, FadeIn, useToast, clockTime, haptic, useTabSwipeLock } from '../components/ui';
import { offsetOf, PagerDots } from '../components/ui/Pager';
import { Companion } from '../components/chat';
import { useAuth } from '@prototype/ui-shared';
import type { Expression } from '@prototype/utils';
import {
  apiSaveJournal, apiUpdateJournal, apiGetJournals,
} from '@prototype/api-client';
import { MOODS, Mood, moodOf, MOOD_COMPANION, todayPrompt } from '../constants/moods';
import { TRI, triRaised, triInset } from '../constants/palette';
import { PressableScale } from '../components/ui';
import { useInboxState } from '../hooks/useInbox';
import { useUpcomingSession } from '../hooks/useUpcomingSession';

// Home trials the role-based palette: navy = Sajiwa/chat, sage = journal, amber = counseling, coral = crisis

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CHECKIN_PREFIX = 'Check-in cepat:';
// Switching mood within this window is a correction (update); later it's a real change (new entry)
const CORRECTION_MS = 30 * 60 * 1000;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// What Sajiwa asks, and how it looks, depends on the time of day
const moment = () => {
  const h = new Date().getHours();
  if (h < 11) return { greet: 'Selamat pagi', ask: 'Pagi ini gimana perasaanmu?', face: 'semangat' as Expression };
  if (h < 15) return { greet: 'Selamat siang', ask: 'Siang ini gimana harimu?', face: 'senang' as Expression };
  if (h < 18) return { greet: 'Selamat sore', ask: 'Sore ini gimana perasaanmu?', face: 'menyapa' as Expression };
  if (h < 22) return { greet: 'Selamat malam', ask: 'Malam ini, ada yang ingin kamu ceritakan?', face: 'tenang' as Expression };
  return { greet: 'Selamat malam', ask: 'Belum tidur? Aku temani sebentar.', face: 'mengantuk' as Expression };
};

type Slide = { kicker: string; title: string; face: Expression; cta: string; icon: keyof typeof Ionicons.glyphMap; tint: string; to: string };

// Each page spans the full screen width and holds the card inside the screen's own 20pt
// gutter, so while swiping the neighbouring card shows up across a gap, App Store style.
const GUTTER = 20;
// Room for the raised shadow (9px offset + 20px blur), which the pager would otherwise clip
const SHADOW = 26;

/** One hero card. The card rides the scroll; inside it the companion and the words move at
 *  their own speeds, so the swipe reads as layered rather than a flat slide. */
const HeroSlide: React.FC<{ slide: Slide; index: number; width: number; scrollX: SharedValue<number>; reduce: boolean }> = ({
  slide, index, width, scrollX, reduce,
}) => {
  const artStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const p = offsetOf(scrollX.value, index, width);
    return {
      opacity: interpolate(p, [-1, 0, 1], [0.2, 1, 0.2], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [-1, 0, 1], [width * 0.25, 0, -width * 0.25], Extrapolation.CLAMP) },
        { scale: interpolate(p, [-1, 0, 1], [0.6, 1, 0.6], Extrapolation.CLAMP) },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const p = offsetOf(scrollX.value, index, width);
    return {
      opacity: interpolate(p, [-0.7, 0, 0.7], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(p, [-1, 0, 1], [width * 0.1, 0, -width * 0.1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={[s.heroPage, { width }]}>
      <View style={[s.hero, { boxShadow: triRaised(1) }]}>
        <View style={s.heroTop}>
          <Animated.View style={[{ flex: 1, gap: 8 }, textStyle]}>
            <Text style={s.heroKicker}>{slide.kicker}</Text>
            <Text style={s.heroTitle}>{slide.title}</Text>
          </Animated.View>
          {/* Neumorphism on navy: shadows are navy tints, not grey */}
          <Animated.View style={[s.heroStage, artStyle]}>
            <View style={s.heroWell}>
              <Companion expression={slide.face} size={92} />
            </View>
          </Animated.View>
        </View>
        <PressableScale
          onPress={() => router.push(slide.to as any)}
          accessibilityRole="button"
          style={({ pressed }) => [s.heroCta, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <Ionicons name={slide.icon} size={18} color={slide.tint} />
          <Text style={s.heroCtaText}>{slide.cta}</Text>
          <Ionicons name="arrow-forward" size={18} color={TRI.navy} />
        </PressableScale>
      </View>
    </View>
  );
};

/** The hero, paged sideways. One haptic tick per card reached; with reduce motion on, cards just page. */
// The gesture-handler ScrollView takes part in gesture negotiation, so a drag on the cards
// pages the cards instead of switching tabs (the root layout's swipe).
const PagerScroll = Animated.createAnimatedComponent(GestureScrollView);

const HeroCarousel: React.FC<{ slides: Slide[] }> = ({ slides }) => {
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollX.value = e.contentOffset.x; });
  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (now, before) => { if (before !== null && now !== before) runOnJS(haptic.select)(); },
    [width],
  );

  return (
    <View style={{ gap: 12 }}>
      <PagerScroll
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={s.heroPager}
      >
        {slides.map((sl, i) => (
          <HeroSlide key={sl.to} slide={sl} index={i} width={width} scrollX={scrollX} reduce={reduce} />
        ))}
      </PagerScroll>
      <PagerDots count={slides.length} width={width} scrollX={scrollX} color={TRI.navy} />
    </View>
  );
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const { unread } = useInboxState();
  const now = useMemo(moment, []);

  const [journals, setJournals] = useState<any[]>([]);
  const { upcoming: next } = useUpcomingSession();
  const [savingMood, setSavingMood] = useState<Mood | null>(null);
  const [checkin, setCheckin] = useState<any | null>(null); // the entry saved by the quick check-in
  const [draft, setDraft] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGetJournals(30, 0);
      setJournals(res.journals || []);
    } catch (err) {
      console.warn('Failed to load journals for home:', err);
      toast.show('Data jurnal belum bisa dimuat. Periksa koneksimu.', 'error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Today's latest entry counts as today's check-in
  const todayEntry = useMemo(() => {
    const t = dayKey(new Date());
    return journals.find((j) => dayKey(new Date(j.created_at)) === t) ?? null;
  }, [journals]);
  // Latest quick check-in (journals come newest first)
  const lastCheckin = useMemo(() => journals.find((j) => j.content?.startsWith(CHECKIN_PREFIX)) ?? null, [journals]);
  const current = checkin ?? todayEntry;
  const currentMood = moodOf(current?.mood);
  const todayJournal = useMemo(() => {
    const t = dayKey(new Date());
    return journals.find((j) => dayKey(new Date(j.created_at)) === t && !j.content?.startsWith(CHECKIN_PREFIX)) ?? null;
  }, [journals]);
  const prompt = useMemo(todayPrompt, []);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  useTabSwipeLock(!!draft.trim()); // an unsaved journal line survives a stray swipe

  const quickCheckin = async (m: Mood) => {
    if (savingMood || current?.mood === m) return;
    setSavingMood(m);
    const label = moodOf(m)!.label.toLowerCase();
    const content = `${CHECKIN_PREFIX} merasa ${label}.`;
    // Quick re-tap = correction of the recent check-in; a later mood change is kept as its own entry
    const existing = [checkin, lastCheckin].find((j) => j?.journal_id && Date.now() - new Date(j.created_at).getTime() < CORRECTION_MS);
    try {
      const res: any = existing
        ? await apiUpdateJournal(existing.journal_id, { content, mood: m })
        : await apiSaveJournal({ content, mood: m });
      setCheckin(res.journal ?? { ...existing, mood: m });
      toast.show(existing ? `Check-in diperbarui: ${label}.` : `Check-in tersimpan: ${label}.`);
      load();
    } catch (e: any) {
      toast.show(`Check-in belum tersimpan: ${e.message || 'coba lagi sebentar.'}`, 'error');
    } finally {
      setSavingMood(null);
    }
  };

  // Saved with the mood picked above, so writing never means answering the same question twice
  const saveJournal = async () => {
    const text = draft.trim();
    if (!text || savingJournal) return;
    setSavingJournal(true);
    try {
      await apiSaveJournal({ content: text, mood: (current?.mood as Mood) ?? undefined });
      setDraft('');
      toast.show('Jurnal tersimpan. Terima kasih sudah menulis hari ini.');
      load();
    } catch (e: any) {
      toast.show(`Jurnal belum tersimpan: ${e.message || 'coba lagi sebentar.'}`, 'error');
    } finally {
      setSavingJournal(false);
    }
  };

  const openEntry = (j: any) =>
    router.push({ pathname: '/journal-detail', params: { journal_id: j.journal_id, content: j.content, mood: j.mood, created_at: j.created_at } });

  // Last 7 days ending today: dominant mood per day, streak, and a one-line reading
  const week = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const entries = journals.filter((j) => dayKey(new Date(j.created_at)) === dayKey(d) && j.mood);
      const tally: Record<string, number> = {};
      entries.forEach((j) => (tally[j.mood] = (tally[j.mood] || 0) + 1));
      const mood = (Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] as Mood) ?? null;
      return { date: d, mood, isToday: i === 6 };
    });
    let streak = 0;
    const has = new Set(journals.map((j) => dayKey(new Date(j.created_at))));
    const cur = new Date(today);
    if (!has.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (has.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }

    const counts: Record<string, number> = {};
    days.forEach((d) => d.mood && (counts[d.mood] = (counts[d.mood] || 0) + 1));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    const tie = ranked[1] && ranked[1][1] === top?.[1]; // no single dominant mood: don't pretend there is
    const heavy = days.filter((d) => d.mood === 'anxious' || d.mood === 'tired').map((d) => DAY_LONG[d.date.getDay()]);
    let insight = 'Belum ada check-in minggu ini. Satu ketukan di atas sudah cukup untuk mulai.';
    if (top) {
      insight = tie ? 'Suasana hatimu cukup beragam minggu ini.' : `${moodOf(top[0])!.label} paling sering muncul.`;
      if (heavy.length) insight += ` ${heavy.slice(0, 2).join(' dan ')} terasa lebih berat.`;
    }
    return { days, streak, insight };
  }, [journals]);


  const firstName = user?.name?.split(' ')[0];
  const initials = (user?.name || 'S').split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('');
  const face: Expression = current?.mood ? MOOD_COMPANION[current.mood as Mood].face : now.face;

  // Only pages the bottom nav does not already reach, and that nothing else on this screen links to
  const shortcuts = [
    { icon: 'time-outline', label: 'Riwayat chat', hint: 'Lanjutkan cerita', color: TRI.navy, to: '/chat-history' },
    { icon: 'call-outline', label: 'Hotline', hint: 'Bantuan darurat', color: TRI.coral, to: '/hotline' },
  ];

  // Talk now first; then the two other ways in that need a nudge more than a tab icon gives
  const slides: Slide[] = [
    { kicker: 'Sajiwa siap mendengarkan', title: now.ask, face, cta: 'Mulai cerita baru', icon: 'chatbubble-ellipses', tint: TRI.navy, to: '/chat' },
    { kicker: 'Konseling kampus', title: 'Mau ngobrol langsung dengan konselor?', face: 'menyapa', cta: 'Pilih jadwal konseling', icon: 'calendar', tint: TRI.amber, to: '/schedule' },
    { kicker: 'Asesmen DASS-21', title: 'Kenali kondisi emosimu lewat beberapa pertanyaan singkat', face: 'berpikir', cta: 'Mulai asesmen', icon: 'clipboard', tint: TRI.sage, to: '/assessment' },
  ];

  return (
    <View style={[s.root, { backgroundColor: TRI.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + BOTTOM_CLEARANCE }]}
      >
        {/* ── Header ── */}
        <FadeIn>
            <View style={s.header}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.eyebrow}>
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                {/* One line, two voices: the greeting recedes so the name carries the weight */}
                <Text style={s.greet} accessibilityRole="header" numberOfLines={2}>
                  {firstName ? (
                    <>
                      <Text style={s.greetSoft}>{now.greet},</Text>
                      <Text style={s.greetName}> {firstName}</Text>
                    </>
                  ) : (
                    <Text style={s.greetName}>{now.greet}</Text>
                  )}
                </Text>
              </View>
              <PressableScale
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
                style={({ pressed }) => [s.avatar, { boxShadow: pressed ? triInset(0.5) : triRaised(0.5) }]}
              >
                <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={21} color={TRI.navy} />
                {unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
              </PressableScale>
              <PressableScale
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Profil"
                style={({ pressed }) => [s.avatar, { boxShadow: pressed ? triInset(0.5) : triRaised(0.5) }]}
              >
                <Text style={s.avatarText}>{initials}</Text>
              </PressableScale>
            </View>
        </FadeIn>

        {/* ── Hero: talk now, or one of the other ways in; swipe sideways ── */}
        <FadeIn>
          <HeroCarousel slides={slides} />
        </FadeIn>

        {/* ── One-tap check-in (journal = sage) ── */}
        <FadeIn>
            <View style={{ gap: 14 }}>
              <View style={s.rowBetween}>
                <Text style={s.section} accessibilityRole="header">Check-in cepat</Text>
                <PressableScale
                  onPress={() => router.push({ pathname: '/journal', params: draft.trim() ? { draft } : {} })}
                  hitSlop={10}
                  accessibilityRole="link"
                >
                  <Text style={[s.link, { color: TRI.sage }]}>Tulis lengkap</Text>
                </PressableScale>
              </View>
              <View style={s.moodRow} accessibilityRole="radiogroup">
                {MOODS.map((m) => {
                  const active = current?.mood === m.key;
                  const saving = savingMood === m.key;
                  return (
                    <PressableScale
                      key={m.key}
                      onPress={() => quickCheckin(m.key)}
                      disabled={!!savingMood}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, busy: saving }}
                      accessibilityLabel={`Check-in ${m.label}`}
                      style={({ pressed }) => [s.moodKey, { boxShadow: active || pressed ? triInset(0.8) : triRaised(0.55) }]}
                    >
                      <View style={[s.moodIcon, { backgroundColor: active ? m.color : m.color + '1F' }]}>
                        {saving ? (
                          <ActivityIndicator size="small" color={m.color} />
                        ) : (
                          <Ionicons name={m.icon.replace('-outline', '') as any} size={20} color={active ? '#fff' : m.color} />
                        )}
                      </View>
                      <Text
                        style={[s.moodLabel, { color: active ? m.color : TRI.sub, fontFamily: active ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold' }]}
                      >
                        {m.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              {todayJournal ? (
                <PressableScale
                  onPress={() => openEntry(todayJournal)}
                  accessibilityRole="button"
                  accessibilityLabel="Baca jurnal hari ini"
                  style={[s.note, { backgroundColor: TRI.sageFill }]}
                >
                  <Ionicons name="checkmark-circle" size={16} color={TRI.sage} />
                  <Text style={[s.noteText, { color: TRI.sage }]} numberOfLines={1}>
                    Sudah menulis hari ini. Ketuk untuk membacanya.
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={TRI.sage} />
                </PressableScale>
              ) : (
                <View style={[s.composer, { boxShadow: triRaised(0.55) }]}>
                  <Text style={s.composerPrompt}>{prompt}</Text>
                  <View style={[s.composerBox, { boxShadow: triInset(0.6) }]}>
                    <TextInput
                      style={s.composerInput}
                      placeholder="Satu kalimat saja sudah cukup."
                      placeholderTextColor={TRI.muted}
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      textAlignVertical="top"
                      accessibilityLabel="Tulis jurnal hari ini"
                    />
                  </View>
                  <View style={s.composerFoot}>
                    <Text style={s.composerHint} numberOfLines={1}>
                      {words === 0
                        ? currentMood
                          ? `Disimpan sebagai ${currentMood.label.toLowerCase()}`
                          : 'Pilih suasana di atas dulu (boleh dilewati)'
                        : `${words} kata`}
                    </Text>
                    <PressableScale
                      onPress={saveJournal}
                      disabled={!draft.trim() || savingJournal}
                      accessibilityRole="button"
                      accessibilityLabel="Simpan jurnal"
                      style={[s.saveBtn, (!draft.trim() || savingJournal) && { opacity: 0.45 }]}
                    >
                      {savingJournal ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={s.saveBtnText}>Simpan</Text>
                        </>
                      )}
                    </PressableScale>
                  </View>
                </View>
              )}
            </View>
        </FadeIn>

        {/* ── This week at a glance ── */}
        <FadeIn>
            <View style={[s.card, { boxShadow: triRaised(0.8) }]}>
              <View style={s.rowBetween}>
                <Text style={s.section} accessibilityRole="header">Minggu ini</Text>
                {week.streak > 1 && (
                  <View style={s.streak}>
                    <Ionicons name="flame" size={14} color={TRI.amber} />
                    <Text style={[s.streakText, { color: TRI.amber }]}>{week.streak} hari beruntun</Text>
                  </View>
                )}
              </View>
              <View
                style={s.week}
                accessible
                accessibilityLabel={'Suasana hati 7 hari: ' + week.days.map((d) => `${DAY_LONG[d.date.getDay()]} ${moodOf(d.mood)?.label ?? 'kosong'}`).join(', ')}
              >
                {week.days.map((d, i) => {
                  const m = moodOf(d.mood);
                  return (
                    <View key={i} style={s.weekCol}>
                      <View
                        style={[
                          s.weekDot,
                          { backgroundColor: m ? m.color : 'rgba(122,134,168,0.18)' },
                          d.isToday && { borderWidth: 2.5, borderColor: TRI.ink },
                        ]}
                      >
                        {m && <Ionicons name={m.icon.replace('-outline', '') as any} size={14} color="#fff" />}
                      </View>
                      <Text style={[s.weekDay, d.isToday && { color: TRI.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                        {d.isToday ? 'Ini' : DAY_SHORT[d.date.getDay()]}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={s.insight}>{week.insight}</Text>
              <PressableScale onPress={() => router.push('/stats')} accessibilityRole="link" style={s.inlineLink}>
                <Text style={[s.link, { color: TRI.navy }]}>Lihat laporan lengkap</Text>
                <Ionicons name="arrow-forward" size={14} color={TRI.navy} />
              </PressableScale>
            </View>
        </FadeIn>

        {/* ── Next counseling session (amber), only when there is one ── */}
        {next && (
          <FadeIn>
              <PressableScale
                onPress={() => router.push('/schedule')}
                accessibilityRole="button"
                style={({ pressed }) => [s.session, { boxShadow: pressed ? triInset(0.7) : triRaised(0.8) }]}
              >
                <View style={[s.sessionDate, { backgroundColor: TRI.amberFill }]}>
                  <Text style={s.sessionDay}>{new Date(next.start).getDate()}</Text>
                  <Text style={s.sessionMonth}>
                    {new Date(next.start).toLocaleDateString('id-ID', { month: 'short' })}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.sessionKicker, { color: TRI.amber }]}>Sesi konseling berikutnya</Text>
                  <Text style={s.sessionName} numberOfLines={1}>{next.counselor ?? 'Konselor kampus'}</Text>
                  <Text style={s.sessionMeta}>
                    {DAY_LONG[new Date(next.start).getDay()]}, {clockTime(next.start)} ·{' '}
                    {next.status === 'confirmed' ? 'confirmed' : 'menunggu konfirmasi'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TRI.muted} />
              </PressableScale>
          </FadeIn>
        )}

        {/* ── Shortcuts: the core color says which part of the app it opens ── */}
        <FadeIn>
            <View style={s.shortcuts}>
              {shortcuts.map((it) => (
                <PressableScale
                  key={it.label}
                  onPress={() => router.push(it.to as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.label}, ${it.hint}`}
                  style={({ pressed }) => [s.shortcut, { boxShadow: pressed ? triInset(0.6) : triRaised(0.6) }]}
                >
                  <View style={[s.knobCore, { backgroundColor: it.color }]}>
                    <Ionicons name={it.icon as any} size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.knobLabel} numberOfLines={1}>{it.label}</Text>
                    <Text style={s.knobHint} numberOfLines={1}>{it.hint}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
        </FadeIn>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Tracked-out small caps read as a deliberate eyebrow rather than leftover label text
  eyebrow: { fontSize: 11, color: TRI.muted, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  greet: { fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
  greetSoft: { color: TRI.sub, fontFamily: 'PlusJakartaSans_500Medium' },
  greetName: { color: TRI.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: TRI.bg, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#C2410C', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: TRI.bg },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  avatarText: { color: TRI.navy, fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 0.2 },

  heroPager: { marginHorizontal: -GUTTER, marginVertical: -SHADOW },
  heroPage: { paddingHorizontal: GUTTER, paddingVertical: SHADOW },
  hero: { flex: 1, backgroundColor: TRI.navy, borderRadius: 28, padding: 16, gap: 10, overflow: 'hidden', justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  heroTitle: { color: '#fff', fontSize: 19, lineHeight: 25, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  heroStage: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  heroWell: {
    width: 94, height: 94, borderRadius: 47, backgroundColor: TRI.navyDeep, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end',
    boxShadow: 'inset 5px 5px 10px rgba(8,14,40,0.6), inset -4px -4px 10px rgba(255,255,255,0.08)',
  },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderRadius: 23, paddingHorizontal: 18,
    backgroundColor: '#EEF1F7', boxShadow: '4px 6px 14px rgba(8,14,40,0.35)',
  },
  heroCtaText: { flex: 1, color: TRI.navy, fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },

  section: { color: TRI.ink, fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  link: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },

  moodRow: { flexDirection: 'row', gap: 12 },
  moodKey: { flex: 1, backgroundColor: TRI.bg, borderRadius: 20, paddingVertical: 10, alignItems: 'center', gap: 6 },
  moodIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  moodLabel: { fontSize: 13 },
  composer: { backgroundColor: TRI.bg, borderRadius: 20, padding: 14, gap: 10 },
  composerPrompt: { fontSize: 14, color: TRI.ink, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 19 },
  composerBox: { backgroundColor: TRI.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  composerInput: { minHeight: 58, fontSize: 14, lineHeight: 20, color: TRI.ink, fontFamily: 'PlusJakartaSans_400Regular' },
  composerFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerHint: { flex: 1, fontSize: 12, color: TRI.sub, fontFamily: 'PlusJakartaSans_500Medium' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 38, paddingHorizontal: 16, borderRadius: 14, backgroundColor: TRI.sage,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },

  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  noteText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 19 },

  card: { backgroundColor: TRI.bg, borderRadius: 24, padding: 14, gap: 10 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  week: { flexDirection: 'row' },
  weekCol: { flex: 1, alignItems: 'center', gap: 8 },
  weekDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekDay: { fontSize: 12, color: TRI.sub, fontFamily: 'PlusJakartaSans_600SemiBold' },
  insight: { fontSize: 14, color: TRI.sub, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 21 },

  session: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: TRI.bg, borderRadius: 24, padding: 14 },
  sessionDate: { width: 58, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sessionDay: { color: TRI.ink, fontSize: 23, lineHeight: 27, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sessionMonth: { color: TRI.ink, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionKicker: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionName: { color: TRI.ink, fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sessionMeta: { color: TRI.sub, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },

  shortcuts: { flexDirection: 'row', gap: 12 },
  shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TRI.bg, borderRadius: 18, padding: 12 },
  knobCore: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  knobLabel: { fontSize: 13, color: TRI.ink, fontFamily: 'PlusJakartaSans_700Bold' },
  knobHint: { fontSize: 11, color: TRI.sub, fontFamily: 'PlusJakartaSans_500Medium' },

});
