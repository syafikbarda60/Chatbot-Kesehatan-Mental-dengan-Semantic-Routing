import { apiRequest } from '@/lib/api/client';
import { directoryQuery } from './model';
import type {
  DirectoryFilters,
  IdentityPayload,
  StudentAssessmentPage,
  StudentBookingPage,
  StudentDirectoryResponse,
  StudentRow,
} from './types';

export function getStudents(filters: DirectoryFilters, signal?: AbortSignal): Promise<StudentDirectoryResponse> {
  return apiRequest(`/admin/students?${directoryQuery(filters)}`, { signal });
}

export function getStudent(studentId: string, signal?: AbortSignal): Promise<StudentRow> {
  return apiRequest<{ user: StudentRow }>(`/admin/users/${encodeURIComponent(studentId)}`, { signal }).then((response) => response.user);
}

export function getStudentAssessments(studentId: string, page = 1, pageSize = 20, signal?: AbortSignal): Promise<StudentAssessmentPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return apiRequest(`/admin/users/${encodeURIComponent(studentId)}/assessments?${query}`, { signal });
}

export function getStudentBookings(studentId: string, page = 1, pageSize = 20, signal?: AbortSignal): Promise<StudentBookingPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return apiRequest(`/admin/users/${encodeURIComponent(studentId)}/bookings?${query}`, { signal });
}

export function updateStudentIdentity(studentId: string, payload: IdentityPayload): Promise<{ message: string; user_id: string }> {
  return apiRequest(`/accounts/${encodeURIComponent(studentId)}`, { method: 'PUT', body: payload });
}

export function updateStudentAcademic(studentId: string, facultyId: string | null, academicUnitId: string | null): Promise<{ academic_profile: { user_id: string; faculty_id: string | null; academic_unit_id: string | null } }> {
  return apiRequest(`/admin/students/${encodeURIComponent(studentId)}/academic-profile`, {
    method: 'PUT', body: { faculty_id: facultyId, academic_unit_id: academicUnitId },
  });
}
