import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { BottomNav, FadeIn, NeuView, Button, ScreenHeader, IconButton, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import { apiGetJournals } from '@prototype/api-client';
import { MOODS, Mood, moodOf, todayPrompt } from '../constants/moods';

const PAGE = 30;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

type Row =
  | { type: 'month'; key: string; label: string }
  | { type: 'entry'; key: string; item: any; last: boolean };

export default function JournalHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [journals, setJournals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<Mood | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchJournals();
    }, [])
  );

  const fetchJournals = async (loadMore = false) => {
    if (isFetchingMore || (!hasMore && loadMore)) return;
    if (loadMore) setIsFetchingMore(true);
    else setIsLoading(true);
    try {
      const data = await apiGetJournals(PAGE, loadMore ? journals.length : 0);
      const newJournals = data.journals || [];
      setJournals((prev) => (loadMore ? [...prev, ...newJournals] : newJournals));
      setHasMore(newJournals.length >= PAGE);
    } catch (e) {
      console.log('Failed to fetch journals', e);
      toast.show('Jurnal belum bisa dimuat. Tarik ke bawah atau coba lagi nanti.', 'error');
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  // ── Derived: today's entry, streak, mood mix, month-grouped timeline ──
  const summary = useMemo(() => {
    const days = new Set(journals.map((j) => dayKey(new Date(j.created_at))));
    const today = new Date();
    const todayEntry = journals.find((j) => dayKey(new Date(j.created_at)) === dayKey(today));
    // Streak counts back from today (or yesterday if today is still empty)
    let streak = 0;
    const cursor = new Date(today);
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const counts = MOODS.map((m) => ({ ...m, n: journals.filter((j) => j.mood === m.key).length }));
    return { todayEntry, streak, counts, withMood: counts.reduce((a, c) => a + c.n, 0) };
  }, [journals]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const list = filter ? journals.filter((j) => j.mood === filter) : journals;
    let month = '';
    list.forEach((j, i) => {
      const d = new Date(j.created_at);
      const m = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      if (m !== month) {
        month = m;
        out.push({ type: 'month', key: `m-${m}`, label: m });
      }
      const next = list[i + 1];
      const nextMonth = next && new Date(next.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      out.push({ type: 'entry', key: j.journal_id, item: j, last: !next || nextMonth !== m });
    });
    return out;
  }, [journals, filter]);

  const openEntry = (item: any) =>
    router.push({
      pathname: '/journal-detail',
      params: { journal_id: item.journal_id, content: item.content, mood: item.mood, created_at: item.created_at },
    });

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.type === 'month') {
      return <Text style={[s.month, { color: colors.onSurface }]} accessibilityRole="header">{row.label}</Text>;
    }
    const j = row.item;
    const d = new Date(j.created_at);
    const mood = moodOf(j.mood);
    return (
      <FadeIn delay={0}>
        <View style={s.entryRow}>
          {/* Date + timeline rail */}
          <View style={s.rail}>
            <Text style={[s.day, { color: colors.onSurface }]}>{d.getDate()}</Text>
            <Text style={[s.weekday, { color: colors.onSurfaceVariant }]}>
              {d.toLocaleDateString('id-ID', { weekday: 'short' })}
            </Text>
            <View style={[s.dot, { backgroundColor: mood?.color ?? colors.outline }]} />
            {!row.last && <View style={[s.line, { backgroundColor: colors.outlineVariant }]} />}
          </View>

          <Pressable
            onPress={() => openEntry(j)}
            accessibilityRole="button"
            accessibilityLabel={`Jurnal ${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}${mood ? ', merasa ' + mood.label : ''}`}
            style={({ pressed }) => [s.card, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
          >
            <View style={s.cardHead}>
              {mood ? (
                <View style={s.moodTag}>
                  <Ionicons name={mood.icon} size={14} color={mood.color} />
                  <Text style={[s.moodText, { color: mood.color }]}>{mood.label}</Text>
                </View>
              ) : <View />}
              <Text style={[s.time, { color: colors.textMuted }]}>
                {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[s.excerpt, { color: colors.onSurface }]} numberOfLines={3}>{j.content}</Text>
          </Pressable>
        </View>
      </FadeIn>
    );
  };

  const header = (
    <View style={s.headerWrap}>
      <ScreenHeader
        title="Jurnal"
        subtitle="Catatan perjalanan perasaanmu."
        right={<IconButton icon="add" label="Tulis jurnal baru" color={colors.primary} onPress={() => router.push('/journal')} />}
      />

      {/* ── Today, told by the companion ── */}
      <NeuView radius={26} style={s.today}>
        <View style={s.todayRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[s.todayLabel, { color: colors.onSurfaceVariant }]}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[s.todayTitle, { color: colors.onSurface }]}>
              {summary.todayEntry ? 'Kamu sudah menulis hari ini.' : todayPrompt()}
            </Text>
          </View>
          <Companion expression={summary.todayEntry ? 'jempol' : 'menyapa'} size={92} interactive={false} />
        </View>
        {summary.todayEntry ? (
          <Button label="Baca catatan hari ini" variant="secondary" onPress={() => openEntry(summary.todayEntry)} />
        ) : (
          <Button label="Tulis sekarang" onPress={() => router.push('/journal')} icon={<Ionicons name="create-outline" size={18} color="#fff" />} />
        )}
      </NeuView>

      {journals.length > 0 && (
        <>
          {/* ── Stats + mood mix ── */}
          <View style={s.stats}>
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: colors.onSurface }]}>{journals.length}{hasMore ? '+' : ''}</Text>
              <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>catatan</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.outlineVariant }]} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: colors.onSurface }]}>{summary.streak}</Text>
              <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>hari berturut-turut</Text>
            </View>
          </View>

          {summary.withMood > 0 && (
            <View style={{ gap: 8 }}>
              <View
                style={[s.mixBar, { backgroundColor: colors.background, boxShadow: Neu.inset }]}
                accessible
                accessibilityLabel={'Komposisi suasana hati: ' + summary.counts.map((c) => `${c.label} ${c.n}`).join(', ')}
              >
                {summary.counts.filter((c) => c.n > 0).map((c) => (
                  <View key={c.key} style={{ flex: c.n, backgroundColor: c.color }} />
                ))}
              </View>
              <View style={s.legend}>
                {summary.counts.map((c) => (
                  <Text key={c.key} style={[s.legendText, { color: colors.onSurfaceVariant }]}>
                    <Text style={{ color: c.color }}>●</Text> {c.label} {c.n}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* ── Mood filter ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filters}>
            {[{ key: null, label: 'Semua', color: colors.primary, icon: 'albums-outline' }, ...MOODS].map((m: any) => {
              const active = filter === m.key;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => setFilter(m.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[s.filterChip, { backgroundColor: colors.background, boxShadow: active ? Neu.inset : Neu.raisedSm }]}
                >
                  <Ionicons name={m.icon} size={14} color={active ? m.color : colors.onSurfaceVariant} />
                  <Text
                    style={[
                      s.filterText,
                      { color: active ? m.color : colors.onSurfaceVariant, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={[s.listContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
          renderItem={renderRow}
          onEndReached={() => fetchJournals(true)}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={header}
          ListEmptyComponent={
            filter ? (
              <Text style={[s.emptyFilter, { color: colors.onSurfaceVariant }]}>
                Belum ada catatan dengan suasana hati {moodOf(filter)?.label.toLowerCase()}.
              </Text>
            ) : (
              <Text style={[s.emptyFilter, { color: colors.onSurfaceVariant }]}>
                Catatan yang kamu tulis akan tersusun di sini seperti buku harian.
              </Text>
            )
          }
          ListFooterComponent={
            isFetchingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20 },
  headerWrap: { gap: 20, marginBottom: 8 },

  today: { padding: 18, gap: 14 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  todayTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3, lineHeight: 24 },

  stats: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  statItem: { flex: 1, gap: 2 },
  statValue: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  statLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 16 },

  mixBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 2 },
  legendText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },

  filterScroll: { marginHorizontal: -20 },
  filters: { gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 14 },
  filterText: { fontSize: 13 },

  month: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.2, marginTop: 18, marginBottom: 12, textTransform: 'capitalize' },

  entryRow: { flexDirection: 'row', gap: 12 },
  rail: { width: 44, alignItems: 'center' },
  day: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', lineHeight: 26 },
  weekday: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 8 },
  line: { width: 2, flex: 1, borderRadius: 1, marginTop: 4, opacity: 0.8 },

  card: { flex: 1, padding: 16, borderRadius: 20, gap: 8, marginBottom: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moodText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  time: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  excerpt: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 23 },

  emptyFilter: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 21, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
});
