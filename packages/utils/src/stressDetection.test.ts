// Unit tier — the 0–10 stress score that drives the chat's stress indicator.
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeStress, getStressTier } from './stressDetection.ts';

const user = (text: string) => ({ sender: 'user' as const, text });
const ai = (text: string) => ({ sender: 'ai' as const, text });

test('no user message means no stress', () => {
  assert.equal(analyzeStress([]), 0);
});

test('the AI\'s own words never count', () => {
  assert.equal(analyzeStress([ai('putus asa mau mati'), ai('sedih cemas panik')]), 0);
});

test('a crisis phrase outranks a mid-level word', () => {
  assert.ok(analyzeStress([user('aku mau mati')]) > analyzeStress([user('aku sedih')]));
});

test('the score stays inside 0–10', () => {
  const worst = analyzeStress([user('mau mati ingin mati bunuh diri putus asa tidak ada harapan panik krisis depresi berat')]);
  assert.ok(worst <= 10, `score ${worst}`);
  const calm = analyzeStress([user('baik oke lumayan biasa sudah lebih baik')]);
  assert.ok(calm >= 0, `score ${calm}`);
});

test('only the last five user messages are weighed', () => {
  const recent = [user('sedih'), user('cemas'), user('lelah'), user('galau'), user('khawatir')];
  // The old crisis line falls out of the window, so it cannot push the score up.
  assert.ok(analyzeStress([user('aku mau mati'), ...recent]) < analyzeStress(recent));
});

test('a calmer message lowers the score', () => {
  assert.ok(analyzeStress([user('aku sedih'), user('sudah lebih baik')]) < analyzeStress([user('aku sedih')]));
});

test('tiers split at 3 and 6', () => {
  assert.equal(getStressTier(0), 'low');
  assert.equal(getStressTier(3), 'low');
  assert.equal(getStressTier(3.1), 'mid');
  assert.equal(getStressTier(6), 'mid');
  assert.equal(getStressTier(6.1), 'high');
  assert.equal(getStressTier(10), 'high');
});
