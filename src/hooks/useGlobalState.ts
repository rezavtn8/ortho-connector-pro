import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryKeys, cacheUtils } from '@/lib/queryClient';
import { errorHandler } from '@/utils/errorHandler';

/**
 * Centralized hooks for managing global application state
 */

// User Profile Hook
export function useUserProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Keep fresh for 10 minutes
  });
}

// User Profile Mutation
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: any) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(queryKeys.userProfile, data);
      cacheUtils.invalidateUserData();
    },
    onError: (error) => {
      errorHandler.handleError(error, {
        component: 'useUpdateUserProfile',
        action: 'update_profile'
      });
    }
  });
}

// Global Sources Hook (cached and optimized)
export function useGlobalSources() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('patient_sources')
        .select(`
          *,
          monthly_patients(*)
        `)
        .eq('created_by', user.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000, // Refresh every 3 minutes
  });
}

// Optimized Dashboard Data Hook
export function useGlobalDashboardData() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.dashboardData,
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      // Single optimized query for all dashboard data
      const [sourcesResult, monthlyDataResult, visitsResult] = await Promise.all([
        supabase
          .from('patient_sources')
          .select('id, name, source_type, is_active, created_at')
          .eq('created_by', user.id)
          .eq('is_active', true),
        
        supabase
          .from('monthly_patients')
          .select('*, patient_sources(name, source_type)')
          .eq('user_id', user.id)
          .gte('year_month', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7)),
        
        supabase
          .from('marketing_visits')
          .select('*')
          .eq('user_id', user.id)
          .gte('visit_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          .limit(10)
      ]);
      
      if (sourcesResult.error) throw sourcesResult.error;
      if (monthlyDataResult.error) throw monthlyDataResult.error;
      if (visitsResult.error) throw visitsResult.error;
      
      return {
        sources: sourcesResult.data,
        monthlyData: monthlyDataResult.data,
        recentVisits: visitsResult.data,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // Refresh every 2 minutes for dashboard
  });
}

// Campaigns Hook with caching
export function useGlobalCampaigns() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_deliveries(*)
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Campaigns don't change frequently
  });
}

// AI Usage Tracking Hook
export function useAIUsageStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.aiUsage,
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('ai_usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // AI usage stats can be cached longer
  });
}

// Invalidation helpers
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    invalidateUserData: cacheUtils.invalidateUserData,
    invalidateDashboard: cacheUtils.invalidateDashboard,
    invalidateSources: cacheUtils.invalidateSources,
    invalidateCampaigns: cacheUtils.invalidateCampaigns,
    clearAll: cacheUtils.clearAll,
  };
}