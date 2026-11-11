import type {
  AssessmentCategoryResult,
  CounselingAppointment,
  OverviewSources,
  PriorityCase,
} from '@/features/overview/types';

const severityRanks: Record<string, number> = {
  normal: 0,
  minimal: 0,
  mild: 1,
  ringan: 1,
  moderate: 2,
  sedang: 2,
  severe: 3,
  berat: 3,
  extremely_severe: 4,
  'extremely severe': 4,
  'sangat berat': 4,
};

export function severityRank(value: string | null | undefined): number {
  return value ? severityRanks[value.trim().toLowerCase()] ?? -1 : -1;
}

export function highestSeverity(results: AssessmentCategoryResult[]): string | null {
  return results.reduce<string | null>((highest, result) =>
    severityRank(result.severity) > severityRank(highest) ? result.severity : highest, null);
}

export function buildPriorityCases(sources: Pick<OverviewSources, 'attention' | 'requests'>): PriorityCase[] {
  const attentionCases = sources.attention.signals.map<PriorityCase>((signal) => {
    const categoryResults = signal.assessment_category_results ?? [];
    const backendSeverity = highestSeverity(categoryResults);
    const rank = signal.signal_type === 'safety'
      ? 500
      : 300 + Math.max(severityRank(backendSeverity), 0) * 20;
    return {
      id: `attention:${signal.guardrail_log_id}`,
      source: signal.signal_type,
      sourceId: signal.guardrail_log_id,
      studentId: signal.user_id,
      studentName: signal.name,
      nim: signal.nim,
      facultyName: null,
      academicUnitName: null,
      createdAt: signal.notified_at,
      reviewed: signal.is_read,
      categoryResults,
      backendSeverity,
      rank,
    };
  });
  const requestCases = sources.requests.requests.map<PriorityCase>((request) => ({
    id: `request:${request.counseling_request_id}`,
    source: 'request',
    sourceId: request.counseling_request_id,
    studentId: request.student_id,
    studentName: request.name,
    nim: request.nim,
    facultyName: request.faculty_name,
    academicUnitName: request.academic_unit_name,
    createdAt: request.created_at,
    reviewed: false,
    categoryResults: [],
    backendSeverity: null,
    rank: 200,
  }));

  return [...attentionCases, ...requestCases].sort((left, right) => {
    if (left.rank !== right.rank) return right.rank - left.rank;
    const timeDifference = timestamp(right.createdAt) - timestamp(left.createdAt);
    return timeDifference || left.id.localeCompare(right.id);
  });
}

function timestamp(value: string | null): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface OverviewMetrics {
  criticalCases: number;
  activeHighRisk: number;
  awaitingFollowUp: number;
  pendingCounseling: number;
  sessionsToday: number;
  availableSlots: number;
}

export function deriveMetrics(sources: OverviewSources): OverviewMetrics {
  const criticalCases = sources.attention.signals.filter((item) => item.signal_type === 'safety').length;
  const activeHighRisk = sources.attention.signals.filter((item) =>
    item.signal_type === 'assessment' && severityRank(highestSeverity(item.assessment_category_results ?? [])) >= 3).length;
  const unreadSignals = sources.attention.summary.reduce((total, item) => total + item.unread, 0);
  return {
    criticalCases,
    activeHighRisk,
    awaitingFollowUp: unreadSignals + sources.requests.total,
    pendingCounseling: sources.requests.total,
    sessionsToday: sources.calendar.appointments.filter((item) => item.status !== 'cancelled' && item.status !== 'no_show').length,
    availableSlots: sources.schedules.schedules.filter((item) => item.status === 'available' && !item.counseling_booking_id).length,
  };
}

export type SessionDisplayStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'no_show';

export function deriveSessionStatus(appointment: CounselingAppointment, now: Date): SessionDisplayStatus {
  if (appointment.status === 'cancelled') return 'cancelled';
  if (appointment.status === 'no_show') return 'no_show';
  if (appointment.status === 'completed') return 'completed';
  const start = Date.parse(appointment.starts_at);
  const end = Date.parse(appointment.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'scheduled';
  const current = now.getTime();
  if (current >= end) return 'completed';
  if (current >= start) return 'ongoing';
  return 'scheduled';
}

export function jakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function clearPrioritySelection(): Set<string> {
  return new Set<string>();
}
