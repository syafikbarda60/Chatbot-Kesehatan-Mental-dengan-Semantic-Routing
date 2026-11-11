import { apiFetch, type UserRow, type LoginResponse } from './api';

export type Role = LoginResponse['user']['role'];
export type Severity = 'minimal' | 'mild' | 'moderate' | 'severe';
export interface Profile extends UserRow { role: Role }
export interface AssessmentRow {
  assessment_id: string; user_id: string; instrument_type: string;
  score: number; severity: Severity; taken_at: string | null; name?: string | null; nim?: string | null;
  instrument_version_id?: string | null;
  category_results?: { category: 'depression' | 'anxiety' | 'stress'; raw_score: number; scaled_score: number; severity: string }[] | null;
}
export interface AssessmentPage { assessments: AssessmentRow[]; total: number; page: number; page_size: number }
export interface BookingHistory {
  counseling_booking_id: string; status: BookingStatus; date: string; start_time: string; end_time: string;
}
export interface BookingPage { bookings: BookingHistory[]; total: number; page: number; page_size: number }
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export interface Schedule {
  counseling_slot_id: string; date: string; start_time: string; end_time: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
}
export interface IncomingBooking {
  counseling_booking_id: string; counseling_slot_id: string; status: BookingStatus; notes: string | null;
  created_at: string; counseling_slots: Omit<Schedule, 'counseling_slot_id' | 'status'> & { counselor_id: string };
}
export interface AccountInput { name: string; email: string; password: string; nim?: string; role: Role }
export type AccountUpdate = Pick<AccountInput, 'name' | 'nim' | 'role'>;
export interface AssessmentFilters {
  search?: string; severity?: string; instrument?: string; date_from?: string; date_to?: string;
  faculty_id?: string | string[]; academic_unit_id?: string | string[]; page?: number;
}
export function apiGetProfile() { return apiFetch<Profile>('/auth/me'); }
export function apiGetAdminAssessments(filters: AssessmentFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value) params.set(key, String(value));
  });
  return apiFetch<AssessmentPage>('/admin/assessments?' + params);
}
export function apiGetUserDetail(id: string) { return apiFetch<{ user: Profile }>('/admin/users/' + encodeURIComponent(id)); }
export function apiGetUserAssessments(id: string, page = 1) {
  return apiFetch<AssessmentPage>('/admin/users/' + encodeURIComponent(id) + '/assessments?page=' + page);
}
export function apiGetUserBookings(id: string, page = 1) {
  return apiFetch<BookingPage>('/admin/users/' + encodeURIComponent(id) + '/bookings?page=' + page);
}
export function apiCreateAccount(data: AccountInput) {
  return apiFetch('/accounts', { method: 'POST', body: JSON.stringify(data) });
}
export function apiUpdateAccount(id: string, data: AccountUpdate) {
  return apiFetch('/accounts/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) });
}
export function apiDeleteAccount(id: string) {
  return apiFetch('/accounts/' + encodeURIComponent(id), { method: 'DELETE' });
}
export function apiGetOwnSchedules() { return apiFetch<{ jadwal: Schedule[] }>('/jadwal/saya'); }
export function apiGetIncomingBookings() { return apiFetch<{ bookings: IncomingBooking[] }>('/booking/masuk'); }
export function apiCreateSchedule(data: Pick<Schedule, 'date' | 'start_time' | 'end_time'>) {
  return apiFetch('/jadwal', { method: 'POST', body: JSON.stringify(data) });
}
export function apiUpdateBooking(id: string, status: BookingStatus) {
  return apiFetch('/booking/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status }) });
}
