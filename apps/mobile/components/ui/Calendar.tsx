// Month calendar for picking a session date. Days with an open slot are tinted in the
// counseling amber and tappable; every other day is grey and disabled, so the colors alone
// answer "when can I go?". Change month with the arrows or a horizontal swipe; tap the title
// to jump straight to any month and year.
//
// Deliberately light: plain Pressables (no per-cell animated values across 42 cells), a fixed
// six-week grid so the content below never jumps between months, and one Reanimated entering
// transition on the UI thread when the month changes. The date math lives in calendarDates.ts.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, LayoutAnimationConfig } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { haptic } from './haptics';
import { arrive, FADE_MS } from './motion';
import { MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_LONG, monthCells, monthIndex, ymdOf } from './calendarDates';

export { longDate, toYmd } from './calendarDates';

interface CalendarProps {
  /** Selected date, 'YYYY-MM-DD'. */
  value: string | null;
  onChange: (date: string) => void;
  /** Dates that have at least one open slot. */
  available: ReadonlySet<string>;
  /** Earliest selectable date, normally today; the calendar never pages before its month. */
  minDate: string;
}

// The new month slides in from the side it came from, like paging a native calendar.
// Web keeps a fade: Reanimated's layout-animation path mispositions elements there.
const enterFrom = (dir: 1 | -1) => arrive(dir > 0 ? FadeInRight : FadeInLeft);

