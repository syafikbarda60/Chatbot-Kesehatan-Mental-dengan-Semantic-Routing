import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeText, timeAgo, toItem } from './model.ts';

test('an admin alert links to the page where it is handled today', () => {
  const row = { admin_notification_id: 'a1', category: 'safety', title: 'Sinyal', context: 'Tinjau', target_path: '/attention', read_at: null, created_at: '2026-10-29T03:00:00Z' };
  assert.deepEqual(toItem(row), { id: 'a1', category: 'safety', title: 'Sinyal', body: 'Tinjau', href: '/monitoring', unread: true, createdAt: '2026-10-29T03:00:00Z' });
  assert.equal(toItem({ ...row, target_path: '/schedule' }).href, '/counseling');
  assert.equal(toItem({ ...row, target_path: '/counseling', read_at: '2026-10-29T04:00:00Z' }).unread, false);
});

test('a counselor notification keeps its own path and body', () => {
  const row = { notification_id: 'n1', category: 'counseling', title: 'Sesi konseling baru', body: 'Jumat, 31 Okt', target_path: '/counselor/schedule', read_at: null, created_at: '2026-10-29T03:00:00Z' };
  const item = toItem(row);
  assert.equal(item.id, 'n1');
  assert.equal(item.body, 'Jumat, 31 Okt');
  assert.equal(item.href, '/counselor/schedule');
});

test('the badge stays short', () => {
  assert.equal(badgeText(0), '');
  assert.equal(badgeText(4), '4');
  assert.equal(badgeText(12), '9+');
});

test('time reads relative while recent and as a date after a week', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(timeAgo('2026-10-29T11:59:40Z', now, 'id'), 'baru saja');
  assert.equal(timeAgo('2026-10-29T11:45:00Z', now, 'id'), '15 mnt lalu');
  assert.equal(timeAgo('2026-10-29T09:00:00Z', now, 'en'), '3 h ago');
  assert.equal(timeAgo('2026-10-27T12:00:00Z', now, 'id'), '2 hari lalu');
  assert.match(timeAgo('2026-10-01T12:00:00Z', now, 'id'), /1 Okt/);
});
