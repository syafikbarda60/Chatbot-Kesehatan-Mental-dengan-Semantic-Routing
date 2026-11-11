import { highestSeverity, severityRank } from '../overview/model.ts';
import type { AttentionResponse, CounselingRequestsResponse } from '../overview/types.ts';
import type {
  AcademicStructure,
  AcademicUnit,
  DatePreset,
  MonitoringCase,
  MonitoringFilters,
  RiskLevel,
} from './types.ts';

const riskRanks: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

export function normalizeAssessmentRisk(severity: string | null): RiskLevel {
  const rank = severityRank(severity);
  if (rank >= 4) return 'critical';
  if (rank === 3) return 'high';
  if (rank === 2) return 'medium';
  if (rank >= 0) return 'low';
  return 'unknown';
}

export function buildMonitoringCases(attention: AttentionResponse, requests: CounselingRequestsResponse, academic?: AcademicStructure): MonitoringCase[] {
  const cases: MonitoringCase[] = [
    ...attention.signals.map((signal): MonitoringCase => {
      const categoryResults = signal.assessment_category_results ?? [];
      const backendSeverity = highestSeverity(categoryResults);
      return {
        id: `attention:${signal.guardrail_log_id}`,
        sourceId: signal.guardrail_log_id,
        type: signal.signal_type,
        studentId: signal.user_id,
        studentName: signal.name,
        nim: signal.nim,
        facultyName: null,
        academicUnitName: null,
        facultyId: null,
        academicUnitId: null,
        createdAt: signal.notified_at,
        reviewState: signal.is_read ? 'reviewed' : 'unreviewed',
        risk: signal.signal_type === 'safety' ? 'critical' : normalizeAssessmentRisk(backendSeverity),
        backendSeverity,
        categoryResults,
      };
    }),
    ...requests.requests.map((request): MonitoringCase => ({
      id: `request:${request.counseling_request_id}`,
      sourceId: request.counseling_request_id,
      type: 'request',
      studentId: request.student_id,
      studentName: request.name,
      nim: request.nim,
      facultyName: request.faculty_name,
      academicUnitName: request.academic_unit_name,
      facultyId: academic?.faculties.find((faculty) => faculty.name === request.faculty_name)?.faculty_id ?? null,
      academicUnitId: academic?.academicUnits.find((unit) => unit.name === request.academic_unit_name && (!request.faculty_name || unit.faculty_name === request.faculty_name))?.academic_unit_id ?? null,
      createdAt: request.created_at,
      reviewState: 'unreviewed',
      risk: 'unknown',
      backendSeverity: null,
      categoryResults: [],
    })),
  ];
  return deduplicateCases(cases).sort(compareCases);
}

export function deduplicateCases(cases: MonitoringCase[]): MonitoringCase[] {
  const unique = new Map<string, MonitoringCase>();
  cases.forEach((item) => { if (!unique.has(item.id)) unique.set(item.id, item); });
  return [...unique.values()];
}

export function compareCases(left: MonitoringCase, right: MonitoringCase): number {
  const riskDifference = riskRanks[right.risk] - riskRanks[left.risk];
  if (riskDifference) return riskDifference;
  const timeDifference = timestamp(right.createdAt) - timestamp(left.createdAt);
  return timeDifference || left.id.localeCompare(right.id);
}

export function filterMonitoringCases(cases: MonitoringCase[], filters: MonitoringFilters, now: Date): MonitoringCase[] {
  const term = filters.search.trim().toLocaleLowerCase('id-ID');
  const range = resolveDateRange(filters.preset, filters.dateFrom, filters.dateTo, now);
  return cases.filter((item) => {
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (term && ![item.studentName ?? '', item.nim ?? ''].some((value) => value.toLocaleLowerCase('id-ID').includes(term))) return false;
    if (filters.review !== 'all' && item.reviewState !== filters.review) return false;
    if (filters.risk !== 'all' && item.risk !== filters.risk) return false;
    if (range && !withinRange(item.createdAt, range.from, range.to)) return false;
    if (item.type === 'request') {
      if (filters.facultyIds.length && (!item.facultyName || !filters.facultyIds.some((id) => id === item.facultyId))) return false;
      if (filters.academicUnitIds.length && (!item.academicUnitName || !filters.academicUnitIds.some((id) => id === item.academicUnitId))) return false;
    }
    return true;
  });
}

export function resolveDateRange(preset: DatePreset, customFrom: string, customTo: string, now: Date): { from: string; to: string } | null {
  if (preset === 'all') return null;
  if (preset === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
  const to = jakartaDateKey(now);
  const days = preset === 'today' ? 0 : preset === '7days' ? 6 : 29;
  const start = new Date(now.getTime() - days * 86_400_000);
  return { from: jakartaDateKey(start), to };
}

export function compatibleAcademicUnits(facultyIds: string[], units: AcademicUnit[]): AcademicUnit[] {
  return facultyIds.length === 1 ? units.filter((unit) => unit.faculty_id === facultyIds[0]) : [];
}

export function reconcileAcademicUnits(facultyIds: string[], selectedUnitIds: string[], units: AcademicUnit[]): string[] {
  const compatible = new Set(compatibleAcademicUnits(facultyIds, units).map((unit) => unit.academic_unit_id));
  return selectedUnitIds.filter((id) => compatible.has(id));
}

export function clearMonitoringSelection(): Set<string> {
  return new Set<string>();
}

export function paginateCases(cases: MonitoringCase[], page: number, pageSize: number): { rows: MonitoringCase[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(cases.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return { rows: cases.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pageCount };
}

export function safeTriggerParts(item: MonitoringCase): { category: string; severity: string | null; score: number | null }[] {
  return item.type === 'assessment'
    ? item.categoryResults.map((result) => ({ category: result.category, severity: result.severity, score: result.scaled_score }))
    : [];
}

function withinRange(value: string | null, from: string, to: string): boolean {
  if (!value) return false;
  const key = jakartaDateKey(new Date(value));
  return key >= from && key <= to;
}

function timestamp(value: string | null): number {
  const result = value ? Date.parse(value) : 0;
  return Number.isNaN(result) ? 0 : result;
}

export function jakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
