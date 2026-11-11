import { apiRequest } from '@/lib/api/client';
import { getCounselingCalendar, getCounselors } from '@/features/counseling/api';
import type { CounselorProfilePayload, AvailabilityPayload, AvailabilityResponse, CalendarResponse } from './types';

export { getCounselors };

export function getAvailability(counselorId?: string, signal?: AbortSignal): Promise<AvailabilityResponse> {
  const query = new URLSearchParams();
  if (counselorId) query.set('counselor_id', counselorId);
  const suffix = query.size ? `?${query}` : '';
  return apiRequest(`/admin/counseling/availability${suffix}`, { signal });
}

export function getCounselorOperations(counselorId: string, dateFrom: string, dateTo: string, signal?: AbortSignal): Promise<CalendarResponse> {
  return getCounselingCalendar(dateFrom, dateTo, counselorId, signal);
}

export function updateCounselorProfile(counselorId: string, body: CounselorProfilePayload): Promise<unknown> {
  return apiRequest(`/admin/counselors/${encodeURIComponent(counselorId)}/profile`, { method: 'PUT', body });
}

export function createAvailability(body: AvailabilityPayload): Promise<unknown> {
  return apiRequest('/admin/counseling/availability', { method: 'POST', body });
}

export function deactivateAvailability(ruleId: string): Promise<unknown> {
  return apiRequest(`/admin/counseling/availability/${encodeURIComponent(ruleId)}`, { method: 'DELETE' });
}

