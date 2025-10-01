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
  percentile?: number | null;
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

      // First pass: Calculate metrics for all offices
      const officesWithMetrics = (sources || []).map(source => {
        const monthlyData = source.monthly_patients || [];
        const currentMonthData = monthlyData.find(m => m.year_month === currentMonth);
        const currentMonthReferrals = currentMonthData?.patient_count || 0;
        const totalReferrals = monthlyData.reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate last 12 months (L12) - including current month
        const now = new Date();
        const last12Months = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        });
        
        const l12 = monthlyData
          .filter(m => last12Months.includes(m.year_month))
          .reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate recent 3 months (R3) - last 3 complete months
        const recent3Months = Array.from({ length: 3 }, (_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        });
        const r3 = monthlyData
          .filter(m => recent3Months.includes(m.year_month))
          .reduce((sum, m) => sum + m.patient_count, 0);
        
        // Calculate months since last referral (MSLR)
        const lastActiveData = monthlyData
          .filter(m => m.patient_count > 0)
          .sort((a, b) => b.year_month.localeCompare(a.year_month))[0];
        
        const mslr = lastActiveData ? 
          Math.floor((new Date().getTime() - new Date(lastActiveData.year_month + '-01').getTime()) / (1000 * 60 * 60 * 24 * 30)) : 999;
        
        // Determine strength and category (legacy)
        let strength: Office['strength'] = 'Cold';
        if (r3 >= 5 && mslr <= 2) strength = 'Strong';
        else if (r3 >= 2 && mslr <= 3) strength = 'Moderate';
        else if (totalReferrals > 0 && mslr <= 6) strength = 'Sporadic';
        
        let category: Office['category'] = strength as Office['category'];
        if (totalReferrals >= 20 && currentMonthReferrals >= 8) {
          category = 'VIP';
        }

        return {
          source,
          currentMonthReferrals,
          totalReferrals,
          l12,
          r3,
          mslr,
          lastActiveData,
          strength,
          category
        };
      });

      // Step 1: Separate dormant offices (no referrals in last 6 months)
      const dormantOffices = officesWithMetrics.filter(item => item.mslr >= 6);
      const activeOffices = officesWithMetrics.filter(item => item.mslr < 6);

      // Step 2: Sort active offices by total referrals (descending), then by mslr (ascending) as tiebreaker
      activeOffices.sort((a, b) => {
        if (b.totalReferrals !== a.totalReferrals) return b.totalReferrals - a.totalReferrals;
        return a.mslr - b.mslr; // Lower mslr (more recent) as tiebreaker
      });

      // Step 3: Assign tiers based on quartiles
      const activeCount = activeOffices.length;
      const offices: Office[] = [];

      if (activeCount > 0) {
        const q1 = Math.ceil(activeCount * 0.25);
        const q2 = Math.ceil(activeCount * 0.50);
        
        activeOffices.forEach((item, index) => {
          let tier: string;
          const percentile = Math.round(((activeCount - index) / activeCount) * 100);
          
          // Assign tier based on quartile
          if (index < q1) tier = 'VIP'; // Top 25%
          else if (index < q2) tier = 'Warm'; // Next 25%
          else tier = 'Cold'; // Bottom 50%
          
          offices.push({
            id: item.source.id,
            name: item.source.name,
            address: item.source.address,
            phone: item.source.phone,
            latitude: item.source.latitude,
            longitude: item.source.longitude,
            email: item.source.email,
            website: item.source.website,
            notes: item.source.notes,
            google_rating: item.source.google_rating,
            currentMonthReferrals: item.currentMonthReferrals,
            totalReferrals: item.totalReferrals,
            strength: item.strength,
            category: item.category,
            lastActiveMonth: item.lastActiveData?.year_month || null,
            l12: item.l12,
            r3: item.r3,
            mslr: item.mslr,
            tier,
            percentile
          });
        });
      }

      // Add dormant offices
      dormantOffices.forEach(item => {
        offices.push({
          id: item.source.id,
          name: item.source.name,
          address: item.source.address,
          phone: item.source.phone,
          latitude: item.source.latitude,
          longitude: item.source.longitude,
          email: item.source.email,
          website: item.source.website,
          notes: item.source.notes,
          google_rating: item.source.google_rating,
          currentMonthReferrals: item.currentMonthReferrals,
          totalReferrals: item.totalReferrals,
          strength: item.strength,
          category: item.category,
          lastActiveMonth: item.lastActiveData?.year_month || null,
          l12: item.l12,
          r3: item.r3,
          mslr: item.mslr,
          tier: 'Dormant',
          percentile: null
        });
      });

      
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