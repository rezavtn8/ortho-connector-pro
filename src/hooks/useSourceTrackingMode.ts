import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentYearMonth } from '@/lib/dateSync';

export interface TrackingModeResult {
  mode: 'daily' | 'monthly';
  dailyEntryCount: number;
  isEditable: boolean;
  isLoading: boolean;
}

/**
 * Check if a source has daily entries for a given month
 * If daily entries exist, the month is read-only (calculated from daily data)
 * If no daily entries, the month is editable (manual monthly entry)
 */
export function useSourceTrackingMode(sourceId: string, yearMonth?: string): TrackingModeResult {
  const month = yearMonth || getCurrentYearMonth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['source-tracking-mode', sourceId, month],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('daily_patients')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId)
        .gte('patient_date', `${month}-01`)
        .lte('patient_date', `${month}-31`);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!sourceId && !!month,
    staleTime: 30000, // Cache for 30 seconds
  });

  const dailyEntryCount = data || 0;
  const hasDailyEntries = dailyEntryCount > 0;

  return {
    mode: hasDailyEntries ? 'daily' : 'monthly',
    dailyEntryCount,
    isEditable: !hasDailyEntries,
    isLoading,
  };
}

/**
 * Batch check tracking mode for multiple sources at once
 * More efficient than individual queries
 */
export function useMultiSourceTrackingMode(sourceIds: string[], yearMonth?: string) {
  const month = yearMonth || getCurrentYearMonth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['multi-source-tracking-mode', sourceIds.sort().join(','), month],
    queryFn: async () => {
      if (sourceIds.length === 0) return {};
      
      const { data: entries, error } = await supabase
        .from('daily_patients')
        .select('source_id')
        .in('source_id', sourceIds)
        .gte('patient_date', `${month}-01`)
        .lte('patient_date', `${month}-31`);

      if (error) throw error;

      // Count entries per source
      const counts: Record<string, number> = {};
      (entries || []).forEach(entry => {
        counts[entry.source_id] = (counts[entry.source_id] || 0) + 1;
      });

      return counts;
    },
    enabled: sourceIds.length > 0 && !!month,
    staleTime: 30000,
  });

  const getModeForSource = (sourceId: string): TrackingModeResult => {
    const count = data?.[sourceId] || 0;
    return {
      mode: count > 0 ? 'daily' : 'monthly',
      dailyEntryCount: count,
      isEditable: count === 0,
      isLoading,
    };
  };

  return {
    getModeForSource,
    isLoading,
    sourcesWithDailyData: Object.keys(data || {}).filter(id => (data?.[id] || 0) > 0),
  };
}
