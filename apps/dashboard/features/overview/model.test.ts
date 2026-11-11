import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPriorityCases, clearPrioritySelection, deriveMetrics, deriveSessionStatus, jakartaDateKey } from './model.ts';
import type { CounselingAppointment, OverviewSources } from './types.ts';

const sources: OverviewSources = {
  attention: {
    signals: [
      { guardrail_log_id: 'assessment-new', user_id: 'student-1', assessment_id: 'assessment-1', is_read: false, notified_at: '2026-10-03T05:00:00Z', name: 'Student One', nim: 'NIM-1', signal_type: 'assessment', assessment_category_results: [{ category: 'depression', severity: 'severe', scaled_score: 22 }] },
      { guardrail_log_id: 'safety-old', user_id: 'student-2', assessment_id: null, is_read: false, notified_at: '2026-10-02T05:00:00Z', name: 'Student Two', nim: 'NIM-2', signal_type: 'safety' },
      { guardrail_log_id: 'safety-new', user_id: 'student-3', assessment_id: null, is_read: false, notified_at: '2026-10-03T06:00:00Z', name: 'Student Three', nim: 'NIM-3', signal_type: 'safety' },
    ],
    summary: [{ signal_type: 'assessment', total: 1, unread: 1 }, { signal_type: 'safety', total: 2, unread: 2 }],
    total: 3,
    page: 1,
    page_size: 100,
  },
  requests: {
    requests: [{ counseling_request_id: 'request-1', student_id: 'student-4', status: 'requested', created_at: '2026-10-03T07:00:00Z', name: 'Student Four', nim: 'NIM-4', faculty_name: 'Faculty', academic_unit_name: 'Unit' }],
    total: 1,
    page: 1,
    page_size: 100,
  },
  calendar: {
    appointments: [
      { counseling_appointment_id: 'appointment-1', counseling_request_id: 'request-2', student_id: 'student-1', student_name: 'Student One', nim: 'NIM-1', counselor_id: 'counselor-1', counselor_name: 'Counselor One', starts_at: '2026-10-03T02:00:00Z', ends_at: '2026-10-03T03:00:00Z', status: 'confirmed' },
      { counseling_appointment_id: 'appointment-2', counseling_request_id: 'request-3', student_id: 'student-2', student_name: 'Student Two', nim: 'NIM-2', counselor_id: 'counselor-1', counselor_name: 'Counselor One', starts_at: '2026-10-03T04:00:00Z', ends_at: '2026-10-03T05:00:00Z', status: 'cancelled' },
    ],
  },
  schedules: {
    schedules: [
      { counseling_slot_id: 'slot-1', counselor_id: 'counselor-1', counselor_name: 'Counselor One', date: '2026-10-03', start_time: '10:00:00', end_time: '11:00:00', status: 'available', counseling_booking_id: null, booking_status: null },
      { counseling_slot_id: 'slot-2', counselor_id: 'counselor-1', counselor_name: 'Counselor One', date: '2026-10-03', start_time: '11:00:00', end_time: '12:00:00', status: 'booked', counseling_booking_id: 'booking-1', booking_status: 'confirmed' },
    ],
    total: 2,
  },
};

test('sorts safety signals first and newest first within the same priority', () => {
  assert.deepEqual(buildPriorityCases(sources).map((item) => item.id), [
    'attention:safety-new',
    'attention:safety-old',
    'attention:assessment-new',
    'request:request-1',
  ]);
});

test('derives overview metrics only from real source records and totals', () => {
  assert.deepEqual(deriveMetrics(sources), {
    criticalCases: 2,
    activeHighRisk: 1,
    awaitingFollowUp: 4,
    pendingCounseling: 1,
    sessionsToday: 1,
    availableSlots: 1,
  });
});

test('derives appointment status consistently from authoritative status and time', () => {
  const appointment = sources.calendar.appointments[0] as CounselingAppointment;
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-03T01:00:00Z')), 'scheduled');
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-03T02:30:00Z')), 'ongoing');
  assert.equal(deriveSessionStatus(appointment, new Date('2026-10-03T04:00:00Z')), 'completed');
  assert.equal(deriveSessionStatus({ ...appointment, status: 'cancelled' }, new Date('2026-10-03T02:30:00Z')), 'cancelled');
});

test('uses the Jakarta operational date at UTC day boundaries', () => {
  assert.equal(jakartaDateKey(new Date('2026-10-02T18:00:00Z')), '2026-10-03');
});

test('clears every selected priority case immediately', () => {
  const cleared = clearPrioritySelection();
  assert.equal(cleared.size, 0);
});
