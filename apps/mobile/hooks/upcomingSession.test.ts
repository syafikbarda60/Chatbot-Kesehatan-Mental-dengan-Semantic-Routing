// Unit tier — which counseling session counts as "next" on Home, Profil and Konseling.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { MyCounselingRequest } from '@prototype/api-client';
import { nearestSession } from './upcomingSession.ts';

const NOW = Date.parse('2026-10-06T00:30:00Z'); // 07.30 WIB, Selasa
const at = (hoursFromNow: number) => new Date(NOW + hoursFromNow * 3_600_000).toISOString();

let seq = 0;
const request = (over: Partial<MyCounselingRequest> = {}): MyCounselingRequest => ({
  counseling_request_id: `request-${++seq}`,
  status: 'requested',
  preferred_context: null,
  created_at: at(-48),
  preferred_counselor_id: 'k1',
  preferred_counselor_name: 'Bu Sari',
  preferred_starts_at: null,
  preferred_ends_at: null,
  counseling_appointment_id: null,
  counselor_id: null,
  counselor_name: null,
  starts_at: null,
  ends_at: null,
  appointment_status: null,
  ...over,
});

const pick = (h: number) => request({ preferred_starts_at: at(h), preferred_ends_at: at(h + 1) });
const booked = (
  h: number,
  appointment_status: NonNullable<MyCounselingRequest['appointment_status']> = 'confirmed',
  counselor_name = 'Pak Budi',
) =>
  request({
    status: appointment_status,
    preferred_starts_at: at(h + 5),
    preferred_ends_at: at(h + 6),
    counseling_appointment_id: 'a1',
    counselor_id: 'k2',
    counselor_name,
    starts_at: at(h),
    ends_at: at(h + 1),
    appointment_status,
  });

test('no requests means no next session', () => {
  assert.equal(nearestSession([], NOW), undefined);
});

test('a pick waiting for an admin shows at the picked time', () => {
  assert.deepEqual(nearestSession([pick(3)], NOW), {
    start: at(3),
    end: at(4),
    counselor: 'Bu Sari',
    status: 'pending',
  });
});

test('an assigned appointment wins over the requested pick', () => {
  assert.deepEqual(nearestSession([booked(2)], NOW), {
    start: at(2),
    end: at(3),
    counselor: 'Pak Budi',
    status: 'confirmed',
  });
  assert.equal(nearestSession([booked(2, 'rescheduled')], NOW)?.status, 'confirmed');
});

test('closed outcomes never show as next', () => {
  for (const status of ['cancelled', 'completed', 'no_show'] as const) {
    assert.equal(nearestSession([booked(2, status)], NOW), undefined, status);
  }
});

test('the nearest session wins regardless of list order', () => {
  assert.equal(nearestSession([pick(30), booked(5), pick(2)], NOW)?.start, at(2));
});

test('a session still counts while it is happening, not after it ends', () => {
  assert.equal(nearestSession([pick(-0.5)], NOW)?.start, at(-0.5), 'in progress');
  assert.equal(nearestSession([pick(-2)], NOW), undefined, 'ended an hour ago');
});

test('a session that ended before 07.00 WIB is gone even though its UTC date is yesterday', () => {
  assert.equal(nearestSession([pick(-2.5)], NOW), undefined);
});

test('a request with no picked time has nothing to show', () => {
  assert.equal(nearestSession([request()], NOW), undefined);
});
