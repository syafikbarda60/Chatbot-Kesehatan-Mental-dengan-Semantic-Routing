import type { Appointment, AvailabilityRule, BlockedPeriod, CalendarResponse, Counselor } from '@/features/counseling/types';

export type { Appointment, AvailabilityRule, BlockedPeriod, CalendarResponse, Counselor };

export interface AvailabilityResponse {
  availability: AvailabilityRule[];
  total: number;
}

export interface CounselorProfilePayload {
  title: string | null;
  specialization: string | null;
  active: boolean;
}

export interface AvailabilityPayload {
  counselor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  effective_from: string | null;
  effective_to: string | null;
  active: true;
}

export interface ScheduleWindow {
  key: string;
  ruleId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface SchedulePlan {
  deactivateRuleIds: string[];
  create: AvailabilityPayload[];
}

export type CounselorStatusFilter = 'all' | 'active' | 'inactive';

