// What the phone itself should announce. Pure (type-only imports), so it is unit-tested with
// plain Node (`npm run test:unit`); useInbox.ts does the scheduling.
import type { MyCounselingRequest, MyNotification } from '@prototype/api-client';

export type Reminder = { key: string; at: Date; title: string; body: string };

const HOUR = 3_600_000;
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace(':', '.');

/** A day and an hour before each session that is on; reminders already past are dropped. */
export function reminderPlan(requests: MyCounselingRequest[], now: number = Date.now()): Reminder[] {
  return requests.flatMap((r) => {
    const on = r.counseling_appointment_id && r.starts_at && (r.appointment_status === 'confirmed' || r.appointment_status === 'rescheduled');
    if (!on) return [];
    const start = Date.parse(r.starts_at!);
    const body = `${clock(r.starts_at!)} WIB bersama ${r.counselor_name ?? 'konselor'}`;
    return [
      { key: `${r.counseling_appointment_id}:day`, at: new Date(start - 24 * HOUR), title: 'Besok ada sesi konseling', body },
      { key: `${r.counseling_appointment_id}:hour`, at: new Date(start - HOUR), title: 'Sesi konseling 1 jam lagi', body },
    ].filter((reminder) => reminder.at.getTime() > now);
  }).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Unread items the phone has not shown yet, newest first; a backlog never floods the tray. */
export function freshAlerts(items: MyNotification[], alerted: Set<string>): MyNotification[] {
  return items.filter((n) => n.read_at === null && !alerted.has(n.notification_id)).slice(0, 3);
}
