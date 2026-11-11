export type HotlineStatus = 'active' | 'verification_required' | 'inactive';

export interface HotlineRecord {
  hotline_id: string;
  name: string;
  phone: string;
  description: string | null;
  verification_status?: HotlineStatus | null;
  verified_at?: string | null;
  verified_by?: string | null;
  verification_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  service_type?: string | null;
  operational_hours?: string | null;
  coverage?: string | null;
}

export interface HotlineDraft { name: string; phone: string; description: string; verificationNote: string; serviceType?: string; operationalHours?: string; coverage?: string }
export type HotlinePayload = { name: string; phone: string; description: string | null; verification_note: string | null; verification_status?: HotlineStatus; service_type?: string | null; operational_hours?: string | null; coverage?: string | null };
