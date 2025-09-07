import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // Retry failed queries 2 times
      retry: 2,
      // Retry delay increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Background refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Background refetch when coming back online
      refetchOnReconnect: true,
      // Refetch stale data in background
      refetchInterval: false, // We'll set this per query for critical data
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Keep mutation results for 5 minutes
      gcTime: 5 * 60 * 1000,
    },
  },
});

// Query keys for consistent caching
export const queryKeys = {
  // Dashboard data
  dashboard: ['dashboard'] as const,
  dashboardSummary: ['dashboard', 'summary'] as const,
  
  // Sources
  sources: ['sources'] as const,
  sourcesList: (filters?: any) => ['sources', 'list', filters] as const,
  sourceDetail: (id: string) => ['sources', 'detail', id] as const,
  
  // Offices  
  offices: ['offices'] as const,
  officesList: (filters?: any) => ['offices', 'list', filters] as const,
  officeDetail: (id: string) => ['offices', 'detail', id] as const,
  officeMetrics: ['offices', 'metrics'] as const,
  
  // Marketing visits
  marketingVisits: ['marketing-visits'] as const,
  marketingVisitsList: (filters?: any) => ['marketing-visits', 'list', filters] as const,
  marketingVisitDetail: (id: string) => ['marketing-visits', 'detail', id] as const,
  
  // Campaigns
  campaigns: ['campaigns'] as const,
  campaignsList: (filters?: any) => ['campaigns', 'list', filters] as const,
  campaignDetail: (id: string) => ['campaigns', 'detail', id] as const,
  
  // Campaign Deliveries
  campaignDeliveries: ['campaign-deliveries'] as const,
  campaignDeliveriesList: (filters?: any) => ['campaign-deliveries', 'list', filters] as const,
  campaignDeliveriesByCampaign: (campaignId: string) => ['campaign-deliveries', 'campaign', campaignId] as const,
  
  // Monthly data
  monthlyPatients: ['monthly-patients'] as const,
  monthlyPatientsForSource: (sourceId: string) => ['monthly-patients', 'source', sourceId] as const,
  
  // User profile
  userProfile: ['user-profile'] as const,
  
  // Analytics
  analytics: ['analytics'] as const,
} as const;

// Background refetch intervals for critical data
export const refetchIntervals = {
  // Dashboard data - refresh every 2 minutes
  dashboard: 2 * 60 * 1000,
  // Patient counts - refresh every 5 minutes  
  monthlyPatients: 5 * 60 * 1000,
  // Marketing visits - refresh every 10 minutes
  marketingVisits: 10 * 60 * 1000,
} as const;