export const Calendar: React.FC<CalendarProps> = ({ value, onChange, available, minDate }) => {
  const { colors } = useTheme();
  const minMonth = monthIndex(minDate);

  const [month, setMonth] = useState(() => monthIndex(value ?? minDate));
  const [dir, setDir] = useState<1 | -1>(1);
  const [picking, setPicking] = useState(false);
  const [pickYear, setPickYear] = useState(() => Math.floor(month / 12));

  // Follow the selection when the parent moves it, e.g. "Lihat Kamis, 12 November" or a
  // counselor whose first open day is in another month. Browsing alone never moves it.
  useEffect(() => {
    if (!value) return;
    const target = monthIndex(value);
    if (target !== month) {
      setDir(target > month ? 1 : -1);
      setMonth(target);
    }
    // Only a new selection should move the view, not every page the user flips to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const goTo = (target: number) => {
    if (target < minMonth || target === month) return;
    setDir(target > month ? 1 : -1);
    setMonth(target);
    haptic.select();
  };

  const year = Math.floor(month / 12);
  const m = month % 12;

  // Months that hold any open day, for the dots in the month picker and the empty hint.
  const openMonths = useMemo(() => {
    const set = new Set<number>();
    available.forEach((s) => { if (s >= minDate) set.add(monthIndex(s)); });
    return set;
  }, [available, minDate]);
  const nextOpenMonth = useMemo(
    () => [...openMonths].filter((k) => k > month).sort((a, b) => a - b)[0],
    [openMonths, month],
  );

  const cells = useMemo(() => monthCells(year, m), [year, m]);

  // Memoized: a new gesture object every render makes the detector re-attach its handlers.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal intent only: a vertical drag must keep scrolling the page.
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .runOnJS(true)
        .onEnd((e) => {
          if (e.translationX < -48) goTo(month + 1);
          else if (e.translationX > 48) goTo(month - 1);
        }),
    // goTo only reads month and minMonth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, minMonth],
  );

  // In the picker the arrow pages to pickYear - 1, so it is dead once that whole year is past.
  const prevDisabled = picking ? (pickYear - 1) * 12 + 11 < minMonth : month <= minMonth;
  const onPrev = () => (picking ? setPickYear((y) => y - 1) : goTo(month - 1));
  const onNext = () => (picking ? setPickYear((y) => y + 1) : goTo(month + 1));

  const togglePicker = () => {
    setPickYear(year);
    setPicking((p) => !p);
    haptic.select();
  };

  return (
    <View>
      {/* Header: arrows page months, or years while the month picker is open */}
      <View style={s.header}>
        <Pressable
          onPress={togglePicker}
          accessibilityRole="button"
          accessibilityLabel={picking ? 'Tutup pilihan bulan' : `${MONTHS[m]} ${year}. Ketuk untuk memilih bulan dan tahun`}
          hitSlop={8}
          style={({ pressed }) => [s.title, pressed && s.pressed]}
        >
          <Text style={[s.titleText, { color: colors.onSurface }]}>
            {picking ? `${pickYear}` : `${MONTHS[m]} ${year}`}
          </Text>
          <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={16} color={colors.amber} />
        </Pressable>

        <View style={s.arrows}>
          <Pressable
            onPress={onPrev}
            disabled={prevDisabled}
            accessibilityRole="button"
            accessibilityLabel={picking ? 'Tahun sebelumnya' : 'Bulan sebelumnya'}
            accessibilityState={{ disabled: prevDisabled }}
            hitSlop={6}
            style={({ pressed }) => [s.arrow, pressed && s.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={prevDisabled ? colors.outline : colors.amber} />
          </Pressable>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={picking ? 'Tahun berikutnya' : 'Bulan berikutnya'}
            hitSlop={6}
            style={({ pressed }) => [s.arrow, pressed && s.pressed]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.amber} />
          </Pressable>
        </View>
      </View>

      {picking ? (
        // ── Month picker: 12 months of pickYear; a dot marks months with open days ──
        <Animated.View entering={FadeIn.duration(FADE_MS)} style={s.monthGrid}>
          {MONTHS_SHORT.map((label, i) => {
            const k = pickYear * 12 + i;
            const disabled = k < minMonth;
            const active = k === month;
            const hasOpen = openMonths.has(k);
            return (
              <Pressable
                key={label}
                disabled={disabled}
                onPress={() => { goTo(k); setPicking(false); }}
                accessibilityRole="button"
                accessibilityLabel={`${MONTHS[i]} ${pickYear}${hasOpen ? ', ada jadwal' : ''}`}
                accessibilityState={{ disabled, selected: active }}
                style={({ pressed }) => [
                  s.monthCell,
                  { backgroundColor: active ? colors.amber : hasOpen ? colors.amberFill + '33' : colors.surfaceVariant + '55' },
                  pressed && s.pressed,
                ]}
              >
                <Text
                  style={[
                    s.monthText,
                    {
                      color: active ? colors.onPrimary : disabled ? colors.outline : hasOpen ? colors.amber : colors.onSurfaceVariant,
                      fontFamily: hasOpen || active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                    },
                  ]}
                >
                  {label}
                </Text>
                {hasOpen && !active && <View style={[s.monthDot, { backgroundColor: colors.amber }]} />}
              </Pressable>
            );
          })}
        </Animated.View>
      ) : (
        <GestureDetector gesture={swipe}>
          <View>
            <View style={s.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={[s.weekday, { color: colors.textMuted }]}>{w}</Text>
              ))}
            </View>

            {/* Skip the entrance on first render: the screen's own FadeIn already covers it */}
            <LayoutAnimationConfig skipEntering>
              <Animated.View key={month} entering={enterFrom(dir)} style={s.grid}>
                {cells.map((day, i) => {
                  if (day === null) return <View key={`b${i}`} style={s.cell} />;
                  const date = ymdOf(year, m, day);
                  const past = date < minDate;
                  const open = !past && available.has(date);
                  const selected = date === value;
                  const isToday = date === minDate;
                  const weekday = WEEKDAYS_LONG[i % 7];
                  return (
                    <Pressable
                      key={date}
                      disabled={!open}
                      onPress={() => { if (!selected) haptic.select(); onChange(date); }}
                      accessibilityRole="button"
                      accessibilityLabel={`${weekday}, ${day} ${MONTHS[m]} ${year}${isToday ? ', hari ini' : ''}${open ? ', ada jadwal' : ', tidak tersedia'}`}
                      accessibilityState={{ disabled: !open, selected }}
                      style={({ pressed }) => [s.cell, pressed && s.pressed]}
                    >
                      <View
                        style={[
                          s.day,
                          selected
                            ? { backgroundColor: colors.amber }
                            : open
                              ? { backgroundColor: colors.amberFill + '38' }
                              // Past days stay unfilled so the month reads forward from today
                              : !past && { backgroundColor: colors.surfaceVariant + '66' },
                        ]}
                      >
                        <Text
                          style={[
                            s.dayText,
                            {
                              color: selected ? colors.onPrimary : open ? colors.amber : colors.outline,
                              fontFamily: open || selected ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                            },
                          ]}
                        >
                          {day}
                        </Text>
                        {isToday && (
                          <View style={[s.todayDot, { backgroundColor: selected ? colors.onPrimary : colors.primary }]} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            </LayoutAnimationConfig>
          </View>
        </GestureDetector>
      )}

      {/* Legend, plus a shortcut when this month has nothing open */}
      <View style={s.footer}>
        <View style={s.legend}>
          <View style={[s.swatch, { backgroundColor: colors.amberFill + '38', borderColor: colors.amber }]} />
          <Text style={[s.legendText, { color: colors.onSurfaceVariant }]}>Tersedia</Text>
          <View style={[s.swatch, { backgroundColor: colors.surfaceVariant + '66', borderColor: colors.outline }]} />
          <Text style={[s.legendText, { color: colors.onSurfaceVariant }]}>Tidak tersedia</Text>
        </View>
        {!picking && !openMonths.has(month) && nextOpenMonth !== undefined && (
          <Pressable
            onPress={() => goTo(nextOpenMonth)}
            accessibilityRole="button"
            accessibilityLabel={`Lihat jadwal terdekat di ${MONTHS[nextOpenMonth % 12]} ${Math.floor(nextOpenMonth / 12)}`}
            hitSlop={8}
            style={({ pressed }) => [s.jump, pressed && s.pressed]}
          >
            <Text style={[s.jumpText, { color: colors.amber }]}>
              Jadwal terdekat: {MONTHS[nextOpenMonth % 12]}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.amber} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  titleText: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  arrows: { flexDirection: 'row', gap: 4 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  // iOS-style press: a quick dim, no movement
  pressed: { opacity: 0.55 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15 },
  todayDot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
  monthCell: { width: '30.5%', height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 15 },
  monthDot: { position: 'absolute', bottom: 8, width: 5, height: 5, borderRadius: 2.5 },

  footer: { marginTop: 12, gap: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  legendText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginRight: 10 },
  jump: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  jumpText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
});

export default Calendar;
