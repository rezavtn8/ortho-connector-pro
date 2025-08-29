// src/lib/database.types.ts

// IMPORTANT: Export the source type as a type
export type SourceType = 
  | 'dental_office'
  | 'medical_office'
  | 'insurance'
  | 'online'
  | 'referral_program'
  | 'other';

// IMPORTANT: Export SOURCE_TYPE_CONFIG constant
export const SOURCE_TYPE_CONFIG = {
  dental_office: {
    label: 'Dental Office',
    icon: '🦷',
    color: 'blue'
  },
  medical_office: {
    label: 'Medical Office',
    icon: '⚕️',
    color: 'green'
  },
  insurance: {
    label: 'Insurance',
    icon: '📋',
    color: 'purple'
  },
  online: {
    label: 'Online',
    icon: '🌐',
    color: 'cyan'
  },
  referral_program: {
    label: 'Referral Program',
    icon: '🤝',
    color: 'orange'
  },
  other: {
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
  change_amount: number; // Can be positive or negative
  changed_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SourceTag {
  id: string;
  source_id: string;
  tag: string;
  created_at: string;
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
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}