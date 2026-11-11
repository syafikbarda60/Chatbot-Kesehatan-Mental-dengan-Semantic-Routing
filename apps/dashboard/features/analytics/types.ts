export type ComparisonMode = 'faculty' | 'academic_unit';
export type Severity = 'minimal' | 'mild' | 'moderate' | 'severe' | 'normal' | 'extremely_severe';

export interface AnalyticsFilters {
  dateFrom: string;
  dateTo: string;
  preset: '7days' | '30days' | 'custom';
  compareBy: ComparisonMode;
  facultyIds: string[];
  academicUnitIds: string[];
}

export interface ScopeRow { scope_id: string | null; scope_label: string; }
export interface AssessmentTrendRow extends ScopeRow { date: string; assessment_count: number; }
export interface SeverityRow extends ScopeRow { severity: Severity | string; count: number; }
export interface CategoryTrendRow extends ScopeRow { category: string; date: string; score: number; submission_count: number; }
export interface CategorySeverityRow extends ScopeRow { category: string; severity: Severity | string; count: number; }
export interface CounselingRow extends ScopeRow { status: string; count: number; }
export interface AttentionRow extends ScopeRow { signal_type: 'assessment' | 'safety'; count: number; }

export interface AnalyticsResponse {
  mode: 'university' | ComparisonMode;
  date_from: string;
  date_to: string;
  selected_scopes: ScopeRow[];
  assessment_trend: AssessmentTrendRow[];
  severity_distribution: SeverityRow[];
  category_trends: CategoryTrendRow[];
  category_severity_distribution: CategorySeverityRow[];
  counseling_utilization: CounselingRow[];
  attention_counts: AttentionRow[];
}

export type ReportSection = 'summary' | 'assessmentTrend' | 'dimensions' | 'academic' | 'counseling' | 'insights' | 'appendix';
export interface ReportConfiguration {
  version: 1;
  filters: AnalyticsFilters;
  sections: ReportSection[];
  createdAt: string;
}
