import { useResilientQuery } from './useResilientQuery';
import { supabase } from '@/integrations/supabase/client';

export function usePatientSources() {
  return useResilientQuery({
    queryKey: ['patient-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing patient sources...'
  });
}

export function usePatientSourcesWithMonthlyData() {
  return useResilientQuery({
    queryKey: ['patient-sources-with-monthly'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_sources')
        .select(`
          *,
          monthly_patients(*)
        `)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing sources data...'
  });
}