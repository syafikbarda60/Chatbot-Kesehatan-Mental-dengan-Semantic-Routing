import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMonitoringCases,
  clearMonitoringSelection,
  compatibleAcademicUnits,
  deduplicateCases,
  filterMonitoringCases,
  normalizeAssessmentRisk,
  paginateCases,
  reconcileAcademicUnits,
  resolveDateRange,
  safeTriggerParts,
} from './model.ts';
import type { AttentionResponse, CounselingRequestsResponse } from '../overview/types.ts';
import type { AcademicStructure, MonitoringCase, MonitoringFilters } from './types.ts';

const academic: AcademicStructure = {
  faculties: [
    { faculty_id: 'faculty-1', code: 'FT', name: 'Fakultas Teknik', active: true },
    { faculty_id: 'faculty-2', code: 'FK', name: 'Fakultas Kedokteran', active: true },
  ],
  academicUnits: [
    { academic_unit_id: 'unit-1', faculty_id: 'faculty-1', faculty_name: 'Fakultas Teknik', code: 'IF', name: 'Informatika', unit_type: 'study_program', active: true },
    { academic_unit_id: 'unit-2', faculty_id: 'faculty-2', faculty_name: 'Fakultas Kedokteran', code: 'KD', name: 'Kedokteran', unit_type: 'study_program', active: true },
  ],
};

const attention: AttentionResponse = {
  signals: [
    { guardrail_log_id: 'assessment-severe', user_id: 'student-1', assessment_id: 'assessment-1', is_read: false, notified_at: '2026-10-03T01:00:00Z', name: 'Alya Pratama', nim: 'DEMO-240001', signal_type: 'assessment', assessment_category_results: [{ category: 'depression', severity: 'severe', scaled_score: 24 }] },
    { guardrail_log_id: 'safety', user_id: 'student-2', assessment_id: null, is_read: true, notified_at: '2026-10-02T04:00:00Z', name: 'Bima Santoso', nim: 'DEMO-240002', signal_type: 'safety' },
    { guardrail_log_id: 'assessment-mild', user_id: 'student-3', assessment_id: 'assessment-2', is_read: true, notified_at: '2026-09-20T01:00:00Z', name: 'Citra Lestari', nim: 'DEMO-240003', signal_type: 'assessment', assessment_category_results: [{ category: 'anxiety', severity: 'mild', scaled_score: 8 }] },
  ],
  summary: [], total: 3, page: 1, page_size: 100,
};

const requests: CounselingRequestsResponse = {
  requests: [{ counseling_request_id: 'request-1', student_id: 'student-4', status: 'requested', created_at: '2026-10-03T02:00:00Z', name: 'Damar Wijaya', nim: 'DEMO-240004', faculty_name: 'Fakultas Teknik', academic_unit_name: 'Informatika' }],
  total: 1, page: 1, page_size: 100,
};

const defaults: MonitoringFilters = {
  type: 'all', search: '', review: 'all', risk: 'all', preset: 'all', dateFrom: '', dateTo: '', facultyIds: [], academicUnitIds: [],
};

test('maps authoritative source types, review state, academic identity, and safe risk presentation', () => {
  const cases = buildMonitoringCases(attention, requests, academic);
  assert.deepEqual(cases.map((item) => [item.type, item.risk]), [
    ['safety', 'critical'],
    ['assessment', 'high'],
    ['assessment', 'low'],
    ['request', 'unknown'],
  ]);
  assert.equal(cases.find((item) => item.type === 'safety')?.reviewState, 'reviewed');
  assert.equal(cases.find((item) => item.type === 'request')?.facultyId, 'faculty-1');
  assert.equal(cases.find((item) => item.type === 'request')?.academicUnitId, 'unit-1');
});

