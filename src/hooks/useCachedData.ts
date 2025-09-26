/**
 * Intelligent data fetching hook with cache-first strategy and background refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { platformCache, userCache, analyticsCache, CACHE_KEYS, CACHE_TAGS } from '@/lib/cacheManager';
import { backgroundSync } from '@/lib/backgroundSync';

interface UseCachedDataOptions {
  cacheKey: string;
  fetcher: () => Promise<any>;
  staleTime?: number; // Time before data is considered stale (still usable)
  cacheTime?: number; // Time before data is removed from cache
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  background?: boolean; // Whether to refresh in background
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
}

interface CachedDataState<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  lastFetch: number | null;
  isBackground: boolean;
}

// Global request deduplication and batching
const inFlightRequests = new Map<string, Promise<any>>();
const requestQueue = new Map<string, Array<{ resolve: Function; reject: Function }>>();
const batchTimeout = new Map<string, NodeJS.Timeout>();

export function useCachedData<T = any>(options: UseCachedDataOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<CachedDataState<T>>({
    data: null,
    isLoading: true,
    isStale: false,
    error: null,
    lastFetch: null,
    isBackground: false
  });

  const {
    cacheKey,
    fetcher,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    background = true,
    tags = [],
    priority = 'medium'
  } = options;

  // Get appropriate cache instance based on tags
  const getCacheInstance = () => {
    if (tags.includes(CACHE_TAGS.USER_DATA)) return userCache;
    if (tags.includes(CACHE_TAGS.ANALYTICS)) return analyticsCache;
    return platformCache;
  };

  const fetchData = useCallback(async (isBackgroundRefresh = false): Promise<T | null> => {
    if (!user) return null;

    setState(prev => ({
      ...prev,
      isLoading: !isBackgroundRefresh,
      isBackground: isBackgroundRefresh,
      error: null
    }));

    try {
      const cache = getCacheInstance();
      
      // First, try to get from cache
      const cachedData = await cache.get<T>(cacheKey);
      const now = Date.now();

      if (cachedData && !isBackgroundRefresh) {
        // We have cached data, return it immediately
        setState(prev => ({
          ...prev,
          data: cachedData,
          isLoading: false,
          isStale: false,
          lastFetch: now,
          isBackground: false
        }));

        // Check if data is stale and needs background refresh
        const cacheEntry = await cache.get<{ timestamp: number; userId: string }>(`${cacheKey}_meta`);
        const cacheTime = cacheEntry?.timestamp || 0;
        const isStale = now - cacheTime > staleTime;

        if (isStale && background) {
          // Fetch fresh data in background
          setTimeout(() => {
            fetchData(true).catch(console.error);
          }, 100);
        }

        return cachedData;
      }

      // Advanced request batching and deduplication
      let fetchPromise = inFlightRequests.get(cacheKey);
      if (!fetchPromise) {
        // Batch similar requests together
        const batchKey = cacheKey.split('_')[0]; // Group by type
        
        if (!requestQueue.has(batchKey)) {
          requestQueue.set(batchKey, []);
        }
        
        // Return a promise that will be resolved when batch executes
        fetchPromise = new Promise((resolve, reject) => {
          requestQueue.get(batchKey)!.push({ resolve, reject });
          
          // Clear existing batch timeout
          if (batchTimeout.has(batchKey)) {
            clearTimeout(batchTimeout.get(batchKey)!);
          }
          
          // Set new batch timeout (micro-batching)
          batchTimeout.set(batchKey, setTimeout(async () => {
            const requests = requestQueue.get(batchKey) || [];
            requestQueue.delete(batchKey);
            batchTimeout.delete(batchKey);
            
            try {
              const result = await fetcher();
              requests.forEach(req => req.resolve(result));
            } catch (error) {
              requests.forEach(req => req.reject(error));
            }
          }, 10)); // 10ms batching window
        });
        
        inFlightRequests.set(cacheKey, fetchPromise);
      }

      let freshData: any = null;
      try {
        freshData = await fetchPromise;
      } finally {
        // Ensure we clear in-flight map only for the original promise
        const current = inFlightRequests.get(cacheKey);
        if (current === fetchPromise) inFlightRequests.delete(cacheKey);
      }

      if (freshData) {
        // Cache the new data
        await cache.set(cacheKey, freshData, {
          ttl: cacheTime,
          tags,
          version: '1.0.0'
        });

        // Cache metadata about fetch time
        await cache.set(`${cacheKey}_meta`, {
          timestamp: now,
          userId: user.id
        }, {
          ttl: cacheTime
        });

        setState(prev => ({
          ...prev,
          data: freshData,
          isLoading: false,
          isStale: false,
          error: null,
          lastFetch: now,
          isBackground: isBackgroundRefresh
        }));

        return freshData;
      }

      return null;

    } catch (error: any) {
      console.error(`Error fetching data for ${cacheKey}:`, error);

      // If we have cached data, use it even if stale
      const cache = getCacheInstance();
      const fallbackData = await cache.get<T>(cacheKey);

      setState(prev => ({
        ...prev,
        data: fallbackData,
        isLoading: false,
        isStale: !!fallbackData,
        error: error.message || 'Failed to fetch data',
        isBackground: isBackgroundRefresh
      }));

      return fallbackData;
    }
  }, [user, cacheKey, fetcher, staleTime, cacheTime, background, tags]);

  const invalidateCache = useCallback(async () => {
    const cache = getCacheInstance();
    await cache.delete(cacheKey);
    await cache.delete(`${cacheKey}_meta`);
    
    // If we have tags, also invalidate related data
    if (tags.length > 0) {
      await cache.invalidateByTags(tags);
    }
  }, [cacheKey, tags]);

  const refetch = useCallback(async (force = false) => {
    if (force) {
      await invalidateCache();
    }
    return await fetchData(false);
  }, [fetchData, invalidateCache]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchData(false);
    }
  }, [user, fetchData]);

  // Set up background sync for this data
  useEffect(() => {
    if (user && background && priority === 'high') {
      backgroundSync.scheduleSync({
        id: cacheKey,
        userId: user.id,
        type: 'incremental',
        priority,
        interval: staleTime,
        data: { cacheKey, tags }
      });
    }

    return () => {
      if (user) {
        // Cleanup if needed
      }
    };
  }, [user, cacheKey, background, priority, staleTime, tags]);

  // Handle window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      // Only refetch if data is stale
      const timeSinceLastFetch = state.lastFetch ? Date.now() - state.lastFetch : Infinity;
      if (timeSinceLastFetch > staleTime) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, staleTime, state.lastFetch, fetchData]);

  // Handle network reconnection
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      fetchData(false);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, fetchData]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    isStale: state.isStale,
    error: state.error,
    refetch,
    invalidate: invalidateCache,
    lastFetch: state.lastFetch,
    isBackground: state.isBackground
  };
}

// Specialized hooks for common data patterns
export function useUserProfile() {
  const { user } = useAuth();

  return useCachedData({
    cacheKey: CACHE_KEYS.USER_PROFILE(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;

      const [userProfileResult, clinicResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('clinics').select('*').eq('owner_id', user.id).maybeSingle()
      ]);

      return {
        userProfile: userProfileResult.data,
        clinic: clinicResult.data
      };
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    tags: [CACHE_TAGS.USER_DATA],
    priority: 'medium'
  });
}

export function useUserSources() {
  const { user } = useAuth();

  return useCachedData({
    cacheKey: CACHE_KEYS.USER_SOURCES(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('patient_sources')
        .select('id,name,source_type,is_active,created_by,updated_at')
        .eq('created_by', user.id)
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    tags: [CACHE_TAGS.SOURCES, CACHE_TAGS.USER_DATA],
    priority: 'high'
  });
}

export function useAnalyticsData() {
  const { user } = useAuth();

  return useCachedData({
    cacheKey: CACHE_KEYS.MONTHLY_DATA(user?.id || ''),
    fetcher: async () => {
      if (!user) return null;

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [monthlyResult, visitsResult] = await Promise.all([
        supabase.from('monthly_patients')
          .select('id,source_id,year_month,patient_count,updated_at,user_id')
          .eq('user_id', user.id)
          .gte('year_month', sixMonthsAgo.toISOString().substring(0, 7))
          .limit(50),
        supabase.from('marketing_visits')
          .select('id,visit_date,source_id,notes,created_at,updated_at,user_id')
          .eq('user_id', user.id)
          .gte('visit_date', sixMonthsAgo.toISOString().split('T')[0])
          .limit(50)
      ]);

      return {
        monthly_data: monthlyResult.data || [],
        visits: visitsResult.data || []
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    tags: [CACHE_TAGS.ANALYTICS, CACHE_TAGS.USER_DATA],
    priority: 'medium'
  });
}