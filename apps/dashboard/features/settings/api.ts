import { apiRequest } from '@/lib/api/client';
import type { AcademicUnit, Faculty, FacultyPayload, UnitPayload } from './types';

export async function getAcademicStructure(signal?: AbortSignal) {
  const [facultyResponse, unitResponse] = await Promise.all([
    apiRequest<{ faculties: Faculty[] }>('/admin/academic/faculties?include_inactive=true', { signal }),
    apiRequest<{ academic_units: AcademicUnit[] }>('/admin/academic/units?include_inactive=true', { signal }),
  ]);
  return { faculties: facultyResponse.faculties, units: unitResponse.academic_units };
}
export const createFaculty = (body: FacultyPayload) => apiRequest<{ faculty: Faculty }>('/admin/academic/faculties', { method: 'POST', body });
export const updateFaculty = (id: string, body: FacultyPayload) => apiRequest<{ faculty: Faculty }>(`/admin/academic/faculties/${encodeURIComponent(id)}`, { method: 'PUT', body });
export const createUnit = (body: UnitPayload) => apiRequest<{ academic_unit: AcademicUnit }>('/admin/academic/units', { method: 'POST', body });
export const updateUnit = (id: string, body: UnitPayload) => apiRequest<{ academic_unit: AcademicUnit }>(`/admin/academic/units/${encodeURIComponent(id)}`, { method: 'PUT', body });
