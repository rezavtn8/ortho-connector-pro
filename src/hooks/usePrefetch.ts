import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchOfficeDetails = useCallback((officeId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['office', officeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('patient_sources')
          .select(`
            *,
            monthly_patients(*),
            source_tags(*)
          `)
          .eq('id', officeId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  }, [queryClient]);

  const prefetchOfficesList = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['offices'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('patient_sources')
          .select(`
            *,
            monthly_patients(*),
            source_tags(*)
          `)
          .order('name');

        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 2, // 2 minutes
    });
  }, [queryClient]);

  const prefetchDashboardData = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard-data'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_dashboard_data');
        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 1, // 1 minute
    });
  }, [queryClient]);

  const prefetchAnalytics = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['analytics'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('monthly_patients')
          .select(`
            *,
            patient_sources(name, source_type)
          `)
          .order('year_month', { ascending: false });

        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  }, [queryClient]);

  const prefetchCampaigns = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['campaigns'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 3, // 3 minutes
    });
  }, [queryClient]);

  const prefetchMarketingVisits = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['marketing-visits'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('marketing_visits')
          .select(`
            *,
            patient_sources(name, address)
          `)
          .order('visit_date', { ascending: false });

        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 3, // 3 minutes
    });
  }, [queryClient]);

  return {
    prefetchOfficeDetails,
    prefetchOfficesList,
    prefetchDashboardData,
    prefetchAnalytics,
    prefetchCampaigns,
    prefetchMarketingVisits,
  };
}