import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  google_rating?: number | null;
  website?: string | null;
  email?: string | null;
  notes?: string | null;
  l12?: number;
  r3?: number;
  mslr?: number;
  tier?: string;
}

export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const currentMonth = getCurrentYearMonth();
      
      // Single optimized query with joins - using left join to include all offices
      const { data: sources, error } = await supabase
        .from('patient_sources')
        .select(`
          id,
          name,
          address,
          phone,
          latitude,
          longitude,
          email,
          website,
          notes,
          google_rating,
          monthly_patients(
            year_month,
            patient_count
          )
        `)
        .eq('is_active', true)
        .eq('source_type', 'Office')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      // Fetch all marketing visits for these offices
      const sourceIds = sources?.map(s => s.id) || [];
      const { data: visits } = await supabase
        .from('marketing_visits')
        .select('office_id, visit_date, visited, star_rating')
        .in('office_id', sourceIds)
        .order('visit_date', { ascending: false });

      // Process offices with aggregated data
      const offices: Office[] = [];
      
      for (const source of sources || []) {
        const monthlyData = source.monthly_patients || [];
        const currentMonthData = monthlyData.find(m => m.year_month === currentMonth);
        const currentMonthReferrals = currentMonthData?.patient_count || 0;
        const totalReferrals = monthlyData.reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate last 12 months (L12)
        const last12Months = Array.from({ length: 12 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        });
        
        const l12 = monthlyData
          .filter(m => last12Months.includes(m.year_month))
          .reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate recent 3 months (R3)
        const recent3Months = last12Months.slice(0, 3);
        const r3 = monthlyData
          .filter(m => recent3Months.includes(m.year_month))
          .reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate months since last referral (MSLR)
        const lastActiveData = monthlyData
          .filter(m => m.patient_count > 0)
          .sort((a, b) => b.year_month.localeCompare(a.year_month))[0];
        
        const mslr = lastActiveData ? 
          Math.floor((new Date().getTime() - new Date(lastActiveData.year_month + '-01').getTime()) / (1000 * 60 * 60 * 24 * 30)) : 999;
        
        // Determine strength and category
        let strength: Office['strength'] = 'Cold';
        if (r3 >= 5 && mslr <= 2) strength = 'Strong';
        else if (r3 >= 2 && mslr <= 3) strength = 'Moderate';
        else if (totalReferrals > 0 && mslr <= 6) strength = 'Sporadic';
        
        let category: Office['category'] = strength as Office['category'];
        if (totalReferrals >= 20 && currentMonthReferrals >= 8) {
          category = 'VIP';
        }
        
        // Get visit history for this office
        const officeVisits = visits?.filter(v => v.office_id === source.id) || [];
        const recentVisits = officeVisits.filter(v => {
          const visitDate = new Date(v.visit_date);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return visitDate >= sixMonthsAgo;
        });
        const visitCount6m = recentVisits.length;
        const avgRating = recentVisits.length > 0 
          ? recentVisits.reduce((sum, v) => sum + (v.star_rating || 0), 0) / recentVisits.length 
          : 0;
        const hasGoodEngagement = visitCount6m >= 2 && avgRating >= 3;
        
        // Determine tier with visit history consideration
        let tier = 'Cold';
        
        // VIP: High referrals OR good engagement with decent referrals
        if ((l12 >= 25 && r3 >= 8) || (hasGoodEngagement && l12 >= 15 && r3 >= 5)) {
          tier = 'VIP';
        }
        // Warm: Moderate referrals OR recent visits with some referrals
        else if ((l12 >= 12 && r3 >= 4) || (visitCount6m >= 1 && l12 >= 6 && r3 >= 2)) {
          tier = 'Warm';
        }
        // Dormant: Has referrals but inactive AND no recent engagement
        else if (l12 >= 1 && visitCount6m === 0) {
          tier = 'Dormant';
        }
        // Cold: No referrals or minimal activity
        else {
          tier = 'Cold';
        }
        
        offices.push({
          id: source.id,
          name: source.name,
          address: source.address,
          phone: source.phone,
          latitude: source.latitude,
          longitude: source.longitude,
          email: source.email,
          website: source.website,
          notes: source.notes,
          google_rating: source.google_rating,
          currentMonthReferrals,
          totalReferrals,
          strength,
          category,
          lastActiveMonth: lastActiveData?.year_month || null,
          l12,
          r3,
          mslr,
          tier
        });
      }
      
      return offices;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useOfficesWithSearch(searchTerm: string) {
  const { data: offices, ...rest } = useOffices();
  
  const filteredOffices = offices?.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  return {
    data: filteredOffices,
    ...rest
  };
}