import { apiRequest } from '@/lib/api/client';
import type {
  AttentionResponse,
  CounselingCalendarResponse,
  CounselingRequestsResponse,
  OrganizationSchedulesResponse,
  OverviewSources,
} from '@/features/overview/types';

export function getAttention(signal?: AbortSignal, options: { unreadOnly?: boolean; facultyIds?: string[]; academicUnitIds?: string[] } = { unreadOnly: true }): Promise<AttentionResponse> {
  const query = new URLSearchParams({ page: '1', page_size: '100' });
  if (options.unreadOnly) query.set('unread_only', 'true');
  options.facultyIds?.forEach((value) => query.append('faculty_id', value));
  options.academicUnitIds?.forEach((value) => query.append('academic_unit_id', value));
  return apiRequest(`/admin/attention?${query}`, { signal });
}

export function getRequestedCounseling(signal?: AbortSignal): Promise<CounselingRequestsResponse> {
  return apiRequest('/admin/counseling/requests?status=requested&page=1&page_size=100', { signal });
}

export function getTodayCalendar(date: string, signal?: AbortSignal): Promise<CounselingCalendarResponse> {
  const query = new URLSearchParams({ date_from: date, date_to: date });
  return apiRequest(`/admin/counseling/calendar/multi?${query}`, { signal });
}

export function getTodaySchedules(date: string, signal?: AbortSignal): Promise<OrganizationSchedulesResponse> {
  const query = new URLSearchParams({ date_from: date, date_to: date });
  return apiRequest(`/admin/schedules?${query}`, { signal });
}

export async function getOverviewSources(date: string, signal?: AbortSignal): Promise<OverviewSources> {
  const [attention, requests, calendar, schedules] = await Promise.all([
    getAttention(signal),
    getRequestedCounseling(signal),
    getTodayCalendar(date, signal),
    getTodaySchedules(date, signal),
  ]);
  return { attention, requests, calendar, schedules };
}

export function markAttentionReviewed(id: string): Promise<{ message: string }> {
  return apiRequest(`/admin/attention/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}
