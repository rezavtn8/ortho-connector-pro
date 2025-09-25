import { useState, useEffect } from 'react';
import { PatientSource, MonthlyPatients } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrentYearMonth } from '@/lib/dateSync';

export const useSources = () => {
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patient sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (sourcesError) throw sourcesError;

      // Load all monthly data for patient counts
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*');

      if (monthlyError) throw monthlyError;

      setSources(sourcesData || []);
      setMonthlyData(monthlyDataResult || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPatientCounts = (sourceId: string) => {
    const currentMonth = getCurrentYearMonth();
    const sourceMonthlyData = monthlyData.filter(m => m.source_id === sourceId);
    const thisMonth = sourceMonthlyData
      .filter(m => m.year_month === currentMonth)
      .reduce((sum, m) => sum + m.patient_count, 0);
    const total = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
    return { thisMonth, total };
  };

  const filterSources = (sources: PatientSource[], searchTerm: string, types: string[]) => {
    return sources
      .filter(source => types.includes(source.source_type))
      .filter(source => 
        searchTerm === '' || 
        source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        source.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    sources,
    monthlyData,
    loading,
    loadData,
    getPatientCounts,
    filterSources
  };
};