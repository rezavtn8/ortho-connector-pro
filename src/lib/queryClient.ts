import { QueryClient } from '@tanstack/react-query';
import { errorHandler } from '@/utils/errorHandler';

// Default query options with error handling and caching
const defaultQueryOptions = {
  queries: {
    // Cache for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 10 minutes after it becomes unused
    gcTime: 10 * 60 * 1000,
    // Retry failed requests 3 times with exponential backoff
    retry: (failureCount: number, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus for critical data
    refetchOnWindowFocus: true,
    // Refetch when coming back online
    refetchOnReconnect: true,
  },
  mutations: {
    // Global error handling for mutations
    onError: (error: any, variables: any, context: any) => {
      errorHandler.handleError(error, {
        component: 'QueryClient',
        action: 'mutation',
        metadata: { variables, context }
      });
    },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

// Query keys factory for consistent caching
export const queryKeys = {
  // User related
  userProfile: ['user', 'profile'] as const,
  userSettings: ['user', 'settings'] as const,
  
  // Dashboard and analytics
  dashboardData: ['dashboard', 'data'] as const,
  analytics: ['analytics'] as const,
  
  // Sources and patients
  sources: ['sources'] as const,
  sourceDetail: (id: string) => ['sources', id] as const,
  monthlyPatients: ['patients', 'monthly'] as const,
  patientSources: ['patients', 'sources'] as const,
  
  // Campaigns and marketing
  campaigns: ['campaigns'] as const,
  campaignDetail: (id: string) => ['campaigns', id] as const,
  marketingVisits: ['marketing', 'visits'] as const,
  
  // Discovery and offices
  discoveredOffices: ['offices', 'discovered'] as const,
  officeDetail: (id: string) => ['offices', id] as const,
  
  // AI and content
  aiUsage: ['ai', 'usage'] as const,
  aiBusinessProfile: ['ai', 'business-profile'] as const,
  
  // External data
  googlePlaces: (placeId: string) => ['google', 'places', placeId] as const,
  reviews: (placeId: string) => ['reviews', placeId] as const,
} as const;

// Prefetch common data
export const prefetchUserData = async () => {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.userProfile,
      staleTime: 10 * 60 * 1000, // Keep user profile fresh for 10 minutes
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboardData,
      staleTime: 2 * 60 * 1000, // Refresh dashboard data every 2 minutes
    }),
  ]);
};

// Utility functions for cache management
export const cacheUtils = {
  invalidateUserData: () => {
    queryClient.invalidateQueries({ queryKey: ['user'] });
  },
  
  invalidateDashboard: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardData });
  },
  
  invalidateSources: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sources });
    queryClient.invalidateQueries({ queryKey: queryKeys.patientSources });
    queryClient.invalidateQueries({ queryKey: queryKeys.monthlyPatients });
  },
  
  invalidateCampaigns: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
  },
  
  // Clear all cached data (useful on logout)
  clearAll: () => {
    queryClient.clear();
  },
  
  // Remove specific data from cache
  removeQuery: (queryKey: readonly unknown[]) => {
    queryClient.removeQueries({ queryKey });
  },
};
