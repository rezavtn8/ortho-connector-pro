import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RatingCategory = 'Excellent' | 'Good' | 'Average' | 'Low';

export interface DiscoveredOffice {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  google_rating: number | null;
  office_type: string | null;
  distance_miles: number | null;
  ratingCategory: RatingCategory;
}

function categorize(rating: number | null | undefined): RatingCategory {
  const value = rating ?? 0;
  if (value >= 4.5) return 'Excellent';
  if (value >= 4.0) return 'Good';
  if (value >= 3.5) return 'Average';
  return 'Low';
}

/**
 * Discovered (prospect) offices for the map — all of the user's, or just one saved group.
 *
 * On React Query rather than useState/useEffect. Besides the caching, this fixes a
 * real bug in the previous `useDiscoveredMapData`: it only called `setOffices` when
 * the query returned a non-empty array, so switching to an empty group left the
 * previous group's pins on the map indefinitely. React Query owning the state makes
 * an empty result an empty result.
 */
export function useDiscoveredOffices(groupId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['discovered-offices', groupId ?? 'all'],
    enabled,
    queryFn: async (): Promise<DiscoveredOffice[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let ids: string[] | null = null;
      if (groupId) {
        const { data: members, error: membersError } = await supabase
          .from('discovered_office_group_members')
          .select('office_id')
          .eq('group_id', groupId);
        if (membersError) throw membersError;

        ids = (members ?? []).map((m) => m.office_id);
        if (ids.length === 0) return []; // empty group means empty map, not stale pins
      }

      let query = supabase
        .from('discovered_offices')
        .select(
          'id, name, address, phone, website, latitude, longitude, google_rating, office_type, distance_miles',
        )
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      query = ids ? query.in('id', ids) : query.eq('discovered_by', user.id);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((office) => ({
        id: office.id,
        name: office.name,
        address: office.address ?? null,
        phone: office.phone ?? null,
        website: office.website ?? null,
        latitude: office.latitude as number,
        longitude: office.longitude as number,
        google_rating: office.google_rating ?? null,
        office_type: office.office_type ?? null,
        distance_miles: office.distance_miles ?? null,
        ratingCategory: categorize(office.google_rating),
      }));
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
