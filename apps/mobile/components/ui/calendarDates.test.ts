// Unit tier — the session calendar's date math, checked in west-of-UTC zones too.
//
// `new Date('YYYY-MM-DD')` parses as UTC midnight, which is the previous evening west of
// UTC — so that bug passes silently in WIB and only shows up in a zone like Pago Pago.
// Each test switches process.env.TZ itself, so the order tests run in does not matter.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conversationTime,
  longDate,
  monthCells,
  monthIndex,
  parseYmd,
  toYmd,
  ymdOf,
} from './calendarDates.ts';

const ZONES = ['Asia/Jakarta', 'America/Los_Angeles', 'Pacific/Pago_Pago', 'Pacific/Kiritimati'];

for (const zone of ZONES) {
  test(`calendar grid agrees with Date in ${zone}`, () => {
    process.env.TZ = zone;
    // Guard against a Node that ignores runtime TZ changes: the run would repeat one zone.
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, zone, `TZ switch to ${zone}`);

    // Every month 2024–2030: the grid must agree with Date about where each day falls.
    for (let year = 2024; year <= 2030; year++) {
      for (let m = 0; m < 12; m++) {
        const cells = monthCells(year, m);
        const label = `${year}-${m + 1}`;

        assert.equal(cells.length, 42, `${label}: always six weeks`);
        assert.equal(cells.findIndex((c) => c !== null), new Date(year, m, 1).getDay(), `${label}: day 1 sits under its weekday`);

        const days = cells.filter((c) => c !== null);
        assert.equal(days.length, new Date(year, m + 1, 0).getDate(), `${label}: every day, once`);
        days.forEach((d, i) => assert.equal(d, i + 1, `${label}: days run 1..n with no gap`));

        // Column = weekday, which is what the per-cell accessibility label relies on.
        cells.forEach((d, i) => {
          if (d !== null) assert.equal(i % 7, new Date(year, m, d).getDay(), `${label}-${d}: column is its weekday`);
        });
      }
    }

    assert.equal(monthCells(2028, 1).filter(Boolean).length, 29, 'Feb 2028 is a leap month');
    assert.equal(monthCells(2026, 1).filter(Boolean).length, 28, 'Feb 2026 is not');
  });

  test(`date strings keep local days and sort correctly in ${zone}`, () => {
    process.env.TZ = zone;
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, zone, `TZ switch to ${zone}`);

    // Month arithmetic crosses the year boundary.
    assert.equal(monthIndex('2027-01-01') - monthIndex('2026-12-31'), 1);

    // Zero padding is what makes string order equal date order (an unpadded '2026-10-9' sorts
    // after '2026-10-10', which would show yesterday's slots as bookable).
    assert.equal(ymdOf(2026, 9, 9), '2026-10-09');
    assert.ok(ymdOf(2026, 9, 9) < ymdOf(2026, 9, 10));
    assert.ok(ymdOf(2026, 8, 30) < ymdOf(2026, 9, 1));

    // Local, not UTC: a late-evening Date must keep its own calendar day.
    assert.equal(toYmd(new Date(2026, 9, 6, 23, 30)), '2026-10-06');
    assert.deepEqual(parseYmd('2026-10-06'), { y: 2026, m: 9, d: 6 });

    // Weekday comes from local components, so it is right in every timezone.
    assert.equal(longDate('2026-10-06', new Date(2026, 0, 1)), 'Selasa, 6 Oktober');
    assert.equal(longDate('2026-10-06', new Date(2025, 0, 1)), 'Selasa, 6 Oktober 2026');
    assert.equal(longDate('2027-01-01', new Date(2026, 0, 1)), 'Jumat, 1 Januari 2027');
  });

  test(`chat history labels round-trip through UTC in ${zone}`, () => {
    process.env.TZ = zone;
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, zone, `TZ switch to ${zone}`);

    // Built from local Dates, then passed as ISO strings the way the API sends them.
    const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
    const now = new Date(2026, 9, 7, 0, 10); // Rabu, 7 Okt 2026, 00.10

    assert.equal(conversationTime(at(2026, 9, 7, 0, 5), now), '00.05', 'earlier today: clock time');
    assert.equal(conversationTime(at(2026, 9, 6, 23, 50), now), 'Kemarin', "20 minutes ago but yesterday's date");
    assert.equal(conversationTime(at(2026, 9, 5, 9, 0), now), 'Senin', 'within the week: weekday');
    assert.equal(conversationTime(at(2026, 9, 1), now), 'Kamis', 'six days back is still a weekday');
    assert.equal(conversationTime(at(2026, 8, 30), now), '30 Sep', 'a week or more: date');
    assert.equal(conversationTime(at(2025, 11, 31), now), '31 Des 2025', 'another year: with the year');
    // A timestamp slightly ahead of the device clock (phone running behind the server) is today.
    assert.equal(conversationTime(at(2026, 9, 7, 0, 12), now), '00.12');
  });
}
