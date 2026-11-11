import { apiFetch } from './api';
import type { BookingStatus, Role, Severity } from './admin';

export interface AttentionSignal {
  guardrail_log_id: string;
  user_id: string | null;
  assessment_id: string | null;
  is_read: boolean;
  notified_at: string | null;
  name: string | null;
  nim: string | null;
  signal_type: 'assessment' | 'safety' | 'request';
  assessment_categories?: string | null;
  assessment_category_results?: {
    category: 'depression' | 'anxiety' | 'stress';
    severity: string;
    scaled_score: number;
  }[] | null;
}

export interface AttentionPage {
  signals: AttentionSignal[];
  summary: {
    signal_type: 'assessment' | 'safety' | 'request';
    total: number;
    unread: number;
  }[];
  total: number;
  page: number;
  page_size: number;
}

export interface OrganizationSchedule {
  counseling_slot_id: string;
  counselor_id: string;
  counselor_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  counseling_booking_id: string | null;
  booking_status: BookingStatus | null;
}

export type HotlineVerificationStatus = 'active' | 'verification_required' | 'inactive';

export interface HotlineRow {
  hotline_id: string;
  name: string;
  phone: string;
  description: string | null;
  created_at: string | null;
  verification_status?: HotlineVerificationStatus;
  verified_at?: string | null;
  verified_by?: string | null;
  verification_note?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export type HotlineCreate = Pick<HotlineRow, 'name' | 'phone' | 'description'> &
  Partial<Pick<HotlineRow, 'verification_status' | 'verification_note'>>;

export type HotlineUpdate = Partial<
  Pick<HotlineRow, 'name' | 'phone' | 'description' | 'verification_status' | 'verification_note'>
>;

export interface AnalyticsData {
  date_from: string;
  date_to: string;
  registered_students: number;
  assessment_total: number;
  severity_distribution: {
    severity: Severity;
    count: number;
  }[];
  assessment_trend: {
    date: string;
    count: number;
  }[];
  booking_total: number;
  booking_status: {
    status: BookingStatus;
    count: number;
  }[];
  academic_breakdown?: {
    faculty_name: string;
    academic_unit_name: string | null;
    assessment_count: number;
    attention_count: number;
  }[];
}

export interface AccountDraft {
  name: string;
  email: string;
  password: string;
  nim?: string;
  role: Role;
}

export function apiGetAttention(
  params: {
    signal?: string;
    unread_only?: boolean;
    page?: number;
    faculty_ids?: string[];
    academic_unit_ids?: string[];
  } = {},
) {
  const query = new URLSearchParams();

  if (params.signal) {
    query.set('signal', params.signal);
  }

  if (params.unread_only) {
    query.set('unread_only', 'true');
  }

  if (params.page) {
    query.set('page', String(params.page));
  }

  params.faculty_ids?.forEach((value) => {
    query.append('faculty_id', value);
  });

  params.academic_unit_ids?.forEach((value) => {
    query.append('academic_unit_id', value);
  });

  return apiFetch<AttentionPage>(`/admin/attention?${query.toString()}`);
}

export function apiMarkAttentionRead(id: string) {
  return apiFetch(
    `/admin/attention/${encodeURIComponent(id)}/read`,
    {
      method: 'PATCH',
    },
  );
}

export function apiGetOrganizationSchedules(
  params: {
    date_from?: string;
    date_to?: string;
    counselor_id?: string;
  } = {},
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  return apiFetch<{
    schedules: OrganizationSchedule[];
    total: number;
  }>(`/admin/schedules?${query.toString()}`);
}

export function apiCreateOrganizationSchedule(data: {
  counselor_id: string;
  date: string;
  start_time: string;
  end_time: string;
}) {
  return apiFetch('/admin/schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateOrganizationSchedule(
  id: string,
  status: OrganizationSchedule['status'],
) {
  return apiFetch(`/admin/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function apiGetHotlines() {
  return apiFetch<{
    hotlines: HotlineRow[];
    total: number;
  }>('/admin/hotlines');
}

export function apiCreateHotline(data: HotlineCreate) {
  return apiFetch<{ hotline: HotlineRow }>('/admin/hotlines', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateHotline(
  id: string,
  data: HotlineUpdate,
) {
  return apiFetch<{ hotline: HotlineRow }>(`/admin/hotlines/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function apiDeleteHotline(id: string) {
  return apiFetch<{ message: string }>(`/admin/hotlines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function apiGetAnalytics(date_from?: string, date_to?: string) {
  const query = new URLSearchParams();

  if (date_from) {
    query.set('date_from', date_from);
  }

  if (date_to) {
    query.set('date_to', date_to);
  }

  return apiFetch<AnalyticsData>(
    `/admin/analytics?${query.toString()}`,
  );
}
