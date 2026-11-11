import { apiFetch } from './api';
import type { Appointment, AvailabilityRule, BlockedPeriod } from './iteration3';
import type { Severity } from './admin';

export type DassCategory = 'depression' | 'anxiety' | 'stress';
export type InstrumentVersionStatus = 'draft' | 'published' | 'archived';

export interface InstrumentVersionSummary {
  instrument_version_id: string;
  version_number: number;
  status: InstrumentVersionStatus;
  authoritative_config: boolean;
  updated_at: string;
  published_at: string | null;
}

export interface AssessmentInstrument {
  instrument_id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  language: string | null;
  instrument_kind: 'standard' | 'custom';
  derived_from_instrument_id: string | null;
  norms_enabled: boolean;
  provenance: Record<string, string>;
  versions: InstrumentVersionSummary[];
}

export interface AnswerOptionDefinition {
  assessment_answer_option_id?: string;
  position: number;
  label: string;
  score: number;
}

export interface QuestionDefinition {
  assessment_question_id?: string;
  item_key: string;
  category: DassCategory;
  position: number;
  wording: string;
  active: boolean;
  options: AnswerOptionDefinition[];
}

export interface InstrumentVersionDetail extends InstrumentVersionSummary {
  instrument_id: string;
  code: string;
  name: string;
  language: string | null;
  instrument_kind: 'standard' | 'custom';
  derived_from_instrument_id: string | null;
  norms_enabled: boolean;
  provenance: Record<string, string>;
  expected_question_count: number;
  scoring_config: Record<string, unknown> | null;
  created_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
  published_by_name: string | null;
}

export interface ComparisonPoint {
  scope_id: string | null;
  scope_label: string;
  date: string;
  assessment_count: number;
}

export interface ComparisonSeverity {
  scope_id: string | null;
  scope_label: string;
  severity: Severity;
  count: number;
}

export interface CategoryTrendPoint {
  scope_id: string | null;
  scope_label: string;
  category: DassCategory;
  date: string;
  score: number;
  submission_count: number;
}

export interface ComparisonAnalytics {
  mode: 'university' | 'faculty' | 'academic_unit';
  date_from: string;
  date_to: string;
  selected_scopes: { scope_id: string | null; scope_label: string }[];
  assessment_trend: ComparisonPoint[];
  severity_distribution: ComparisonSeverity[];
  category_trends: CategoryTrendPoint[];
  category_severity_distribution: { scope_id: string | null; scope_label: string; category: DassCategory; severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'extremely_severe'; count: number }[];
  counseling_utilization: { scope_id: string | null; scope_label: string; status: string; count: number }[];
  attention_counts: { scope_id: string | null; scope_label: string; signal_type: 'assessment' | 'safety'; count: number }[];
}

export interface MultiCalendarCounselor {
  user_id: string;
  name: string;
  title: string | null;
  specialization: string | null;
  active: boolean;
}

export interface MultiCalendarData {
  counselors: MultiCalendarCounselor[];
  appointments: Appointment[];
  availability: AvailabilityRule[];
  blocked_periods: BlockedPeriod[];
}

export interface ActiveAssessmentInstrument {
  version: {
    instrument_version_id: string;
    instrument_id: string;
    code: string;
    name: string;
    language: string | null;
    instrument_kind: 'standard' | 'custom';
    provenance: Record<string, string>;
    /** Set on a DASS-21 variant: the whole subscales it offers. */
    dass21_subscales: DassCategory[] | null;
    version_number: number;
    scoring_config: Record<string, unknown>;
  };
  questions: {
    assessment_question_id: string;
    item_key: string;
    category: DassCategory;
    position: number;
    wording: string;
    options: (AnswerOptionDefinition & { assessment_answer_option_id: string })[];
  }[];
}

export interface InstrumentAssessmentSubmission {
  instrument_version_id: string;
  answers: { question_id: string; option_id: string }[];
}

export interface InstrumentAssessmentCompletion {
  assessment_id: string;
  submitted_at: string;
  message: string;
  support_message: string;
}

function repeatedQuery(key: string, values: string[]) {
  return values.map(value => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export function apiGetAssessmentInstruments() {
  return apiFetch<{ instruments: AssessmentInstrument[]; total: number }>('/admin/assessment-instruments');
}

export function apiGetInstrumentVersion(versionId: string) {
  return apiFetch<{ version: InstrumentVersionDetail; questions: QuestionDefinition[] }>(`/admin/assessment-instruments/versions/${encodeURIComponent(versionId)}`);
}

export function apiCreateInstrumentDraft(instrumentId: string) {
  return apiFetch<{ version: InstrumentVersionDetail; questions: QuestionDefinition[] }>(`/admin/assessment-instruments/${encodeURIComponent(instrumentId)}/drafts`, { method: 'POST' });
}

export function apiCreateDerivedInstrument(instrumentId: string, body: { name: string; code: string; description?: string }) {
  return apiFetch<{ version: InstrumentVersionDetail; questions: QuestionDefinition[] }>(`/admin/assessment-instruments/${encodeURIComponent(instrumentId)}/derived`, { method: 'POST', body: JSON.stringify(body) });
}

export function apiSaveInstrumentDraft(versionId: string, questions: QuestionDefinition[]) {
  return apiFetch<{ version: InstrumentVersionDetail; questions: QuestionDefinition[] }>(`/admin/assessment-instruments/versions/${encodeURIComponent(versionId)}/draft`, { method: 'PUT', body: JSON.stringify({ questions }) });
}

export function apiValidateInstrumentVersion(versionId: string) {
  return apiFetch<{ publishable: boolean; issues: string[] }>(`/admin/assessment-instruments/versions/${encodeURIComponent(versionId)}/validate`, { method: 'POST' });
}

export function apiPublishInstrumentVersion(versionId: string) {
  return apiFetch<{ version: InstrumentVersionDetail; questions: QuestionDefinition[] }>(`/admin/assessment-instruments/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST' });
}

/** The instrument the admin chose to show in the app, or a specific one by code. */
export function apiGetActiveAssessmentInstrument(code?: string) {
  return apiFetch<ActiveAssessmentInstrument>(`/assessment/instrument/active${code ? `?code=${encodeURIComponent(code)}` : ''}`);
}

export function apiSubmitInstrumentAssessment(payload: InstrumentAssessmentSubmission) {
  return apiFetch<InstrumentAssessmentCompletion>('/assessment/instrument/submit', { method: 'POST', body: JSON.stringify(payload) });
}

export function apiGetComparisonAnalytics(dateFrom: string, dateTo: string, facultyIds: string[], academicUnitIds: string[]) {
  const query = [`date_from=${encodeURIComponent(dateFrom)}`, `date_to=${encodeURIComponent(dateTo)}`, repeatedQuery('faculty_id', facultyIds), repeatedQuery('academic_unit_id', academicUnitIds)].filter(Boolean).join('&');
  return apiFetch<ComparisonAnalytics>(`/admin/analytics/comparison?${query}`);
}

export function apiGetMultiCounselorCalendar(dateFrom: string, dateTo: string, counselorIds: string[]) {
  const query = [`date_from=${encodeURIComponent(dateFrom)}`, `date_to=${encodeURIComponent(dateTo)}`, repeatedQuery('counselor_id', counselorIds)].filter(Boolean).join('&');
  return apiFetch<MultiCalendarData>(`/admin/counseling/calendar/multi?${query}`);
}
