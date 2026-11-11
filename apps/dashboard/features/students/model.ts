import type { AcademicUnit } from '@/features/monitoring/types';
import type {
  DirectoryFilters,
  IdentityDraft,
  IdentityPayload,
  StudentAssessment,
  StudentBooking,
  StudentRow,
} from './types';

export function directoryQuery(filters: DirectoryFilters): string {
  const query = new URLSearchParams({ page: String(filters.page), page_size: String(filters.pageSize) });
  if (filters.search.trim()) query.set('search', filters.search.trim());
  if (filters.facultyId) query.set('faculty_id', filters.facultyId);
  if (filters.academicUnitId) query.set('academic_unit_id', filters.academicUnitId);
  return query.toString();
}

export function unitsForFaculty(facultyId: string, units: AcademicUnit[]): AcademicUnit[] {
  return facultyId ? units.filter((unit) => unit.faculty_id === facultyId) : [];
}

export function reconcileStudentUnit(facultyId: string, unitId: string, units: AcademicUnit[]): string {
  return unitsForFaculty(facultyId, units).some((unit) => unit.academic_unit_id === unitId) ? unitId : '';
}

export function validateIdentityDraft(draft: IdentityDraft, original: StudentRow): { payload: IdentityPayload | null; error: 'name' | 'nim' | null } {
  const name = draft.name.trim();
  const nim = draft.nim.trim();
  if (!name) return { payload: null, error: 'name' };
  if (original.nim && !nim) return { payload: null, error: 'nim' };
  const payload: IdentityPayload = { name };
  if (nim) payload.nim = nim;
  return { payload, error: null };
}

export function safeAssessmentSummary(assessment: StudentAssessment): { category: string; scaledScore: number | null; severity: string | null }[] {
  return (assessment.category_results ?? []).map((result) => ({ category: result.category, scaledScore: result.scaled_score, severity: result.severity }));
}

export function studentInitials(name: string): string {
  const result = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return result || '?';
}

export function isStudentProfile(value: StudentRow): boolean {
  return value.role === 'mahasiswa';
}

export function paginateRange(page: number, pageSize: number, total: number): { from: number; to: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return { from: 0, to: 0, pageCount };
  return { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), pageCount };
}

export function bookingDateTime(booking: StudentBooking): string {
  return `${booking.date}T${booking.start_time}`;
}
