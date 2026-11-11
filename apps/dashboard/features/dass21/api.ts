import { apiRequest } from '@/lib/api/client';
import type { DASS21BatchDraft, DASS21Question } from './model';

// 409/422 reject with ApiError carrying the server's message (and `errors` for a failed submit).
export const getCurrentBatch = (signal?: AbortSignal) => apiRequest<DASS21BatchDraft>('/admin/dass21/batch/current', { signal });
export const saveDraft = (questions: DASS21Question[], updatedAt?: string) => apiRequest<DASS21BatchDraft>('/admin/dass21/batch/draft', { method: 'PUT', body: { questions: questions.map(({ orderNumber, text, category }) => ({ orderNumber, text, category })), updatedAt } });
export const submitForValidation = (batchId: string) => apiRequest<DASS21BatchDraft>(`/admin/dass21/batch/${encodeURIComponent(batchId)}/submit`, { method: 'POST' });
