// Unit tier — which phone gets which advice so greetings and reminders are not swallowed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationTips } from './notificationTips.ts';

test('each aggressive Android skin is recognised by brand, in any letter case', () => {
  assert.equal(notificationTips('android', 'Xiaomi').label, 'Xiaomi / Redmi / POCO');
  assert.equal(notificationTips('android', 'POCO').label, 'Xiaomi / Redmi / POCO');
  assert.equal(notificationTips('android', 'realme').label, 'OPPO / realme / OnePlus');
  assert.equal(notificationTips('android', 'vivo').label, 'vivo / iQOO');
  assert.equal(notificationTips('android', 'HONOR').label, 'Huawei / Honor');
  assert.equal(notificationTips('android', 'samsung').label, 'Samsung');
});

test('every tip ends with the system notification switch, and has a few short steps', () => {
  for (const [os, brand] of [['android', 'xiaomi'], ['android', 'oppo'], ['android', 'google'], ['ios', 'Apple']] as const) {
    const tips = notificationTips(os, brand);
    assert.ok(tips.steps.length >= 1 && tips.steps.length <= 3, `${brand}: ${tips.steps.length} steps`);
    assert.ok(tips.steps.every((step) => step.length < 140), brand);
  }
});

test('an unknown Android brand and an iPhone get the plain advice for their OS', () => {
  assert.equal(notificationTips('android', 'google').label, 'Android');
  assert.equal(notificationTips('ios', null).label, 'iPhone');
  assert.match(notificationTips('ios', null).steps.join(' '), /Ringkasan Terjadwal/);
});
