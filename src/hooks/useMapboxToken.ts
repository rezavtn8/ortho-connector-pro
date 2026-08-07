import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * The Mapbox public token, fetched from an authenticated edge function rather than
 * shipped as a build-time env var.
 *
 * On React Query with a long `staleTime` so navigating away from the map and back
 * doesn't re-invoke the edge function — the previous useState/useEffect version
 * re-fetched on every mount.
 */
export function useMapboxToken() {
  const query = useQuery({
    queryKey: ['mapbox-token'],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      if (!data?.token) throw new Error('No Mapbox token returned');
      return data.token as string;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    token: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load Mapbox token' : null,
  };
}
