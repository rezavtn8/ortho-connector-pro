import { useState, useEffect } from 'react';
import { PatientSource, SourceTag, MonthlyPatients, PatientChangeLog } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSourceDetail = (sourceId: string | undefined) => {
  const [source, setSource] = useState<PatientSource | null>(null);
  const [tags, setTags] = useState<SourceTag[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [changeLog, setChangeLog] = useState<PatientChangeLog[]>([]);
  const [marketingVisits, setMarketingVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadSourceData = async () => {
    if (!sourceId) return;

    try {
      setLoading(true);

      // Load source
      const { data: sourceData, error: sourceError } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('id', sourceId)
        .single();

      if (sourceError) throw sourceError;

      // Load tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('source_tags')
        .select('*')
        .eq('source_id', sourceId);

      if (tagsError) throw tagsError;

      // Load monthly data (last 12 months)
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('source_id', sourceId)
        .order('year_month', { ascending: false })
        .limit(12);

      if (monthlyError) throw monthlyError;

      // Load change log
      const { data: changeLogData, error: changeLogError } = await supabase
        .from('patient_changes_log')
        .select('*')
        .eq('source_id', sourceId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (changeLogError) throw changeLogError;

      // Load marketing visits if source is Office type
      let visitsData = [];
      if (sourceData?.source_type === 'Office') {
        const { data: visits, error: visitsError } = await supabase
          .from('marketing_visits')
          .select('*')
          .eq('office_id', sourceId)
          .order('visit_date', { ascending: false });

        if (visitsError) {
          console.warn('Error loading marketing visits:', visitsError);
        } else {
          visitsData = visits || [];
        }
      }

      setSource(sourceData);
      setTags(tagsData || []);
      setMonthlyData(monthlyDataResult || []);
      setChangeLog(changeLogData || []);
      setMarketingVisits(visitsData);
    } catch (error) {
      console.error('Error loading source data:', error);
      toast({
        title: "Error",
        description: "Failed to load source data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalPatients = () => {
    return monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0);
  };

  const getMonthlyTrend = () => {
    if (monthlyData.length < 2) return 'stable';
    const current = monthlyData[0]?.patient_count || 0;
    const previous = monthlyData[1]?.patient_count || 0;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  useEffect(() => {
    if (sourceId) {
      loadSourceData();
    }
  }, [sourceId]);

  return {
    source,
    tags,
    monthlyData,
    changeLog,
    marketingVisits,
    loading,
    loadSourceData,
    getTotalPatients,
    getMonthlyTrend
  };
};