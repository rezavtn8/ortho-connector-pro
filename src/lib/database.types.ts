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

export interface MarketingIncentive {
  id: string;
  office_id: string;
  incentive_type: string;
  title: string;
  description?: string | null;
  personalized_message?: string | null;
  assigned_staff?: string | null;
  status: 'Planned' | 'Sent' | 'Delivered' | 'Cancelled';
  delivery_method?: 'In-person' | 'Mail' | 'Email' | 'Other' | null;
  scheduled_date?: string | null;
  actual_sent_date?: string | null;
  cost_amount?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id?: string | null;
  email: string;
  role: string; // Will be constrained by database but TypeScript sees it as string
  pin_code?: string | null;
  clinic_name?: string | null;
  clinic_address?: string | null;
  clinic_latitude?: number | null;
  clinic_longitude?: number | null;
  created_at: string;
  updated_at: string;
}

export type OfficeScore = 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';