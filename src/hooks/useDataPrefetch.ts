/**
 * Data prefetching hook for anticipated user actions
 */

import { useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { platformCache, userCache, CACHE_KEYS, CACHE_TAGS } from '@/lib/cacheManager';

export function useDataPrefetch() {
  const { user } = useAuth();

  const prefetchCampaigns = useCallback(async () => {
    if (!user) return;

    const cacheKey = CACHE_KEYS.CAMPAIGNS(user.id);
    const cached = await platformCache.get(cacheKey);
    
    if (!cached) {
      console.log('Prefetching campaigns data');
      
      try {
        const { data } = await supabase
          .from('campaigns')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (data) {
          await platformCache.set(cacheKey, data, {
            ttl: 5 * 60 * 1000, // 5 minutes
            tags: [CACHE_TAGS.CAMPAIGNS, CACHE_TAGS.USER_DATA]
          });
        }
      } catch (error) {
        console.error('Failed to prefetch campaigns:', error);
      }
    }
  }, [user]);

  const prefetchAIUsage = useCallback(async () => {
    if (!user) return;

    const cacheKey = CACHE_KEYS.AI_USAGE(user.id);
    const cached = await platformCache.get(cacheKey);
    
    if (!cached) {
      console.log('Prefetching AI usage data');
      
      try {
        const { data } = await supabase
          .from('ai_usage_tracking')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (data) {
          await platformCache.set(cacheKey, data, {
            ttl: 5 * 60 * 1000, // 5 minutes
            tags: [CACHE_TAGS.AI_CONTENT, CACHE_TAGS.USER_DATA]
          });
        }
      } catch (error) {
        console.error('Failed to prefetch AI usage:', error);
      }
    }
  }, [user]);

  const prefetchBusinessProfile = useCallback(async () => {
    if (!user) return;

    const cacheKey = CACHE_KEYS.BUSINESS_PROFILE(user.id);
    const cached = await userCache.get(cacheKey);
    
    if (!cached) {
      console.log('Prefetching business profile');
      
      try {
        const { data } = await supabase
          .from('ai_business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          await userCache.set(cacheKey, data, {
            ttl: 15 * 60 * 1000, // 15 minutes
            tags: [CACHE_TAGS.USER_DATA]
          });
        }
      } catch (error) {
        console.error('Failed to prefetch business profile:', error);
      }
    }
  }, [user]);

  // Prefetch data based on user behavior patterns
  const smartPrefetch = useCallback(async () => {
    if (!user) return;

    // Always prefetch critical data
    await Promise.allSettled([
      prefetchBusinessProfile(),
      prefetchAIUsage()
    ]);

    // Prefetch campaigns with slight delay to not overload
    setTimeout(prefetchCampaigns, 2000);
  }, [user, prefetchBusinessProfile, prefetchAIUsage, prefetchCampaigns]);

  // Prefetch on mount and when user changes
  useEffect(() => {
    if (user) {
      smartPrefetch();
    }
  }, [user, smartPrefetch]);

  // Prefetch when user hovers over navigation items
  const prefetchOnHover = useCallback((route: string) => {
    if (!user) return;

    switch (route) {
      case '/campaigns':
        prefetchCampaigns();
        break;
      case '/ai-assistant':
        prefetchAIUsage();
        prefetchBusinessProfile();
        break;
      default:
        break;
    }
  }, [user, prefetchCampaigns, prefetchAIUsage, prefetchBusinessProfile]);

  // Prefetch when network becomes available
  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        smartPrefetch();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, smartPrefetch]);

  return {
    prefetchCampaigns,
    prefetchAIUsage,
    prefetchBusinessProfile,
    prefetchOnHover,
    smartPrefetch
  };
}