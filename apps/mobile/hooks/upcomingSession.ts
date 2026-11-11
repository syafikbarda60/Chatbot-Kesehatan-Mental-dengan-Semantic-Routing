// Which counseling session to show as "next" on Home, Profil and Konseling. Pure (type-only
// imports), so it is unit-tested with plain Node (`npm run test:unit`):
import type { MyCounselingRequest } from '@prototype/api-client';

export type UpcomingSession = {
  start: string;
  end: string;
  counselor: string | null;
  status: 'pending' | 'confirmed';
};

/**
 * The nearest session that has not ended: a confirmed appointment at the time it was booked
 * (an admin may have moved it away from the student's pick), otherwise a pick still waiting
 * for an admin. Compared as instants, never as UTC date strings — before 07.00 WIB the UTC
 * date is still yesterday, which used to keep a finished session showing as "next".
 */
export function nearestSession(requests: MyCounselingRequest[], now: number = Date.now()): UpcomingSession | undefined {
  return requests
    .map((r): UpcomingSession | null => {
      if (r.counseling_appointment_id && r.starts_at && r.ends_at && (r.appointment_status === 'confirmed' || r.appointment_status === 'rescheduled')) {
        return { start: r.starts_at, end: r.ends_at, counselor: r.counselor_name, status: 'confirmed' };
      }
      if (r.status === 'requested' && r.preferred_starts_at && r.preferred_ends_at) {
        return { start: r.preferred_starts_at, end: r.preferred_ends_at, counselor: r.preferred_counselor_name, status: 'pending' };
      }
      return null; // cancelled, completed, no-show, or a request without a pick
    })
    .filter((s): s is UpcomingSession => !!s && new Date(s.end).getTime() > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
}
