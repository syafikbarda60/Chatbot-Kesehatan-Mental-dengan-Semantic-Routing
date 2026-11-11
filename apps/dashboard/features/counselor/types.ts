import type { DimensionDraft, QuestionDraft, ReviewStatus } from '@/features/instruments/types';

export type RiskSummary='critical'|'high'|'medium'|'low'|'unknown';
export interface CounselorCase {counselor_case_assignment_id:string;student_id:string;student_name:string;nim:string|null;faculty_name:string|null;academic_unit_name:string|null;context:string;risk:RiskSummary;assessment_summary:string|null;assessment_at:string|null;last_session_at:string|null;next_session_at:string|null;follow_up_status:'action_required'|'planned'|'complete'}
export interface CaseAssessment {assessment_id:string;instrument:string;taken_at:string;dimensions:Array<{name:string;score:number|null;severity:string}>;severity:string}
export interface CaseSession {counseling_appointment_id:string;starts_at:string;ends_at:string;status:string;service_type:string;resource_name:string|null}
export interface CounselorCaseDetail {case:CounselorCase;support_summary:string|null;assessments:CaseAssessment[];sessions:CaseSession[]}
export interface CounselorAppointment {counseling_appointment_id:string;student_id:string;student_name:string;nim:string|null;starts_at:string;ends_at:string;status:string;service_type:string;resource_name:string|null;resource_type:'physical'|'virtual'|null;conflict?:boolean}
export interface AvailabilityWindow {counselor_availability_rule_id:string;day_of_week:number;start_time:string;end_time:string;effective_from:string|null;effective_to:string|null}
export type ExceptionStatus='pending'|'approved'|'rejected'|'cancelled';
export interface CounselorException {counselor_exception_request_id:string;date:string;starts_at:string;ends_at:string;full_day:boolean;reason:string;note:string|null;status:ExceptionStatus;submitted_at:string;decision_note:string|null;affected_appointments:string[]}
export interface CounselorWorkspace {appointments:CounselorAppointment[];availability:AvailabilityWindow[];exceptions:CounselorException[]}
export interface ReviewQueueItem {assessment_version_review_id:string;instrument_version_id:string;definition_revision:number;current_revision:number;status:ReviewStatus;submitted_at:string;reviewer_user_id:string|null;code:string;name:string;version_number:number;instrument_kind?:'standard'|'custom';submitted_by_name?:string|null;reviewer_name?:string|null}
export interface ReviewComment {review_comment_id:string;assessment_question_id:string|null;author_user_id:string;author_name:string;comment_text:string;created_at:string}
export interface ReviewDetail {review:ReviewQueueItem&{version_status?:string;decision_comment?:string|null;provenance?:Record<string,unknown>};dimensions:DimensionDraft[];questions:QuestionDraft[];comments:ReviewComment[];previous?:{version_number:number;questions:QuestionDraft[];dimensions:DimensionDraft[]}|null}
export interface ExceptionDraft {date:string;full_day:boolean;start_time:string;end_time:string;reason:string;note:string}
