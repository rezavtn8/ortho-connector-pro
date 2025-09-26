import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const [data, setData] = useState<UnifiedAIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchAllData = useCallback(async (): Promise<UnifiedAIData | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch core data first, then optional data in batches to avoid overwhelming DB
      const eighteenMonthsAgoFilter = new Date();
      eighteenMonthsAgoFilter.setMonth(eighteenMonthsAgoFilter.getMonth() - 18);
      const eighteenMonthsAgoStr = eighteenMonthsAgoFilter.toISOString().substring(0, 7);

      const sixMonthsAgoFilter = new Date();
      sixMonthsAgoFilter.setMonth(sixMonthsAgoFilter.getMonth() - 6);
      const sixMonthsAgoDateStr = sixMonthsAgoFilter.toISOString().split('T')[0];

      // Batch 1: Essential data for AI
      const [sourcesResult, monthlyResult, userProfileResult, clinicResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id).limit(100),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id).gte('year_month', eighteenMonthsAgoStr).limit(50),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('clinics').select('*').eq('owner_id', user.id).maybeSingle()
      ]);

      // Small delay to prevent overwhelming the DB
      await new Promise(resolve => setTimeout(resolve, 100));

      // Batch 2: Recent activity data  
      const [visitsResult, campaignsResult, aiBusinessProfileResult] = await Promise.all([
        supabase.from('marketing_visits').select('*').eq('user_id', user.id).gte('visit_date', sixMonthsAgoDateStr).limit(50),
        supabase.from('campaigns').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(25),
        supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle()
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Batch 3: Additional data (non-blocking)
      const [discoveredResult, reviewsResult, usageResult] = await Promise.all([
        supabase.from('discovered_offices').select('*').eq('discovered_by', user.id).limit(50),
        supabase.from('review_status').select('*').eq('user_id', user.id).limit(25),
        supabase.from('ai_usage_tracking').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25)
      ]);

      // Set defaults for optional data that might fail
      const deliveries: any[] = [];
      const activities: any[] = [];
      const aiTemplates: any[] = [];
      const aiContent: any[] = [];

      // Extract data arrays safely
      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const discoveredOffices = discoveredResult.data || [];
      const reviews = reviewsResult.data || [];
      const aiUsage = usageResult.data || [];
      const userProfile = userProfileResult.data;
      const clinic = clinicResult.data;
      const aiBusinessProfileData = aiBusinessProfileResult.data;

      // Get business profile from AI business context if not available
      let businessProfile = aiBusinessProfileData;
      if (!businessProfile) {
        try {
          const { data: contextData } = await supabase.functions.invoke('ai-business-context', {
            body: { action: 'get' },
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          });
          businessProfile = contextData?.profile || null;
        } catch (e) {
          console.warn('Could not fetch business profile:', e);
        }
      }

      // Compute analytics
      const currentMonth = new Date().toISOString().slice(0, 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const unifiedData: UnifiedAIData = {
        // Core data
        sources,
        monthly_data: monthlyData,
        visits,
        campaigns,
        
        // Additional platform data
        discovered_offices: discoveredOffices,
        reviews,
        campaign_deliveries: deliveries,
        ai_usage_history: aiUsage,
        ai_templates: aiTemplates,
        ai_content: aiContent,
        user_profile: userProfile,
        clinic_info: clinic,
        recent_activities: activities,
        business_profile: businessProfile,

        // Computed analytics
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
          discovered_offices_count: discoveredOffices.length,
          imported_offices: discoveredOffices.filter(d => d.imported).length,
          pending_reviews: reviews.filter(r => r.needs_attention).length,
          campaign_delivery_success_rate: deliveries.length > 0 ? 
            Math.round((deliveries.filter(d => d.delivery_status === 'Completed').length / deliveries.length) * 100) : 0,
          ai_usage_last_30_days: aiUsage.filter(u => {
            const usageDate = new Date(u.created_at);
            return usageDate >= thirtyDaysAgo;
          }).length
        }
      };

      setData(unifiedData);
      return unifiedData;

    } catch (error: any) {
      console.error('Error fetching unified AI data:', error);
      setError(error.message || 'Failed to fetch platform data');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auto-fetch unified data when user is available
  useEffect(() => {
    if (user && !data && !loading) {
      fetchAllData();
    }
  }, [user, data, loading, fetchAllData]);

  return {
    data,
    loading,
    error,
    fetchAllData,
    refresh: fetchAllData
  };
}