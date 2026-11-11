import type { AcademicStructure } from '@/features/monitoring/types';
import type { AnalyticsFilters, AnalyticsResponse, ReportConfiguration, ReportSection, Severity } from './types';

export const ANALYTICS_STORAGE_KEY = 'sajiwa:analytics-filters:v1';
export const REPORT_STORAGE_KEY = 'sajiwa:stakeholder-report:v1';
export const REPORT_SECTIONS: ReportSection[] = ['summary', 'assessmentTrend', 'dimensions', 'academic', 'counseling', 'insights', 'appendix'];
export const SEVERITY_ORDER: Severity[] = ['minimal', 'normal', 'mild', 'moderate', 'severe', 'extremely_severe'];

export function jakartaDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+07:00`); date.setUTCDate(date.getUTCDate() + days); return jakartaDateKey(date);
}
export function defaultFilters(now = new Date()): AnalyticsFilters {
  const dateTo = jakartaDateKey(now);
  return { dateFrom: shiftDate(dateTo, -29), dateTo, preset: '30days', compareBy: 'faculty', facultyIds: [], academicUnitIds: [] };
}
export function applyPreset(filters: AnalyticsFilters, preset: AnalyticsFilters['preset'], now = new Date()): AnalyticsFilters {
  if (preset === 'custom') return { ...filters, preset };
  const dateTo = jakartaDateKey(now); return { ...filters, preset, dateFrom: shiftDate(dateTo, preset === '7days' ? -6 : -29), dateTo };
}
export function validateDates(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return false;
  return (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000 <= 366;
}
export function sanitizeFilters(value: unknown, fallback = defaultFilters()): AnalyticsFilters {
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Partial<AnalyticsFilters>;
  const from = typeof row.dateFrom === 'string' ? row.dateFrom : fallback.dateFrom;
  const to = typeof row.dateTo === 'string' ? row.dateTo : fallback.dateTo;
  return {
    dateFrom: validateDates(from, to) ? from : fallback.dateFrom,
    dateTo: validateDates(from, to) ? to : fallback.dateTo,
    preset: row.preset === '7days' || row.preset === '30days' || row.preset === 'custom' ? row.preset : fallback.preset,
    compareBy: row.compareBy === 'academic_unit' ? 'academic_unit' : 'faculty',
    facultyIds: Array.isArray(row.facultyIds) ? row.facultyIds.filter((id): id is string => typeof id === 'string').slice(0, 20) : [],
    academicUnitIds: Array.isArray(row.academicUnitIds) ? row.academicUnitIds.filter((id): id is string => typeof id === 'string').slice(0, 50) : [],
  };
}
export function sanitizeForStructure(filters: AnalyticsFilters, structure: AcademicStructure): AnalyticsFilters {
  const validFaculties = new Set(structure.faculties.filter((item) => item.active).map((item) => item.faculty_id));
  const facultyIds = filters.facultyIds.filter((id) => validFaculties.has(id));
  const validUnits = new Set(structure.academicUnits.filter((item) => item.active && facultyIds.length === 1 && item.faculty_id === facultyIds[0]).map((item) => item.academic_unit_id));
  return { ...filters, facultyIds, academicUnitIds: filters.academicUnitIds.filter((id) => validUnits.has(id)) };
}
export function aggregate(data: AnalyticsResponse) {
  const assessmentTotal = sum(data.severity_distribution.map((row) => row.count));
  const severe = sum(data.severity_distribution.filter((row) => row.severity === 'severe' || row.severity === 'extremely_severe').map((row) => row.count));
  const counselingTotal = sum(data.counseling_utilization.map((row) => row.count));
  const completed = sum(data.counseling_utilization.filter((row) => row.status === 'completed').map((row) => row.count));
  const signals = sum(data.attention_counts.map((row) => row.count));
  return { assessmentTotal, severe, highRiskPercent: assessmentTotal ? Math.round(severe / assessmentTotal * 100) : 0, counselingTotal, completed, signals };
}
export function groupTrend(data: AnalyticsResponse) {
  const map = new Map<string, number>(); data.assessment_trend.forEach((row) => map.set(row.date, (map.get(row.date) ?? 0) + row.assessment_count));
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
}
export function severityByCategory(data: AnalyticsResponse) {
  return ['depression', 'anxiety', 'stress'].map((category) => ({ category, values: SEVERITY_ORDER.map((severity) => ({ severity, value: sum(data.category_severity_distribution.filter((row) => row.category === category && row.severity === severity).map((row) => row.count)) })).filter((item) => item.value > 0) }));
}
export function academicComparison(data: AnalyticsResponse) {
  const labels = [...new Set(data.severity_distribution.map((row) => row.scope_label))];
  return labels.map((label) => { const rows = data.severity_distribution.filter((row) => row.scope_label === label); const total = sum(rows.map((row) => row.count)); const high = sum(rows.filter((row) => row.severity === 'severe' || row.severity === 'extremely_severe').map((row) => row.count)); return { label, total, high, percent: total ? Math.round(high / total * 100) : 0 }; });
}
export function counselingComposition(data: AnalyticsResponse) {
  const statuses = [...new Set(data.counseling_utilization.map((row) => row.status))];
  return statuses.map((status) => ({ label: status, value: sum(data.counseling_utilization.filter((row) => row.status === status).map((row) => row.count)) })).sort((a, b) => b.value - a.value);
}
export function insights(data: AnalyticsResponse, language: 'id' | 'en' = 'id'): string[] {
  const totals = aggregate(data); const comparison = academicComparison(data).sort((a, b) => b.percent - a.percent || b.total - a.total); const trend = groupTrend(data);
  const first = trend[0]?.value ?? 0; const last = trend.at(-1)?.value ?? 0;
  if (language === 'en') return [
    `Assessment Activity: ${trend.length < 2 ? 'there are not enough time points to compare change.' : `${last >= first ? 'increased' : 'decreased'} from ${first} to ${last} submissions on the first and last recorded dates.`}`,
    `Academic Focus: ${comparison.length > 1 ? `${comparison[0].label} has the highest observed severe-result proportion (${comparison[0].percent}% of ${comparison[0].total} submissions).` : 'select multiple faculties or units to compare observed severe-result proportions.'}`,
    `Service Utilization: ${totals.counselingTotal} appointments were recorded in this period; ${totals.completed} are completed.`,
    `Attention: ${totals.signals} aggregate operational signals were recorded; individual details are not included on this page.`,
  ];
  return [
    `Aktivitas Asesmen: ${trend.length < 2 ? 'belum cukup titik waktu untuk membandingkan perubahan.' : `${last >= first ? 'meningkat' : 'menurun'} dari ${first} menjadi ${last} pengiriman pada tanggal pertama dan terakhir yang tercatat.`}`,
    `Fokus Akademik: ${comparison.length > 1 ? `${comparison[0].label} memiliki proporsi hasil severe tertinggi yang teramati (${comparison[0].percent}% dari ${comparison[0].total} pengiriman).` : 'pilih beberapa fakultas atau unit untuk membandingkan proporsi hasil severe.'}`,
    `Pemanfaatan Layanan: ${totals.counselingTotal} janji temu tercatat pada periode ini; ${totals.completed} berstatus selesai.`,
    `Perlu Perhatian: ${totals.signals} sinyal operasional agregat tercatat; rincian individu tidak dimuat di halaman ini.`,
  ];
}
export function makeReportConfiguration(filters: AnalyticsFilters, sections: ReportSection[], now = new Date()): ReportConfiguration { return { version: 1, filters, sections: REPORT_SECTIONS.filter((section) => sections.includes(section)), createdAt: now.toISOString() }; }
export function parseReportConfiguration(raw: string | null): ReportConfiguration | null {
  if (!raw) return null; try { const value = JSON.parse(raw) as Partial<ReportConfiguration>; if (value.version !== 1 || !Array.isArray(value.sections) || typeof value.createdAt !== 'string') return null; return makeReportConfiguration(sanitizeFilters(value.filters), value.sections.filter((x): x is ReportSection => REPORT_SECTIONS.includes(x as ReportSection)), new Date(value.createdAt)); } catch { return null; }
}
function sum(values: number[]): number { return values.reduce((total, value) => total + Number(value || 0), 0); }
