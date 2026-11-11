import assert from 'node:assert/strict';
import test from 'node:test';
import { previewDatasetSummary, previewRequest } from './previewData.ts';

test('preview dataset covers each dashboard domain', () => {
  assert.deepEqual(previewDatasetSummary(), {
    students: 4,
    faculties: 3,
    units: 4,
    counselors: 3,
    resources: 3,
    instruments: 4,
    hotlines: 3,
  });
});

test('preview counseling data carries deterministic resource and exception states', async () => {
  const resources = await previewRequest<{ resources: Array<{ counseling_resource_id: string; resource_type: string }> }>('/admin/counseling/resources');
  const calendar = await previewRequest<{ appointments: Array<{ counseling_resource_id?: string | null }>; resource_blocks: Array<{ counseling_resource_id: string }>; blocked_periods: Array<{ source?: string; review_status?: string }>; resource_authority_complete: boolean }>('/admin/counseling/calendar/multi?date_from=2026-01-01&date_to=2099-01-01');
  assert.deepEqual(resources.resources.map((item) => item.resource_type), ['physical', 'physical', 'virtual']);
  assert.equal(calendar.resource_authority_complete, true);
  assert.ok(calendar.appointments.some((item) => item.counseling_resource_id === 'preview-resource-a'));
  assert.ok(calendar.resource_blocks.some((item) => item.counseling_resource_id === 'preview-resource-a'));
  assert.ok(calendar.blocked_periods.some((item) => item.source === 'counselor' && item.review_status === 'pending'));
});

test('preview adapter returns synthetic monitoring and academic data', async () => {
  const attention = await previewRequest<{ signals: Array<{ guardrail_log_id: string }> }>('/admin/attention?page=1&page_size=100');
  const academics = await previewRequest<{ faculties: Array<{ faculty_id: string }> }>('/admin/academic/faculties');
  assert.ok(attention.signals.length >= 3);
  assert.ok(attention.signals.every((row) => row.guardrail_log_id.startsWith('preview-')));
  assert.ok(academics.faculties.every((row) => row.faculty_id.startsWith('preview-')));
});

test('preview mutations stay in memory and return typed endpoint shapes', async () => {
  const updated = await previewRequest<{ message: string }>('/admin/attention/preview-assessment-signal-01/read', { method: 'PATCH' });
  const rows = await previewRequest<{ signals: Array<{ guardrail_log_id: string; is_read: boolean }> }>('/admin/attention?page=1&page_size=100');
  assert.match(updated.message, /Preview/);
  assert.equal(rows.signals.find((row) => row.guardrail_log_id === 'preview-assessment-signal-01')?.is_read, true);
});

test('preview standard instruments create an editable next version without changing the published parent', async () => {
  const created = await previewRequest<{ version: { instrument_version_id: string; version_number: number; status: string }; questions: Array<{ wording: string }>; dimensions: Array<{ multiplier: number }> }>('/admin/assessment-instruments/preview-instrument-dass21/drafts', { method: 'POST' });
  const parent = await previewRequest<{ version: { status: string }; questions: Array<{ wording: string }> }>('/admin/assessment-instruments/versions/preview-dass-v1');
  const wording = 'Edited DASS-21 preview question';
  const saved = await previewRequest<typeof created>(`/admin/assessment-instruments/versions/${created.version.instrument_version_id}/draft`, { method: 'PUT', body: { questions: created.questions.map((question, index) => ({ ...question, wording: index === 0 ? wording : question.wording })), definition: { name: 'DASS-21 revised draft', language: 'id', provenance: { source_adaptation: 'Preview source' }, dimensions: created.dimensions.map((dimension) => ({ ...dimension, multiplier: 2.5 })), scoring_config: { strategy: 'dass21', standardization_multiplier: 2.5 } } } });
  assert.equal(created.version.version_number, 3);
  assert.equal(saved.version.status, 'draft');
  assert.equal(saved.questions[0].wording, wording);
  assert.equal(saved.dimensions[0].multiplier, 2.5);
  assert.equal(parent.version.status, 'published');
  assert.notEqual(parent.questions[0].wording, wording);
});
