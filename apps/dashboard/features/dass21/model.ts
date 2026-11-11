// Mirrors apps/backend/core/dass21_batch.py: the server runs the same rules on submit and is
// the one that decides. Change both together.
export type DASS21Category = 'DEPRESSION' | 'ANXIETY' | 'STRESS';
export type DASS21Status = 'DRAFT' | 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';

export interface DASS21Question {
  id: string;
  text: string;
  category: DASS21Category;
  orderNumber: number; // 1–21, fixed
}

export interface DASS21BatchDraft {
  id?: string;
  version: number;
  status: DASS21Status;
  questions: DASS21Question[];
  reviewNote?: string | null; // the counselor's note while REJECTED
  updatedAt?: string;
}

const CATEGORY_LABELS: Record<DASS21Category, string> = { DEPRESSION: 'Depresi', ANXIETY: 'Kecemasan', STRESS: 'Stres' };

export function validateDass21Questions(questions: DASS21Question[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (questions.length !== 21) errors.push(`Harus tepat 21 soal (sekarang ${questions.length})`);
  const numbers = questions.map((q) => q.orderNumber);
  if (new Set(numbers).size !== numbers.length || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 21)) errors.push('Nomor soal harus 1–21 tanpa duplikat');
  for (const q of questions) if (!q.text.trim()) errors.push(`Soal ${q.orderNumber} belum diisi`);
  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    const count = questions.filter((q) => q.category === category).length;
    if (count < 7) errors.push(`Kategori ${label} baru ${count} dari 7 soal`);
    else if (count > 7) errors.push(`Kategori ${label} berisi ${count} soal, harus 7`);
  }
  return { valid: errors.length === 0, errors };
}

export function sameQuestions(a: DASS21Question[], b: DASS21Question[]) {
  return a.length === b.length && a.every((q, i) => q.id === b[i].id && q.text === b[i].text && q.category === b[i].category);
}
