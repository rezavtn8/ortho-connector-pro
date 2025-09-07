// src/lib/database.types.ts

// IMPORTANT: Export the source type as a type to match database enum
export type SourceType = 
  | 'Office'
  | 'Google'
  | 'Yelp'
  | 'Website'
  | 'Word of Mouth'
  | 'Insurance'
  | 'Social Media'
  | 'Other';

// IMPORTANT: Export SOURCE_TYPE_CONFIG constant to match database enum values
export const SOURCE_TYPE_CONFIG = {
  Office: {
    label: 'Office',
    icon: '🏢',
    color: 'blue'
  },
  Google: {
    label: 'Google',
    icon: '🔍',
    color: 'green'
  },
  Yelp: {
    label: 'Yelp',
    icon: '⭐',
    color: 'yellow'
  },
  Website: {
    label: 'Website',
    icon: '🌐',
    color: 'cyan'
  },
  'Word of Mouth': {
    label: 'Word of Mouth',
    icon: '💬',
    color: 'pink'
  },
  Insurance: {
    label: 'Insurance',
    icon: '📋',
    color: 'purple'
  },
  'Social Media': {
    label: 'Social Media',
    icon: '📱',
    color: 'indigo'
  },
  Other: {
    label: 'Other',
    icon: '📌',
    color: 'gray'
  }
} as const;

// Main database types
export interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_rating?: number | null;
  google_place_id?: string | null;
  opening_hours?: string | null;
  yelp_rating?: number | null;
  distance_miles?: number | null;
  last_updated_from_google?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyPatients {
  id: string;
  source_id: string;
  year_month: string; // Format: 'YYYY-MM'
  patient_count: number;
  created_at: string;
  updated_at: string;
}

export interface PatientChangeLog {
  id: string;
  source_id: string;
  year_month: string;
  old_count: number;
  new_count: number;
  change_type: string;
  changed_by?: string | null;
  reason?: string | null;
  changed_at: string;
}

export interface SourceTag {
  id: string;
  source_id: string;
  tag_name: string;
  created_at: string;
  created_by?: string;
}

export interface SourceStatistics {
  id: string;
  name: string;
  source_type: SourceType;
  is_active: boolean;
  total_patients: number;
  current_month_patients: number;
  last_month_patients: number;
  last_updated?: string | null;
}

// User Profile (keeping existing)
export interface UserProfile {
  id: string;
  user_id?: string | null;
  email: string;
  role: string;
  pin_code?: string | null;
  clinic_name?: string | null;
  clinic_address?: string | null;
  clinic_latitude?: number | null;
  clinic_longitude?: number | null;
  created_at: string;
  updated_at: string;
}

// Helper types for the UI
export interface SourceWithStats extends PatientSource {
  tags: SourceTag[];
  statistics?: SourceStatistics;
  monthlyData?: MonthlyPatients[];
}

// Utility function to get current year-month
export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

// Utility function to format year-month for display
export function formatYearMonth(yearMonth: string | undefined | null): string {
  if (!yearMonth || typeof yearMonth !== 'string') {
    return 'Invalid Date';
  }
  
  const [year, month] = yearMonth.split('-');
  if (!year || !month) {
    return 'Invalid Date';
  }
  
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}