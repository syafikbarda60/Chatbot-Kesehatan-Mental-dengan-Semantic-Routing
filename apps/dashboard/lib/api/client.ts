import { readSession } from '@/lib/auth/session';
import { isPreviewMode } from '@/lib/previewMode';
import { previewRequest } from '@/lib/previewData';

export const AUTH_EXPIRED_EVENT = 'sajiwa:auth-expired';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly errors: string[] = []) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean;
  body?: BodyInit | object | null;
}

export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8000';
  throw new Error('NEXT_PUBLIC_API_URL wajib diatur untuk build produksi.');
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (isPreviewMode()) return previewRequest<T>(path, options);
  const { auth = true, body, headers: suppliedHeaders, ...requestInit } = options;
  const headers = new Headers(suppliedHeaders);
  let requestBody = body as BodyInit | null | undefined;

  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  if (auth) {
    const token = readSession()?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...requestInit,
    body: requestBody,
    credentials: 'omit',
    headers,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? (await response.json()) as unknown : await response.text();

  if (!response.ok) {
    if (auth && response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const messages: Record<number, string> = {
      400: 'Permintaan tidak dapat diproses.',
      401: 'Email atau kata sandi salah, atau sesi telah berakhir.',
      403: 'Akun ini tidak memiliki izin untuk mengakses portal ini.',
      404: 'Data yang diminta tidak ditemukan.',
      422: 'Periksa kembali data yang dimasukkan.',
      429: 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
    };
    // A conflict or rule violation carries the server's own Indonesian explanation
    // (`detail` as a string, or `{ message, errors }`); anything else keeps the generic copy.
    const detail = (payload as { detail?: unknown } | null)?.detail;
    const body = typeof detail === 'object' && detail !== null ? detail as { message?: unknown; errors?: unknown } : {};
    const serverMessage = typeof detail === 'string' ? detail : typeof body.message === 'string' ? body.message : undefined;
    const errors = Array.isArray(body.errors) ? body.errors.filter((item): item is string => typeof item === 'string') : [];
    const fallback = messages[response.status] ?? 'Layanan sedang bermasalah. Coba lagi beberapa saat.';
    throw new ApiError(response.status, (response.status === 409 || response.status === 422) && serverMessage ? serverMessage : fallback, errors);
  }

  return payload as T;
}
