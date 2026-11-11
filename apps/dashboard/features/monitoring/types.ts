import type { AssessmentCategoryResult } from '@/features/overview/types';

export type CaseType = 'all' | 'assessment' | 'safety' | 'request';
export type ReviewFilter = 'all' | 'unreviewed' | 'reviewed';
export type ReviewState = 'unreviewed' | 'reviewed';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type RiskFilter = 'all' | RiskLevel;
export type DatePreset = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface Faculty {
  faculty_id: string;
  code: string | null;
  name: string;
  active: boolean;
}

export interface AcademicUnit {
  academic_unit_id: string;
  faculty_id: string;
  faculty_name: string;
  code: string | null;
  name: string;
  unit_type: 'department' | 'study_program';
  active: boolean;
}

export interface AcademicStructure {
  faculties: Faculty[];
  academicUnits: AcademicUnit[];
}

export interface MonitoringCase {
  id: string;
  sourceId: string;
  type: Exclude<CaseType, 'all'>;
  studentId: string | null;
  studentName: string | null;
  nim: string | null;
  facultyName: string | null;
  academicUnitName: string | null;
  facultyId: string | null;
  academicUnitId: string | null;
  createdAt: string | null;
  reviewState: ReviewState;
  risk: RiskLevel;
  backendSeverity: string | null;
  categoryResults: AssessmentCategoryResult[];
}

export interface MonitoringFilters {
  type: CaseType;
  search: string;
  review: ReviewFilter;
  risk: RiskFilter;
  preset: DatePreset;
  dateFrom: string;
  dateTo: string;
  facultyIds: string[];
  academicUnitIds: string[];
}
