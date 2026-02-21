import { useQuery, UseQueryOptions } from '@tanstack/react-query';
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

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('Authentication required');
      }

      try {
        return await queryFn();
      } catch (error: any) {
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
      if (error?.message?.includes('Authentication') || error?.message?.includes('JWT')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!user?.id,
    ...options
  });

  const data = query.error && fallbackData ? fallbackData : query.data;

  return {
    ...query,
    data,
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    connectionStatus: navigator.onLine ? 'online' as const : 'offline' as const,
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
