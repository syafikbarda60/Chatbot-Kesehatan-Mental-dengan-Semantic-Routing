import test from 'node:test';
import assert from 'node:assert/strict';
import { addScheduleWindow, buildSchedulePlan, filterCounselors, normalizeCounselors, normalizeSchedule, removeScheduleWindow, upcomingAppointments, validateSchedule, WEEKDAY_ORDER } from './model.ts';
import type { Appointment, AvailabilityRule, Counselor, ScheduleWindow } from './types.ts';

const counselor: Counselor = { user_id: 'c1', name: 'Dr. Raka', email: 'raka@example.test', title: 'Psikolog', specialization: 'Stres akademik', active: true };
const rule = (overrides: Partial<AvailabilityRule> = {}): AvailabilityRule => ({ counselor_availability_rule_id: 'r1', counselor_id: 'c1', day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00', timezone: 'Asia/Jakarta', effective_from: null, effective_to: null, active: true, ...overrides });
const window = (overrides: Partial<ScheduleWindow> = {}): ScheduleWindow => ({ key: 'r1', ruleId: 'r1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', effectiveFrom: '', effectiveTo: '', ...overrides });

test('normalizes active weekly rules and orders Monday through Sunday', () => {
  const result = normalizeSchedule([rule({ counselor_availability_rule_id: 'sun', day_of_week: 0 }), rule({ counselor_availability_rule_id: 'wed', day_of_week: 3 }), rule({ active: false })], 'c1');
  assert.deepEqual(result.map((item) => item.dayOfWeek), [3, 0]);
  assert.deepEqual(WEEKDAY_ORDER, [1, 2, 3, 4, 5, 6, 0]);
});

test('detects invalid, duplicate, and overlapping intervals under backend semantics', () => {
  assert.equal(validateSchedule([window({ endTime: '08:00' })]), 'range');
  assert.equal(validateSchedule([window(), window({ key: 'r2', ruleId: null })]), 'duplicate');
  assert.equal(validateSchedule([window(), window({ key: 'r2', ruleId: null, startTime: '11:00', endTime: '14:00' })]), 'overlap');
  assert.equal(validateSchedule([window({ effectiveTo: '2026-01-31' }), window({ key: 'r2', ruleId: null, startTime: '11:00', endTime: '14:00', effectiveFrom: '2026-02-01' })]), 'overlap');
  assert.equal(validateSchedule([window({ effectiveFrom: '2026-02-02', effectiveTo: '2026-02-01' })]), 'effectiveDates');
});

test('adds and removes time windows without changing other weekdays', () => {
  const added = addScheduleWindow([window()], 2, 'new-1');
  assert.equal(added.length, 2); assert.equal(added[1].dayOfWeek, 2);
  assert.deepEqual(removeScheduleWindow(added, 'r1').map((item) => item.key), ['new-1']);
});

test('creates a minimal availability mutation plan in Jakarta timezone', () => {
  const original = [window(), window({ key: 'r2', ruleId: 'r2', dayOfWeek: 2 })];
  const draft = [window(), window({ key: 'r2', ruleId: 'r2', dayOfWeek: 2, endTime: '13:00' }), window({ key: 'new', ruleId: null, dayOfWeek: 3, effectiveFrom: '2026-10-01' })];
  const plan = buildSchedulePlan('c1', original, draft);
  assert.deepEqual(plan.deactivateRuleIds, ['r2']);
  assert.equal(plan.create.length, 2); assert.equal(plan.create[0].timezone, 'Asia/Jakarta'); assert.equal(plan.create[1].effective_from, '2026-10-01');
});

test('maps active state and filters real name, email, status, and specialization fields', () => {
  const inactive = { ...counselor, user_id: 'c2', name: 'Sari', email: undefined, active: false, specialization: null };
  assert.deepEqual(filterCounselors([counselor, inactive], 'example', 'active', 'Stres akademik'), [counselor]);
  assert.deepEqual(filterCounselors([counselor, inactive], '', 'inactive', ''), [inactive]);
});

test('profile normalization keeps only the privacy-safe counselor contract', () => {
  const raw = { ...counselor, therapy_notes: 'private', journal: 'private' };
  const result = normalizeCounselors({ counselors: [raw] });
  assert.deepEqual(result, [counselor]);
  assert.equal('therapy_notes' in result[0], false);
});

test('maps only bounded upcoming active appointments in chronological order', () => {
  const appointment = (id: string, start: string, status: Appointment['status'] = 'confirmed'): Appointment => ({ counseling_appointment_id: id, counseling_request_id: null, student_id: `s-${id}`, student_name: `Student ${id}`, nim: null, counselor_id: 'c1', counselor_name: 'Dr. Raka', starts_at: start, ends_at: new Date(Date.parse(start) + 3_600_000).toISOString(), status });
  const result = upcomingAppointments([appointment('late', '2026-10-05T04:00:00Z'), appointment('past', '2026-09-01T04:00:00Z'), appointment('cancelled', '2026-10-04T04:00:00Z', 'cancelled'), appointment('early', '2026-10-04T04:00:00Z')], new Date('2026-10-03T00:00:00Z'), 2);
  assert.deepEqual(result.map((item) => item.counseling_appointment_id), ['early', 'late']);
});
