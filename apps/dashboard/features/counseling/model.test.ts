import assert from 'node:assert/strict';
import test from 'node:test';
import { activeAvailability, affectedAppointments, deriveSessionStatus, hasObviousConflict, isEffectiveException, jakartaDateKey, localExceptionPayload, localSchedulePayload, normalizeRequests, resourceAvailability, resourceConflictIds, weekRange } from './model.ts';
import type { Appointment, AvailabilityRule, BlockedPeriod, CounselingResource, ResourceBlock } from './types.ts';

const appointment: Appointment = { counseling_appointment_id: 'a1', counseling_request_id: 'r1', student_id: 's1', student_name: 'Student', nim: null, counselor_id: 'c1', counselor_name: 'Counselor', starts_at: '2026-10-05T02:00:00.000Z', ends_at: '2026-10-05T03:00:00.000Z', status: 'confirmed' };

test('derives session state without overriding authoritative terminal states', () => {
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-05T01:00:00Z')), 'scheduled');
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-05T02:30:00Z')), 'ongoing');
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-05T04:00:00Z')), 'completed');
  assert.equal(deriveSessionStatus({ ...appointment, status: 'cancelled' }, new Date('2026-10-05T02:30:00Z')), 'cancelled');
});

test('builds Monday-to-Sunday calendar ranges', () => {
  assert.deepEqual(weekRange('2026-10-03'), { start: '2026-09-28', end: '2026-10-04', days: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'] });
});

test('creates timezone-aware Jakarta mutation payloads', () => {
  assert.deepEqual(localSchedulePayload('c1', '2026-10-05', '09:00', '10:00', 'room-a'), { counselor_id: 'c1', starts_at: '2026-10-05T02:00:00.000Z', ends_at: '2026-10-05T03:00:00.000Z', counseling_resource_id: 'room-a' });
  assert.equal(localSchedulePayload('c1', '2026-10-05', '10:00', '09:00'), null);
});

test('detects obvious counselor appointment and blocked-period overlap', () => {
  const payload = localSchedulePayload('c1', '2026-10-05', '09:30', '10:30')!;
  assert.equal(hasObviousConflict(payload, [appointment], []), true);
  const block: BlockedPeriod = { counselor_blocked_period_id: 'b1', counselor_id: 'c1', counselor_name: 'Counselor', starts_at: '2026-10-05T02:00:00Z', ends_at: '2026-10-05T04:00:00Z', reason: null };
  assert.equal(hasObviousConflict(payload, [], [block]), true);
  assert.equal(hasObviousConflict({ ...payload, counselor_id: 'c2' }, [appointment], [], undefined, 's1'), true);
});

test('normalizes requests without retaining preferred context', () => {
  const source = { requests: [{ counseling_request_id: 'r1', student_id: 's1', status: 'requested' as const, created_at: '2026-10-03T00:00:00Z', name: 'Student', nim: null, faculty_name: null, academic_unit_name: null, preferred_context: 'private narrative' }] };
  const result = normalizeRequests(source);
  assert.equal('preferred_context' in result[0], false);
});

test('filters availability by active state and stable counselor ID', () => {
  const rules: AvailabilityRule[] = [
    { counselor_availability_rule_id: '1', counselor_id: 'c1', day_of_week: 1, start_time: '09:00', end_time: '12:00', timezone: 'Asia/Jakarta', effective_from: null, effective_to: null, active: true },
    { counselor_availability_rule_id: '2', counselor_id: 'c2', day_of_week: 1, start_time: '09:00', end_time: '12:00', timezone: 'Asia/Jakarta', effective_from: null, effective_to: null, active: false },
  ];
  assert.deepEqual(activeAvailability(rules, 'c1').map((item) => item.counselor_availability_rule_id), ['1']);
});

test('uses the Jakarta calendar date boundary', () => {
  assert.equal(jakartaDateKey(new Date('2026-10-02T18:30:00Z')), '2026-10-03');
});

test('normalizes full-day exceptions and exposes affected sessions without mutating them', () => {
  const payload = localExceptionPayload('c1', '2026-10-05', '', '', true)!;
  assert.deepEqual(payload, { counselor_id: 'c1', starts_at: '2026-10-04T17:00:00.000Z', ends_at: '2026-10-05T17:00:00.000Z' });
  assert.deepEqual(affectedAppointments(payload, [appointment]).map((item) => item.counseling_appointment_id), ['a1']);
  assert.equal(isEffectiveException({ counselor_blocked_period_id: 'p1', counselor_id: 'c1', counselor_name: 'Counselor', starts_at: payload.starts_at, ends_at: payload.ends_at, reason: null, source: 'counselor', review_status: 'pending' }), false);
});

test('derives resource availability only from complete loaded authority', () => {
  const resource: CounselingResource = { counseling_resource_id: 'room-a', name: 'Room A', resource_type: 'physical', capacity: 1, location_or_url: null, active: true };
  const booked = { ...appointment, counseling_resource_id: 'room-a' };
  assert.equal(resourceAvailability(resource, [booked], [], appointment.starts_at, appointment.ends_at, false).state, 'unknown');
  assert.equal(resourceAvailability(resource, [booked], [], appointment.starts_at, appointment.ends_at, true).state, 'capacity_full');
  const block: ResourceBlock = { counseling_resource_block_id: 'rb1', counseling_resource_id: 'room-a', starts_at: appointment.starts_at, ends_at: appointment.ends_at, reason: null };
  assert.equal(resourceAvailability(resource, [], [block], appointment.starts_at, appointment.ends_at, true).state, 'blocked');
  assert.deepEqual([...resourceConflictIds([booked, { ...booked, counseling_appointment_id: 'a2', counselor_id: 'c2', student_id: 's2' }], [resource])].sort(), ['a1', 'a2']);
});
