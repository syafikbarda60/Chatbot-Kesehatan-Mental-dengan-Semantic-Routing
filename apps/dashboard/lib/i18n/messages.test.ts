import assert from 'node:assert/strict';
import test from 'node:test';
import { counselorMessages } from './counselorMessages.ts';
import { isLanguage, messages } from './messages.ts';

test('accepts only supported language selections', () => {
  assert.equal(isLanguage('id'), true);
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('fr'), false);
});

test('provides both Indonesian and English shell labels', () => {
  assert.equal(messages.id.nav.overview, 'Beranda Operasional');
  assert.equal(messages.en.nav.overview, 'Operations Overview');
});

test('provides both languages for the M8 instrument workflow', () => {
  assert.equal(messages.id.instruments.actions.save, 'Simpan Draft');
  assert.equal(messages.en.instruments.actions.save, 'Save Draft');
  assert.match(messages.id.instruments.validation.unavailableBody, /dinonaktifkan/);
  assert.match(messages.en.instruments.validation.unavailableBody, /disabled/);
});

test('provides bilingual M10 copy for report, builder, and shell surfaces', () => {
  assert.equal(messages.id.analytics.report.back, 'Kembali ke Analitik');
  assert.equal(messages.en.analytics.report.back, 'Back to Analytics');
  assert.equal(messages.id.instrumentCreate.addDimension, 'Tambah dimensi');
  assert.equal(messages.en.instrumentCreate.addDimension, 'Add dimension');
  assert.equal(messages.id.common.mainNavigation, 'Navigasi utama');
  assert.equal(messages.en.common.mainNavigation, 'Main navigation');
});

test('keeps implementation wording out of what users read', () => {
  const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  const leaks = [...strings(messages), ...strings(counselorMessages)].filter((text) => /backend|endpoint|API|kontrak|contract|PostgreSQL/i.test(text));
  assert.deepEqual(leaks, []);
});
