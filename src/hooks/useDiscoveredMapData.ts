import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface DiscoveredOffice {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_rating?: number | null;
  office_type?: string | null;
  distance_miles?: number | null;
  ratingCategory: 'Excellent' | 'Good' | 'Average' | 'Low';
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function useDiscoveredMapData(officeIds: string[]) {
  const [offices, setOffices] = useState<DiscoveredOffice[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!officeIds.length) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Load clinic data
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('id, name, address, latitude, longitude')
          .eq('id', profile.clinic_id)
          .maybeSingle();

        if (clinicData?.latitude && clinicData?.longitude) {
          setClinic({
            id: clinicData.id,
            name: clinicData.name || 'My Clinic',
            address: clinicData.address || '',
            latitude: clinicData.latitude,
            longitude: clinicData.longitude
          });
        }
      }

      // Load discovered offices
      const { data: discoveredOffices, error: officesError } = await supabase
        .from('discovered_offices')
        .select('id, name, address, phone, website, latitude, longitude, google_rating, office_type, distance_miles')
        .in('id', officeIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (officesError) {
        console.error('Error loading discovered offices:', officesError);
        setError('Failed to load discovered offices');
        return;
      }

      if (discoveredOffices?.length) {
        const officesWithCategory = discoveredOffices.map((office) => {
          // Categorize by Google rating
          let ratingCategory: DiscoveredOffice['ratingCategory'];
          const rating = office.google_rating || 0;
          
          if (rating >= 4.5) {
            ratingCategory = 'Excellent';
          } else if (rating >= 4.0) {
            ratingCategory = 'Good';
          } else if (rating >= 3.5) {
            ratingCategory = 'Average';
          } else {
            ratingCategory = 'Low';
          }

          return {
            ...office,
            ratingCategory
          };
        });
        
        setOffices(officesWithCategory);
      }
    } catch (error) {
      console.error('Error loading discovered map data:', error);
      setError('Failed to load map data');
    } finally {
      setIsLoading(false);
    }
  }, [officeIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { offices, clinic, isLoading, error, refetch: loadData };
}
