// Date math for the session calendar, kept free of React Native imports so it can be checked
// with plain Node: `npm run test:unit`.
//
// Dates are 'YYYY-MM-DD' strings throughout. Comparing two of them as strings is the same as
// comparing the dates, and parsing never goes through `new Date('YYYY-MM-DD')` — that form
// is read as UTC midnight, which is the previous evening anywhere west of Greenwich.

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const WEEKDAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const pad = (n: number) => String(n).padStart(2, '0');

/** A local Date as 'YYYY-MM-DD' (local, not UTC: toISOString would shift it near midnight). */
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "10:00" on the phone's clock for an instant the API sends as an ISO string. */
export const clockTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** m is 0-based, as in Date. */
export const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

/** Months as one integer, so "next month" is +1 even across a year boundary. */
export const monthIndex = (s: string) => {
  const { y, m } = parseYmd(s);
  return y * 12 + m;
};

/**
 * A fixed six-week grid (42 cells, Sunday first) for month `m` of `year`: the day number in
 * each cell, or null outside the month. Always six rows, so whatever sits below the calendar
 * never jumps when paging between a four-row February and a six-row month.
 */
export function monthCells(year: number, m: number): (number | null)[] {
  const lead = new Date(year, m, 1).getDay();
  const count = new Date(year, m + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= count ? day : null;
  });
}

/**
 * When a conversation was last active, the way a messaging app lists it: "14.20" today,
 * "Kemarin", the weekday within the past week, then "3 Okt" (plus the year once it is not
 * this year). Days are counted by local calendar date, not 24-hour spans — 23.50 last night
 * is "Kemarin" at 00.10 this morning.
 */
export function conversationTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded: a DST change makes a calendar day 23 or 25 hours long.
  const daysAgo = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (daysAgo <= 0) return `${pad(t.getHours())}.${pad(t.getMinutes())}`;
  if (daysAgo === 1) return 'Kemarin';
  if (daysAgo < 7) return WEEKDAYS_LONG[t.getDay()];
  const year = t.getFullYear() === now.getFullYear() ? '' : ` ${t.getFullYear()}`;
  return `${t.getDate()} ${MONTHS_SHORT[t.getMonth()]}${year}`;
}

/** "Senin, 6 Oktober", with the year only when it differs from `now`'s. */
export function longDate(s: string, now: Date = new Date()): string {
  const { y, m, d } = parseYmd(s);
  const weekday = WEEKDAYS_LONG[new Date(y, m, d).getDay()];
  const year = y === now.getFullYear() ? '' : ` ${y}`;
  return `${weekday}, ${d} ${MONTHS[m]}${year}`;
}
