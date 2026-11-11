import assert from 'node:assert/strict';
import test from 'node:test';
import { filterHotlines, hotlineActionPayload, hotlineActionsForStatus, materialEditRequiresAuthoritativeRefetch, normalizeHotlineStatus, toHotlinePayload, validateHotlineDraft } from './model.ts';

test('normalizes unknown statuses conservatively', () => assert.equal(normalizeHotlineStatus('legacy'), 'verification_required'));
test('filters loaded hotline data by status and searchable fields', () => {
  const rows = [{ hotline_id: '1', name: 'Layanan Kampus', phone: '118', description: 'Dukungan', verification_status: 'active' as const }];
  assert.equal(filterHotlines(rows, 'kampus', 'active').length, 1);
  assert.equal(filterHotlines(rows, '118', 'inactive').length, 0);
});
test('validates and normalizes hotline payloads without changing phone formatting', () => {
  const draft = { name: ' Kampus ', phone: ' (024) 746 0000 ext 12 ', description: ' Dukungan ', verificationNote: ' Dicek ' };
  assert.deepEqual(validateHotlineDraft(draft), {});
  assert.deepEqual(toHotlinePayload(draft, true), { name: 'Kampus', phone: '(024) 746 0000 ext 12', description: 'Dukungan', verification_note: 'Dicek', verification_status: 'verification_required' });
});
test('maps lifecycle actions to server statuses', () => {
  assert.deepEqual(hotlineActionPayload('verify'), { verification_status: 'active' });
  assert.deepEqual(hotlineActionPayload('reactivate'), { verification_status: 'verification_required' });
});
test('permits only valid row actions for each state', () => {
  assert.deepEqual(hotlineActionsForStatus('active'), ['edit', 'deactivate']);
  assert.deepEqual(hotlineActionsForStatus('verification_required'), ['edit', 'verify', 'deactivate']);
  assert.deepEqual(hotlineActionsForStatus('inactive'), ['edit', 'reactivate']);
});
test('represents removal as soft deactivation and exposes no hard-delete action', () => {
  assert.equal(hotlineActionsForStatus('active').includes('deactivate'), true);
  assert.equal((hotlineActionsForStatus('active') as string[]).includes('delete'), false);
});
test('material edits require server-authoritative invalidation presentation', () => assert.equal(materialEditRequiresAuthoritativeRefetch, true));
