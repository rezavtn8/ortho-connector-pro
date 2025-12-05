import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentYearMonth } from '@/lib/dateSync';

export interface DashboardData {
  sources: Array<{
    id: string;
    name: string;
    source_type: string;
    is_active: boolean;
  }>;
  monthlyData: Array<{
    id: string;
    source_id: string;
    year_month: string;
    patient_count: number;
    updated_at: string;
  }>;
  recentActivity: Array<{
    id: string;
    source_id: string;
    year_month: string;
    patient_count: number;
    updated_at: string;
    source_name: string;
    source_type: string;
  }>;
}

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      try {
        // Single optimized query with joins for all dashboard data
        const [sourcesResult, monthlyResult, recentResult] = await Promise.all([
          supabase
            .from('patient_sources')
            .select('id, name, source_type, is_active')
            .order('name'),
          
          supabase
            .from('monthly_patients')
            .select('id, source_id, year_month, patient_count, updated_at'),
          
          supabase
            .from('monthly_patients')
            .select(`
              id,
              source_id,
              year_month,
              patient_count,
              updated_at,
              patient_sources!inner(
                name,
                source_type
              )
            `)
            .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('updated_at', { ascending: false })
            .limit(10)
        ]);

        if (sourcesResult.error) throw sourcesResult.error;
        if (monthlyResult.error) throw monthlyResult.error;
        if (recentResult.error) throw recentResult.error;

        const recentActivity = (recentResult.data || [])
          .filter(item => item.patient_sources) // Filter out items without patient_sources
          .map(item => ({
            ...item,
            source_name: item.patient_sources?.name || 'Unknown',
            source_type: item.patient_sources?.source_type || 'Other'
          }));

        return {
          sources: sourcesResult.data || [],
          monthlyData: monthlyResult.data || [],
          recentActivity
        };
      } catch (error) {
        console.error('Dashboard data error:', error);
        // Return fallback data instead of throwing
        return {
          sources: [],
          monthlyData: [],
          recentActivity: []
        };
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.message?.includes('Authentication') || error?.message?.includes('JWT')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useDashboardStats() {
  const { data } = useDashboardData();
  const currentMonth = getCurrentYearMonth();
  
  // Defensive checks to ensure data structure exists
  if (!data || !data.sources || !data.monthlyData) {
    return {
      totalSources: 0,
      activeSources: 0,
      totalPatients: 0,
      thisMonthPatients: 0
    };
  }
  
  const { sources, monthlyData } = data;
  
  return {
    totalSources: sources.length,
    activeSources: sources.filter(source => source.is_active).length,
    totalPatients: monthlyData.reduce((sum, m) => sum + m.patient_count, 0),
    thisMonthPatients: monthlyData
      .filter(m => m.year_month === currentMonth)
      .reduce((sum, m) => sum + m.patient_count, 0)
  };
}