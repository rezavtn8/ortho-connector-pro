import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ResilientQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryFn'> {
  queryFn: () => Promise<T>;
  fallbackData?: T;
  showErrorToast?: boolean;
  retryMessage?: string;
}

export function useResilientQuery<T>({
  queryKey,
  queryFn,
  fallbackData,
  showErrorToast = true,
  retryMessage = 'Retrying...',
  ...options
}: ResilientQueryOptions<T>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('online');

  // Monitor network status
  useEffect(() => {
    const handleOnline = async () => {
      setConnectionStatus('checking');
      try {
        // Check if Supabase is actually reachable
        await supabase.from('user_profiles').select('id').limit(1);
        setConnectionStatus('online');
        // Refetch all queries when connection is restored
        queryClient.invalidateQueries();
      } catch {
        setConnectionStatus('offline');
      }
    };

    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: [...queryKey, user?.id], // Include user ID in query key for proper invalidation
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('Authentication required');
      }

      if (connectionStatus === 'offline') {
        throw new Error('Currently offline. Please check your connection.');
      }

      try {
        return await queryFn();
      } catch (error: any) {
        // Log error for debugging
        console.error(`Query failed for ${queryKey.join('/')}:`, error);
        
        if (showErrorToast && error?.message !== 'Authentication required') {
          toast({
            title: 'Connection Error',
            description: error.message || 'Failed to load data. Please try again.',
            variant: 'destructive',
          });
        }
        
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry authentication errors
      if (error?.message?.includes('Authentication') || error?.message?.includes('JWT')) {
        return false;
      }
      
      // Don't retry if offline
      if (connectionStatus === 'offline') {
        return false;
      }
      
      // Retry up to 3 times for network errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!user?.id && connectionStatus !== 'offline',
    ...options
  });

  // Return fallback data if query fails and fallback is provided
  const data = query.error && fallbackData ? fallbackData : query.data;

  return {
    ...query,
    data,
    isOnline: connectionStatus === 'online',
    isOffline: connectionStatus === 'offline',
    connectionStatus,
    // Helper method to manually retry
    retry: () => {
      if (showErrorToast) {
        toast({
          title: 'Retrying...',
          description: retryMessage,
        });
      }
      return query.refetch();
    }
  };
}

// Specialized hook for user profile data
export function useProfileDataResilient() {
  const { user } = useAuth();

  return useResilientQuery({
    queryKey: ['profile-data'],
    queryFn: async () => {
      if (!user?.id) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, phone, job_title, email, degrees, clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    fallbackData: null,
    retryMessage: 'Refreshing profile data...'
  });
}

// Specialized hook for campaigns
export function useCampaignsResilient() {
  return useResilientQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...'
  });
}

// Specialized hook for marketing visits
export function useMarketingVisitsResilient() {
  return useResilientQuery({
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
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing visits...'
  });
}

// Specialized hook for patient sources (offices)
export function usePatientSourcesResilient() {
  return useResilientQuery({
    queryKey: ['patient-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing offices...'
  });
}