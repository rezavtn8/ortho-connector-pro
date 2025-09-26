import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCachedData, useUserProfile, useUserSources, useAnalyticsData } from '@/hooks/useCachedData';
import { platformCache, CACHE_KEYS, CACHE_TAGS } from '@/lib/cacheManager';
import { backgroundSync } from '@/lib/backgroundSync';

export interface UnifiedAIData {
  // Core referral data with locations
  sources: any[];
  monthly_data: any[];
  visits: any[];
  campaigns: any[];
  
  // Additional platform data
  discovered_offices: any[];
  reviews: any[];
  campaign_deliveries: any[];
  ai_usage_history: any[];
  ai_templates: any[];
  ai_content: any[];
  user_profile: any;
  clinic_info: any;
  recent_activities: any[];
  business_profile: any;
  
  // Computed analytics
  analytics: {
    total_sources: number;
    total_referrals: number;
    active_sources_this_month: number;
    source_types_distribution: Record<string, number>;
    recent_visits: number;
    last_6_months_trend: any[];
    discovered_offices_count: number;
    imported_offices: number;
    pending_reviews: number;
    campaign_delivery_success_rate: number;
    ai_usage_last_30_days: number;
  };
}

export function useUnifiedAIData() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Use cached data hooks for different data types
  const { data: userProfileData, isLoading: profileLoading } = useUserProfile();
  const { data: sourcesData, isLoading: sourcesLoading } = useUserSources();
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsData();

  // Additional data with individual caching
  const { data: campaignsData, isLoading: campaignsLoading } = useCachedData({
    cacheKey: CACHE_KEYS.CAMPAIGNS(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;
      const { data } = await supabase.from('campaigns').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(25);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    tags: [CACHE_TAGS.CAMPAIGNS, CACHE_TAGS.USER_DATA],
    priority: 'medium'
  });

  const { data: discoveredOffices, isLoading: discoveredLoading } = useCachedData({
    cacheKey: `discovered_offices_${user?.id || ''}`,
    fetcher: async () => {
      if (!user) return null;
      const { data } = await supabase.from('discovered_offices').select('*').eq('discovered_by', user.id).limit(50);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    tags: [CACHE_TAGS.USER_DATA],
    priority: 'low'
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useCachedData({
    cacheKey: `reviews_${user?.id || ''}`,
    fetcher: async () => {
      if (!user) return null;
      const { data } = await supabase.from('review_status').select('*').eq('user_id', user.id).limit(25);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    tags: [CACHE_TAGS.USER_DATA],
    priority: 'medium'
  });

  const { data: aiUsageData, isLoading: usageLoading } = useCachedData({
    cacheKey: CACHE_KEYS.AI_USAGE(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;
      const { data } = await supabase.from('ai_usage_tracking').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    tags: [CACHE_TAGS.AI_CONTENT, CACHE_TAGS.USER_DATA],
    priority: 'low'
  });

  const { data: businessProfile, isLoading: businessLoading } = useCachedData({
    cacheKey: CACHE_KEYS.BUSINESS_PROFILE(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;
      const { data } = await supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    staleTime: 15 * 60 * 1000,
    tags: [CACHE_TAGS.USER_DATA],
    priority: 'medium'
  });

  // Compute loading state
  const loading = profileLoading || sourcesLoading || analyticsLoading || 
                  campaignsLoading || discoveredLoading || reviewsLoading || 
                  usageLoading || businessLoading;

  // Setup background sync when user is available
  useEffect(() => {
    if (user) {
      backgroundSync.setupUserSync(user.id);
      backgroundSync.start();
    }

    return () => {
      if (user) {
        backgroundSync.clearUserSync(user.id);
      }
    };
  }, [user]);

  // Memoized unified data computation
  const data = useMemo((): UnifiedAIData | null => {
    if (!user) return null;

    // Return data even if some parts are still loading (progressive loading)
    const sources = sourcesData || [];
    const monthlyData = analyticsData?.monthly_data || [];
    const visits = analyticsData?.visits || [];
    const campaigns = campaignsData || [];
    const discovered_offices = discoveredOffices || [];
    const reviews = reviewsData || [];
    const ai_usage_history = aiUsageData || [];
    const user_profile = userProfileData?.userProfile;
    const clinic_info = userProfileData?.clinic;

    // Compute analytics with available data
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return {
      sources,
      monthly_data: monthlyData,
      visits,
      campaigns,
      discovered_offices,
      reviews,
      campaign_deliveries: [], // Legacy field
      ai_usage_history,
      ai_templates: [], // Legacy field  
      ai_content: [], // Legacy field
      user_profile,
      clinic_info,
      recent_activities: [], // Legacy field
      business_profile: businessProfile,
      analytics: {
        total_sources: sources.length,
        total_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
        active_sources_this_month: monthlyData.filter(m => 
          m.year_month === currentMonth && m.patient_count > 0
        ).length,
        source_types_distribution: sources.reduce((acc, s) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recent_visits: visits.filter(v => {
          const visitDate = new Date(v.visit_date);
          return visitDate >= thirtyDaysAgo;
        }).length,
        last_6_months_trend: monthlyData.filter(m => {
          const monthDate = new Date(m.year_month + '-01');
          return monthDate >= sixMonthsAgo;
        }),
        discovered_offices_count: discovered_offices.length,
        imported_offices: discovered_offices.filter(d => d.imported).length,
        pending_reviews: reviews.filter(r => r.needs_attention).length,
        campaign_delivery_success_rate: campaigns.length > 0 ? 
          Math.round((campaigns.filter(c => c.status === 'Completed').length / campaigns.length) * 100) : 0,
        ai_usage_last_30_days: ai_usage_history.filter(u => {
          const usageDate = new Date(u.created_at);
          return usageDate >= thirtyDaysAgo;
        }).length
      }
    };
  }, [user, sourcesData, analyticsData, campaignsData, discoveredOffices, reviewsData, 
      aiUsageData, userProfileData, businessProfile]);

  // Legacy fetchAllData function for backward compatibility
  const fetchAllData = useCallback(async (): Promise<UnifiedAIData | null> => {
    // This function is now just a cache refresh trigger
    if (!user) return null;

    try {
      // Invalidate all cached data to force refresh
      await Promise.all([
        platformCache.invalidateByTags([CACHE_TAGS.USER_DATA]),
        platformCache.invalidateByTags([CACHE_TAGS.SOURCES]),
        platformCache.invalidateByTags([CACHE_TAGS.ANALYTICS])
      ]);

      // The hooks will automatically refetch fresh data
      return data;
    } catch (error: any) {
      console.error('Error refreshing unified data:', error);
      setError(error.message || 'Failed to refresh data');
      return null;
    }
  }, [user, data]);

  // Refresh function for manual refresh
  const refresh = useCallback(async () => {
    return await fetchAllData();
  }, [fetchAllData]);

  return {
    data,
    loading,
    error,
    fetchAllData,
    refresh
  };
}