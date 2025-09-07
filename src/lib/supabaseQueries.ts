// Utility functions for common Supabase queries with React Query integration
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';

// Background sync for critical data
export function startBackgroundSync() {
  // Set up real-time subscriptions for automatic cache invalidation
  const sourcesChannel = supabase
    .channel('sources-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'patient_sources'
      },
      (payload) => {
        console.log('Sources change detected:', payload);
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['sources'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['offices'] });
      }
    )
    .subscribe();

  const monthlyChannel = supabase
    .channel('monthly-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'monthly_patients'
      },
      (payload) => {
        console.log('Monthly data change detected:', payload);
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['monthly-patients'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    )
    .subscribe();

  const visitsChannel = supabase
    .channel('visits-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'marketing_visits'
      },
      (payload) => {
        console.log('Marketing visits change detected:', payload);
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['marketing-visits'] });
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(sourcesChannel);
    supabase.removeChannel(monthlyChannel);
    supabase.removeChannel(visitsChannel);
  };
}

// Prefetch critical data on app start
export async function prefetchCriticalData() {
  // Prefetch dashboard data
  queryClient.prefetchQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_data');
      if (error) throw error;
      return data?.[0]?.summary || null;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Prefetch monthly patients data
  queryClient.prefetchQuery({
    queryKey: ['monthly-patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_patients')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}