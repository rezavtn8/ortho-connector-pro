import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { now } from '@/lib/dateSync';
import { fetchAllRows } from '@/lib/supabasePaging';
import {
  buildMonthlySeries,
  deriveOfficeMetrics,
  type MonthlyRow,
} from '@/lib/officeMetrics';

export interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  category: 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastActiveMonth?: string | null;
  google_rating?: number | null;
  website?: string | null;
  email?: string | null;
  notes?: string | null;
  l12?: number;
  r3?: number;
  mslr?: number;
  tier?: string;
  percentile?: number | null;
}

export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async (): Promise<Office[]> => {
      const { data: sources, error } = await supabase
        .from('patient_sources')
        .select('id, name, address, phone, latitude, longitude, email, website, notes, google_rating')
        .eq('is_active', true)
        .eq('source_type', 'Office');

      if (error) throw error;

      const sourceIds = (sources ?? []).map((s) => s.id);
      if (sourceIds.length === 0) return [];

      // Paged: 42+ offices over 24 months exceeds PostgREST's silent 1000-row cap,
      // which would under-report lifetime totals and mis-rank every tier.
      const monthlyRows = await fetchAllRows<MonthlyRow>(() =>
        supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .in('source_id', sourceIds),
      );

      return deriveOfficeMetrics(sources ?? [], buildMonthlySeries(monthlyRows), now());
    },
    staleTime: 0, // Always consider data stale for immediate sync
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

export function useOfficesWithSearch(searchTerm: string) {
  const { data: offices, ...rest } = useOffices();
  
  const filteredOffices = offices?.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  return {
    data: filteredOffices,
    ...rest
  };
}