import { useResilientQuery } from './useResilientQuery';
import { supabase } from '@/integrations/supabase/client';

export function useMarketingVisits() {
  return useResilientQuery({
    queryKey: ['marketing-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_visits')
        .select(`
          *,
          patient_sources!marketing_visits_office_id_fkey(name, address)
        `)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing marketing visits...'
  });
}