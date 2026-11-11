// Unit tier — session reminders and which inbox items still deserve a banner.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { MyCounselingRequest, MyNotification } from '@prototype/api-client';
import { freshAlerts, reminderPlan } from './inbox.ts';

const NOW = Date.parse('2026-10-29T03:00:00Z'); // 10.00 WIB
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();
const session = (over: Partial<MyCounselingRequest> = {}): MyCounselingRequest => ({
  counseling_request_id: 'r1', status: 'confirmed', preferred_context: null, created_at: at(-72),
  preferred_counselor_id: null, preferred_counselor_name: null, preferred_starts_at: null, preferred_ends_at: null,
  counseling_appointment_id: 'a1', counselor_id: 'k1', counselor_name: 'Bu Sari',
  starts_at: at(30), ends_at: at(31), appointment_status: 'confirmed', ...over,
});

test('a confirmed session gets a reminder the day before and an hour before', () => {
  const plan = reminderPlan([session()], NOW);
  assert.deepEqual(plan.map((r) => r.at.toISOString()), [at(6), at(29)]);
  assert.equal(plan[1].title, 'Sesi konseling 1 jam lagi');
  assert.match(plan[1].body, /^16\.00 WIB bersama Bu Sari$/);
});

test('reminders already in the past are skipped, and so are sessions not on', () => {
  assert.deepEqual(reminderPlan([session({ starts_at: at(5), ends_at: at(6) })], NOW).map((r) => r.at.toISOString()), [at(4)]);
  assert.deepEqual(reminderPlan([session({ appointment_status: 'cancelled' })], NOW), []);
  assert.deepEqual(reminderPlan([session({ counseling_appointment_id: null, starts_at: null, ends_at: null, status: 'requested' })], NOW), []);
});

const item = (id: string, read = false): MyNotification => ({
  notification_id: id, category: 'counseling', title: id, body: null, target_path: '/schedule',
  entity_type: 'appointment', entity_id: null, read_at: read ? at(-1) : null, created_at: at(-2),
});

test('only unread items never bannered before get a banner, newest first, three at most', () => {
  const fresh = freshAlerts([item('e'), item('d'), item('c', true), item('b'), item('a')], new Set(['b']));
  assert.deepEqual(fresh.map((n) => n.notification_id), ['e', 'd', 'a']);
  assert.equal(freshAlerts([item('1'), item('2'), item('3'), item('4')], new Set()).length, 3);
});
