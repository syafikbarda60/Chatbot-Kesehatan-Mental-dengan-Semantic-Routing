import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSession, isAdminRole, isPortalRole, readSession, writeSession, type StoredSession } from './session.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('accepts only the backend administrator role', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('mahasiswa'), false);
  assert.equal(isAdminRole('konselor'), false);
  assert.equal(isAdminRole('pemangku_jabatan'), false);
});

test('portal admits administrators and counselors only', () => {
  assert.equal(isPortalRole('admin'), true);
  assert.equal(isPortalRole('konselor'), true);
  assert.equal(isPortalRole('mahasiswa'), false);
  assert.equal(isPortalRole('pemangku_jabatan'), false);
});

test('stores, reads, and clears a per-tab session', () => {
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage } });
  const session: StoredSession = {
    accessToken: 'test-token-never-logged',
    user: { user_id: 'test-user', email: 'admin@example.test', name: 'Admin Test', role: 'admin' },
  };

  writeSession(session);
  assert.deepEqual(readSession(), session);
  clearSession();
  assert.equal(readSession(), null);
  Reflect.deleteProperty(globalThis, 'window');
});
