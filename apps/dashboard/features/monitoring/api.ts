import { apiRequest } from '@/lib/api/client';
import { getAttention, getRequestedCounseling } from '@/features/overview/api';
import type { AttentionResponse, CounselingRequestsResponse } from '@/features/overview/types';
import type { AcademicStructure, AcademicUnit, Faculty } from '@/features/monitoring/types';

export interface MonitoringSources {
  attention: AttentionResponse;
  requests: CounselingRequestsResponse;
}

export function getMonitoringSources(signal: AbortSignal | undefined, facultyIds: string[], academicUnitIds: string[]): Promise<MonitoringSources> {
  return Promise.all([
    getAttention(signal, { unreadOnly: false, facultyIds, academicUnitIds }),
    getRequestedCounseling(signal),
  ]).then(([attention, requests]) => ({ attention, requests }));
}

export async function getAcademicStructure(signal?: AbortSignal): Promise<AcademicStructure> {
  const [facultyResponse, unitResponse] = await Promise.all([
    apiRequest<{ faculties: Faculty[] }>('/admin/academic/faculties', { signal }),
    apiRequest<{ academic_units: AcademicUnit[] }>('/admin/academic/units', { signal }),
  ]);
  return { faculties: facultyResponse.faculties, academicUnits: unitResponse.academic_units };
}
