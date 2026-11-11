import assert from 'node:assert/strict';
import test from 'node:test';
import { sameQuestions, validateDass21Questions } from './model.ts';
import type { DASS21Category, DASS21Question } from './model.ts';

// The official DASS-21 blueprint: item number -> category.
const STRESS = [1, 6, 8, 11, 12, 14, 18];
const ANXIETY = [2, 4, 7, 9, 15, 19, 20];
const category = (n: number): DASS21Category => STRESS.includes(n) ? 'STRESS' : ANXIETY.includes(n) ? 'ANXIETY' : 'DEPRESSION';
const complete = (): DASS21Question[] => Array.from({ length: 21 }, (_, i) => ({ id: `q${i + 1}`, orderNumber: i + 1, text: `Soal ${i + 1}`, category: category(i + 1) }));

test('the complete blueprint is valid', () => assert.deepEqual(validateDass21Questions(complete()), { valid: true, errors: [] }));

test('blank text is named by its number', () => {
  const rows = complete(); rows[4] = { ...rows[4], text: '   ' };
  assert.deepEqual(validateDass21Questions(rows), { valid: false, errors: ['Soal 5 belum diisi'] });
});

test('a short category says how many items it has', () => {
  const { errors } = validateDass21Questions(complete().filter((q) => q.orderNumber !== 18));
  assert.ok(errors.includes('Kategori Stres baru 6 dari 7 soal'));
  assert.ok(errors.includes('Harus tepat 21 soal (sekarang 20)'));
});

test('numbers must be 1 to 21 without repeats', () => {
  const rows = complete(); rows[1] = { ...rows[1], orderNumber: 1 };
  assert.ok(validateDass21Questions(rows).errors.includes('Nomor soal harus 1–21 tanpa duplikat'));
});

test('only a change in text or category makes the batch dirty', () => {
  const saved = complete();
  assert.equal(sameQuestions(saved.map((q) => ({ ...q })), saved), true);
  assert.equal(sameQuestions(saved.map((q, i) => i === 3 ? { ...q, text: 'Baru' } : q), saved), false);
  assert.equal(sameQuestions(saved.map((q, i) => i === 3 ? { ...q, category: 'STRESS' } : q), saved), false);
});
