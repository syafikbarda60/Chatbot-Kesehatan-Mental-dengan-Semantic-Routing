import { apiRequest } from '@/lib/api/client';
import type { HotlinePayload, HotlineRecord } from './types';

export async function getHotlines(signal?: AbortSignal): Promise<HotlineRecord[]> {
  const response = await apiRequest<{ hotlines: HotlineRecord[] }>('/admin/hotlines', { signal });
  return response.hotlines;
}
export const createHotline = (body: HotlinePayload) => apiRequest<{ hotline: HotlineRecord }>('/admin/hotlines', { method: 'POST', body });
export const updateHotline = (id: string, body: Partial<HotlinePayload>) => apiRequest<{ hotline: HotlineRecord }>(`/admin/hotlines/${encodeURIComponent(id)}`, { method: 'PUT', body });
export const deactivateHotline = (id: string) => apiRequest<{ hotline: HotlineRecord }>(`/admin/hotlines/${encodeURIComponent(id)}`, { method: 'DELETE' });
