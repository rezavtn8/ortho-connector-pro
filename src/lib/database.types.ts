export interface ReferringOffice {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  google_rating?: number | null;
  yelp_rating?: number | null;
  office_hours?: string | null;
  distance_from_clinic?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  source: string; // Will be constrained by database but TypeScript sees it as string
  created_at: string;
  updated_at: string;
}

export interface OfficeTag {
  id: string;
  office_id: string;
  tag: string;
  created_at: string;
}

export interface ReferralData {
  id: string;
  office_id: string;
  month_year: string;
  referral_count: number;
  created_at: string;
  updated_at: string;
}

export interface EngagementLog {
  id: string;
  office_id: string;
  interaction_type: string; // Will be constrained by database but TypeScript sees it as string
  notes?: string | null;
  interaction_date: string;
  created_by?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id?: string | null;
  email: string;
  role: string; // Will be constrained by database but TypeScript sees it as string
  pin_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type OfficeScore = 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';