import { apiRequest } from '@/lib/api/client';
import type { CounselorCase, CounselorCaseDetail, CounselorWorkspace, ExceptionDraft, ReviewDetail, ReviewQueueItem } from './types';

export const getCounselorCases=(signal?:AbortSignal)=>apiRequest<{cases:CounselorCase[];total:number}>('/counselor/cases',{signal});
export const getCounselorCase=(studentId:string,signal?:AbortSignal)=>apiRequest<CounselorCaseDetail>(`/counselor/cases/${encodeURIComponent(studentId)}`,{signal});
export const getCounselorWorkspace=(dateFrom:string,dateTo:string,signal?:AbortSignal)=>apiRequest<CounselorWorkspace>(`/counselor/calendar?${new URLSearchParams({date_from:dateFrom,date_to:dateTo})}`,{signal});
export const requestException=(body:ExceptionDraft)=>apiRequest<{exception:unknown}>('/counselor/exception-requests',{method:'POST',body});
export const getReviewQueue=(status?:string,signal?:AbortSignal)=>apiRequest<{reviews:ReviewQueueItem[];total:number}>(`/counselor/instrument-reviews${status?`?status=${encodeURIComponent(status)}`:''}`,{signal});
export const getReview=(reviewId:string,signal?:AbortSignal)=>apiRequest<ReviewDetail>(`/counselor/instrument-reviews/${encodeURIComponent(reviewId)}`,{signal});
export const addReviewComment=(reviewId:string,comment:string,questionId?:string|null)=>apiRequest<{comment:unknown}>(`/counselor/instrument-reviews/${encodeURIComponent(reviewId)}/comments`,{method:'POST',body:{comment,assessment_question_id:questionId??null}});
export const decideReview=(reviewId:string,decision:'approve'|'request-revision',revision:number,comment?:string)=>apiRequest<{review:unknown}>(`/counselor/instrument-reviews/${encodeURIComponent(reviewId)}/${decision}`,{method:'POST',body:{expected_revision:revision,comment:comment||null}});
