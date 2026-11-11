import assert from 'node:assert/strict';
import test from 'node:test';
import { readNotice, reconnectDelay, shouldReconnect } from './notice.ts';

test('a change notice names one known area and nothing else is trusted', () => {
  assert.deepEqual(readNotice('{"type":"ready"}'), { kind: 'ready' });
  assert.deepEqual(readNotice('{"type":"changed","topic":"signals"}'), { kind: 'changed', topic: 'signals' });
  assert.deepEqual(readNotice('{"type":"changed","topic":"notifications"}'), { kind: 'changed', topic: 'notifications' });
  assert.equal(readNotice('{"type":"changed","topic":"journals"}'), null);
  assert.equal(readNotice('{"type":"changed"}'), null);
  assert.equal(readNotice('not json'), null);
  assert.equal(readNotice('null'), null);
});

test('a dropped socket retries with growing pauses, but a refused session never retries', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(reconnectDelay), [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
  assert.equal(shouldReconnect(1006), true);
  assert.equal(shouldReconnect(1011), true);
  assert.equal(shouldReconnect(4401), false);
  assert.equal(shouldReconnect(4403), false);
});
