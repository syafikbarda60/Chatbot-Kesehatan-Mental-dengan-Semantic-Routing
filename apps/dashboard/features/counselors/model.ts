import { JAKARTA_TIME_ZONE } from '../counseling/model.ts';
import type { Appointment, AvailabilityPayload, AvailabilityRule, Counselor, CounselorStatusFilter, SchedulePlan, ScheduleWindow } from './types';

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function timeValue(value: string): string {
  return value.slice(0, 5);
}

function dayRank(day: number): number {
  const index = WEEKDAY_ORDER.indexOf(day as (typeof WEEKDAY_ORDER)[number]);
  return index < 0 ? WEEKDAY_ORDER.length : index;
}

export function normalizeCounselors(response: { counselors: Counselor[] }): Counselor[] {
  return response.counselors.map(({ user_id, name, email, title, specialization, active }) => ({ user_id, name, email, title, specialization, active }));
}

export function counselorInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'K';
}

export function normalizeSchedule(rules: AvailabilityRule[], counselorId: string): ScheduleWindow[] {
  return rules.filter((rule) => rule.counselor_id === counselorId && rule.active).map((rule) => ({
    key: rule.counselor_availability_rule_id,
    ruleId: rule.counselor_availability_rule_id,
    dayOfWeek: rule.day_of_week,
    startTime: timeValue(rule.start_time),
    endTime: timeValue(rule.end_time),
    effectiveFrom: rule.effective_from ?? '',
    effectiveTo: rule.effective_to ?? '',
  })).sort((a, b) => dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));
}

export function windowsForDay(windows: ScheduleWindow[], day: number): ScheduleWindow[] {
  return windows.filter((window) => window.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function addScheduleWindow(windows: ScheduleWindow[], dayOfWeek: number, key: string): ScheduleWindow[] {
  return [...windows, { key, ruleId: null, dayOfWeek, startTime: '09:00', endTime: '12:00', effectiveFrom: '', effectiveTo: '' }];
}

export function removeScheduleWindow(windows: ScheduleWindow[], key: string): ScheduleWindow[] {
  return windows.filter((window) => window.key !== key);
}

export type ScheduleValidation = 'required' | 'range' | 'effectiveDates' | 'duplicate' | 'overlap' | null;

export function validateSchedule(windows: ScheduleWindow[]): ScheduleValidation {
  for (const window of windows) {
    if (!/^\d{2}:\d{2}$/.test(window.startTime) || !/^\d{2}:\d{2}$/.test(window.endTime)) return 'required';
    if (window.endTime <= window.startTime) return 'range';
    if (window.effectiveFrom && window.effectiveTo && window.effectiveTo < window.effectiveFrom) return 'effectiveDates';
  }
  for (let left = 0; left < windows.length; left += 1) {
    for (let right = left + 1; right < windows.length; right += 1) {
      const a = windows[left]; const b = windows[right];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.startTime === b.startTime && a.endTime === b.endTime && a.effectiveFrom === b.effectiveFrom && a.effectiveTo === b.effectiveTo) return 'duplicate';
      if (a.startTime < b.endTime && a.endTime > b.startTime) return 'overlap';
    }
  }
  return null;
}

function windowSignature(window: ScheduleWindow): string {
  return [window.dayOfWeek, window.startTime, window.endTime, window.effectiveFrom, window.effectiveTo].join('|');
}

export function scheduleSignature(windows: ScheduleWindow[]): string {
  return [...windows].sort((a, b) => a.key.localeCompare(b.key)).map((window) => `${window.ruleId ?? 'new'}:${windowSignature(window)}`).join(';');
}

export function buildSchedulePlan(counselorId: string, original: ScheduleWindow[], draft: ScheduleWindow[]): SchedulePlan {
  const originalById = new Map(original.filter((window) => window.ruleId).map((window) => [window.ruleId as string, window]));
  const unchangedIds = new Set(draft.filter((window) => window.ruleId && windowSignature(window) === windowSignature(originalById.get(window.ruleId) ?? window)).map((window) => window.ruleId as string));
  const deactivateRuleIds = original.filter((window) => window.ruleId && !unchangedIds.has(window.ruleId)).map((window) => window.ruleId as string);
  const create: AvailabilityPayload[] = draft.filter((window) => !window.ruleId || !unchangedIds.has(window.ruleId)).map((window) => ({
    counselor_id: counselorId,
    day_of_week: window.dayOfWeek,
    start_time: window.startTime,
    end_time: window.endTime,
    timezone: JAKARTA_TIME_ZONE,
    effective_from: window.effectiveFrom || null,
    effective_to: window.effectiveTo || null,
    active: true,
  }));
  return { deactivateRuleIds, create };
}

export function filterCounselors(counselors: Counselor[], search: string, status: CounselorStatusFilter, specialization: string): Counselor[] {
  const term = search.trim().toLocaleLowerCase();
  return counselors.filter((counselor) => (!term || counselor.name.toLocaleLowerCase().includes(term) || counselor.email?.toLocaleLowerCase().includes(term))
    && (status === 'all' || (status === 'active' ? counselor.active : !counselor.active))
    && (!specialization || counselor.specialization === specialization));
}

export function upcomingAppointments(appointments: Appointment[], now: Date, limit = 5): Appointment[] {
  return appointments.filter((appointment) => ['confirmed', 'rescheduled'].includes(appointment.status) && Date.parse(appointment.ends_at) > now.getTime())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, limit);
}
