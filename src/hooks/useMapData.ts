import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getCurrentYearMonth } from '@/lib/dateSync';

export interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  category: 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastActiveMonth?: string | null;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function useMapData() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id, name, address, latitude, longitude')
          .eq('id', profile.clinic_id)
          .maybeSingle();

        if (clinic?.latitude && clinic?.longitude) {
          setClinic({
            id: clinic.id,
            name: clinic.name || 'My Clinic',
            address: clinic.address || '',
            latitude: clinic.latitude,
            longitude: clinic.longitude
          });
        }
      }

      // Load offices data
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('id, name, address, phone, latitude, longitude')
        .eq('is_active', true)
        .eq('source_type', 'Office')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (sources?.length) {
        const currentMonth = getCurrentYearMonth();
        const sourceIds = sources.map(s => s.id);
        
        // Load monthly data
        const { data: monthlyData } = await supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .in('source_id', sourceIds);

        // Load strength scores in smaller batches to prevent overload
        const batchSize = 10;
        const strengthResults: any[] = [];
        
        for (let i = 0; i < sourceIds.length; i += batchSize) {
          const batch = sourceIds.slice(i, i + batchSize);
          const batchPromises = batch.map(id =>
            supabase.rpc('calculate_source_score', { source_id_param: id })
          );
          const batchResults = await Promise.all(batchPromises);
          strengthResults.push(...batchResults);
        }

        // Process offices
        const officesWithData = sources.map((source, index) => {
          const sourceMonthlyData = monthlyData?.filter(m => m.source_id === source.id) || [];
          const currentMonthData = sourceMonthlyData.find(m => m.year_month === currentMonth);
          const currentMonthReferrals = currentMonthData?.patient_count || 0;
          const totalReferrals = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
          const strength = strengthResults[index]?.data || 'Cold';

          const lastActiveData = sourceMonthlyData
            .filter(m => m.patient_count > 0)
            .sort((a, b) => b.year_month.localeCompare(a.year_month))[0];

          let category: Office['category'];
          if (totalReferrals >= 20 && currentMonthReferrals >= 8) {
            category = 'VIP';
          } else {
            category = strength as Office['category'];
          }

          return {
            ...source,
            currentMonthReferrals,
            totalReferrals,
            strength: strength as Office['strength'],
            category,
            lastActiveMonth: lastActiveData?.year_month || null
          };
        });
        
        setOffices(officesWithData);
      }
    } catch (error) {
      console.error('Error loading map data:', error);
      setError('Failed to load map data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { offices, clinic, isLoading, error, refetch: loadData };
}