// src/lib/database.types.ts

// Clean source types for patient tracking platform
export type SourceType = 
  | 'Google'
  | 'Yelp'
  | 'Website'
  | 'Word of Mouth'
  | 'Insurance'
  | 'Social Media'
  | 'Other';

// Source configuration for UI display
export const SOURCE_TYPE_CONFIG = {
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

// Simplified patient source for tracking
export interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
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
  user_id: string;
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

// Simple interface for current month source data
export interface CurrentMonthSource {
  source_id: string;
  source_name: string;
  source_type: SourceType;
  current_month_patients: number;
  month_year: string;
}

// User Profile
export interface UserProfile {
  id: string;
  user_id?: string | null;
  email: string;
  role: string;
  pin_code?: string | null;
  clinic_name?: string | null;
  clinic_address?: string | null;
  created_at: string;
  updated_at: string;
}

// Helper types for the UI
export interface SourceWithMonthlyData extends PatientSource {
  tags: SourceTag[];
  current_month_patients: number;
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
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}