test('normalizes supported backend severity values without inventing missing risk', () => {
  assert.equal(normalizeAssessmentRisk('extremely severe'), 'critical');
  assert.equal(normalizeAssessmentRisk('severe'), 'high');
  assert.equal(normalizeAssessmentRisk('moderate'), 'medium');
  assert.equal(normalizeAssessmentRisk('mild'), 'low');
  assert.equal(normalizeAssessmentRisk(null), 'unknown');
});

test('sorts by risk, then newest timestamp, then stable id', () => {
  assert.deepEqual(buildMonitoringCases({ ...attention, signals: [
    { ...attention.signals[1], guardrail_log_id: 'critical', notified_at: '2026-10-01T01:00:00Z' },
    { ...attention.signals[0], guardrail_log_id: 'z', notified_at: '2026-10-03T01:00:00Z' },
    { ...attention.signals[0], guardrail_log_id: 'b', notified_at: '2026-10-03T02:00:00Z' },
    { ...attention.signals[0], guardrail_log_id: 'a', notified_at: '2026-10-03T02:00:00Z' },
  ] }, { ...requests, requests: [] }, academic).map((item) => item.sourceId), ['critical', 'a', 'b', 'z']);
});

test('filters by semantic type, identity, review, risk, date, and request academic scope', () => {
  const cases = buildMonitoringCases(attention, requests, academic);
  const now = new Date('2026-10-03T12:00:00Z');
  assert.deepEqual(filterMonitoringCases(cases, { ...defaults, type: 'assessment', search: 'demo-240001', review: 'unreviewed', risk: 'high', preset: 'today' }, now).map((item) => item.sourceId), ['assessment-severe']);
  assert.deepEqual(filterMonitoringCases(cases, { ...defaults, facultyIds: ['faculty-1'], academicUnitIds: ['unit-1'] }, now).filter((item) => item.type === 'request').map((item) => item.sourceId), ['request-1']);
  assert.equal(filterMonitoringCases(cases, { ...defaults, facultyIds: ['faculty-2'] }, now).filter((item) => item.type === 'request').length, 0);
});

test('resolves Jakarta date presets and only accepts a complete custom range', () => {
  const now = new Date('2026-10-02T18:00:00Z');
  assert.deepEqual(resolveDateRange('today', '', '', now), { from: '2026-10-03', to: '2026-10-03' });
  assert.deepEqual(resolveDateRange('7days', '', '', now), { from: '2026-09-27', to: '2026-10-03' });
  assert.equal(resolveDateRange('custom', '2026-10-01', '', now), null);
});

test('enforces the one-faculty unit rule and clears incompatible unit selections', () => {
  assert.deepEqual(compatibleAcademicUnits(['faculty-1'], academic.academicUnits).map((item) => item.academic_unit_id), ['unit-1']);
  assert.deepEqual(compatibleAcademicUnits(['faculty-1', 'faculty-2'], academic.academicUnits), []);
  assert.deepEqual(reconcileAcademicUnits(['faculty-2'], ['unit-1', 'unit-2'], academic.academicUnits), ['unit-2']);
});

test('deduplicates by stable source id, paginates safely, and clears selection', () => {
  const cases = buildMonitoringCases(attention, requests, academic);
  assert.equal(deduplicateCases([cases[0], cases[0], cases[1]]).length, 2);
  assert.deepEqual(paginateCases(cases, 99, 2), { rows: cases.slice(2, 4), page: 2, pageCount: 2 });
  assert.equal(clearMonitoringSelection().size, 0);
});

test('safe trigger details expose assessment summaries only', () => {
  const cases = buildMonitoringCases(attention, requests, academic);
  const assessmentCase = cases.find((item) => item.sourceId === 'assessment-severe') as MonitoringCase;
  const safetyCase = cases.find((item) => item.type === 'safety') as MonitoringCase;
  assert.deepEqual(safeTriggerParts(assessmentCase), [{ category: 'depression', severity: 'severe', score: 24 }]);
  assert.deepEqual(safeTriggerParts(safetyCase), []);
});
