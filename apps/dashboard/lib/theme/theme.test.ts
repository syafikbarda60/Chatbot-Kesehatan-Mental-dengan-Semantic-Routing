import assert from 'node:assert/strict';
import test from 'node:test';
import { isThemeMode, resolveTheme } from './theme.ts';

test('validates persisted theme modes', () => {
  assert.equal(isThemeMode('light'), true);
  assert.equal(isThemeMode('dark'), true);
  assert.equal(isThemeMode('system'), true);
  assert.equal(isThemeMode('sepia'), false);
});

test('resolves system theme from the operating-system preference', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
});
