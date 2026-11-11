export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';

export interface Counselor {
  user_id: string;
  name: string;
  email?: string;
  title: string | null;
  specialization: string | null;
  active: boolean;
}

export interface Appointment {
  counseling_appointment_id: string;
  counseling_request_id: string | null;
  student_id: string;
  student_name: string;
  nim: string | null;
  counselor_id: string;
  counselor_name: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  counseling_resource_id?: string | null;
  resource_name?: string | null;
}

export type CounselingResourceType = 'physical' | 'virtual';

export interface CounselingResource {
  counseling_resource_id: string;
  name: string;
  resource_type: CounselingResourceType;
  capacity: number;
  location_or_url: string | null;
  active: boolean;
}

export interface ResourceBlock {
  counseling_resource_block_id: string;
  counseling_resource_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface AvailabilityRule {
  counselor_availability_rule_id: string;
  counselor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
}

export interface BlockedPeriod {
  counselor_blocked_period_id: string;
  counselor_id: string;
  counselor_name: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  source?: 'admin' | 'counselor';
  review_status?: 'pending' | 'approved' | 'rejected';
}

export interface CalendarResponse {
  counselors: Counselor[];
  appointments: Appointment[];
  availability: AvailabilityRule[];
  blocked_periods: BlockedPeriod[];
  resource_blocks?: ResourceBlock[];
  resource_authority_complete?: boolean;
}

export interface CounselingRequest {
  counseling_request_id: string;
  student_id: string;
  status: 'requested' | AppointmentStatus;
  created_at: string;
  name: string;
  nim: string | null;
  faculty_name: string | null;
  academic_unit_name: string | null;
}

export interface RequestResponse {
  requests: CounselingRequest[];
  total: number;
  page: number;
  page_size: number;
}

export interface CounselorsResponse { counselors: Counselor[]; total: number }
export interface ResourcesResponse { resources: CounselingResource[]; total: number }
export interface AppointmentPayload { counselor_id: string; starts_at: string; ends_at: string; counseling_resource_id?: string | null }
export interface BlockedPeriodPayload extends AppointmentPayload { reason?: string }
