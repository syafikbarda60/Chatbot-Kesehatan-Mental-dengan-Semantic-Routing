import { apiRequest } from '@/lib/api/client';
import type { Appointment, AppointmentPayload, BlockedPeriodPayload, CalendarResponse, CounselorsResponse, RequestResponse, ResourcesResponse } from './types';

export function getCounselingCalendar(dateFrom: string, dateTo: string, counselorId?: string, signal?: AbortSignal): Promise<CalendarResponse> {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  if (counselorId) query.append('counselor_id', counselorId);
  return apiRequest(`/admin/counseling/calendar/multi?${query}`, { signal });
}

export function getCounselingRequests(page: number, pageSize: number, signal?: AbortSignal): Promise<RequestResponse> {
  const query = new URLSearchParams({ status: 'requested', page: String(page), page_size: String(pageSize) });
  return apiRequest(`/admin/counseling/requests?${query}`, { signal });
}

export function getCounselors(signal?: AbortSignal): Promise<CounselorsResponse> {
  return apiRequest('/admin/counselors', { signal });
}

export function getCounselingResources(signal?: AbortSignal): Promise<ResourcesResponse> {
  return apiRequest('/admin/counseling/resources', { signal });
}

export function assignCounselingRequest(requestId: string, body: AppointmentPayload): Promise<{ appointment: Appointment }> {
  return apiRequest(`/admin/counseling/requests/${encodeURIComponent(requestId)}/assign`, { method: 'POST', body });
}

export function updateAppointment(appointmentId: string, body: Partial<AppointmentPayload> & { status?: Appointment['status'] }): Promise<{ appointment: Appointment }> {
  return apiRequest(`/admin/counseling/appointments/${encodeURIComponent(appointmentId)}`, { method: 'PATCH', body });
}

export function createBlockedPeriod(body: BlockedPeriodPayload): Promise<unknown> {
  return apiRequest('/admin/counseling/blocked-periods', { method: 'POST', body });
}

export function deleteBlockedPeriod(blockId: string): Promise<unknown> {
  return apiRequest(`/admin/counseling/blocked-periods/${encodeURIComponent(blockId)}`, { method: 'DELETE' });
}
