import assert from 'node:assert/strict';
import test from 'node:test';
import { getPreviewUser, PREVIEW_ADMIN, PREVIEW_COUNSELOR, PREVIEW_ROLE_KEY, resolvePreviewMode, setPreviewRole } from './previewMode.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('preview mode is enabled only by the explicit development flag', () => {
  assert.equal(resolvePreviewMode('development', 'true'), true);
  assert.equal(resolvePreviewMode('development', 'false'), false);
  assert.equal(resolvePreviewMode('development', undefined), false);
});

test('preview counselor identity is synthetic and role scoped', () => {
  assert.equal(PREVIEW_COUNSELOR.role, 'konselor');
  assert.match(PREVIEW_COUNSELOR.email, /preview/);
});

test('preview role defaults to admin and switches both persisted and resolved identity', () => {
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage } });
  assert.equal(getPreviewUser().role, 'admin');
  assert.equal(setPreviewRole('konselor').name, 'Konselor Preview');
  assert.equal(sessionStorage.getItem(PREVIEW_ROLE_KEY), 'konselor');
  assert.equal(getPreviewUser().role, 'konselor');
  assert.equal(getPreviewUser().name, 'Konselor Preview');
  assert.equal(setPreviewRole('admin').role, 'admin');
  assert.equal(getPreviewUser().name, 'Preview Administrator');
  Reflect.deleteProperty(globalThis, 'window');
});

test('preview role survives provider-style session reinitialization', () => {
  const sessionStorage = new MemoryStorage();
  sessionStorage.setItem(PREVIEW_ROLE_KEY, 'konselor');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage } });
  assert.deepEqual(getPreviewUser(), PREVIEW_COUNSELOR);
  Reflect.deleteProperty(globalThis, 'window');
});

test('production ignores the preview flag', () => {
  assert.equal(resolvePreviewMode('production', 'true'), false);
  assert.equal(resolvePreviewMode('test', 'true'), false);
});

test('preview identity is an obviously local administrator', () => {
  assert.deepEqual(PREVIEW_ADMIN, {
    user_id: 'preview-admin-local',
    name: 'Preview Administrator',
    email: 'preview@sajiwa.local',
    role: 'admin',
  });
});
