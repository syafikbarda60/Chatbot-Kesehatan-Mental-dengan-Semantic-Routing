import { apiRequest } from '@/lib/api/client';
import type { AnalyticsFilters, AnalyticsResponse } from './types';

export function getAnalytics(filters: AnalyticsFilters, signal?: AbortSignal): Promise<AnalyticsResponse> {
  const query = new URLSearchParams({ date_from: filters.dateFrom, date_to: filters.dateTo });
  filters.facultyIds.forEach((id) => query.append('faculty_id', id));
  if (filters.facultyIds.length === 1) filters.academicUnitIds.forEach((id) => query.append('academic_unit_id', id));
  return apiRequest(`/admin/analytics/comparison?${query}`, { signal });
}
