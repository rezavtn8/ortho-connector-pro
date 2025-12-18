import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { formatDateForDB, formatDateDisplay } from '@/utils/dateUtils';
export interface DailyPatientEntry {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  patient_date: string;
  patient_count: number;
  notes: string | null;
}

export interface MonthlyPatientData {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  year_month: string;
  patient_count: number;
}

export interface AddDailyPatientsInput {
  source_id: string;
  date: Date;
  count: number;
  notes?: string;
}

/**
 * Fetch daily patients for a specific month
 * Returns actual daily entries from the daily_patients table
 */
export function useDailyPatients(yearMonth: string) {
  return useQuery({
    queryKey: ['daily-patients', yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_patients_for_month', {
        p_year_month: yearMonth
      });

      if (error) throw error;
      return (data || []) as DailyPatientEntry[];
    },
    enabled: !!yearMonth,
  });
}

/**
 * Fetch daily patients for a specific date
 */
export function useDailyPatientsForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['daily-patients-date', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_patients')
        .select(`
          id,
          source_id,
          patient_date,
          patient_count,
          notes,
          patient_sources (
            name,
            source_type
          )
        `)
        .eq('patient_date', dateStr);

      if (error) throw error;
      
      return (data || []).map(entry => ({
        id: entry.id,
        source_id: entry.source_id,
        source_name: (entry.patient_sources as any)?.name || 'Unknown',
        source_type: (entry.patient_sources as any)?.source_type || 'Other',
        patient_date: entry.patient_date,
        patient_count: entry.patient_count,
        notes: entry.notes
      })) as DailyPatientEntry[];
    },
    enabled: !!date,
  });
}

/**
 * Fetch monthly patient totals - used for analytics and when daily data doesn't exist
 */
export function useMonthlyPatients(yearMonth: string) {
  return useQuery({
    queryKey: ['monthly-patients', yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_patients')
        .select(`
          id,
          source_id,
          year_month,
          patient_count,
          patient_sources (
            name,
            source_type
          )
        `)
        .eq('year_month', yearMonth);

      if (error) throw error;
      
      return (data || []).map(entry => ({
        id: entry.id,
        source_id: entry.source_id,
        source_name: (entry.patient_sources as any)?.name || 'Unknown',
        source_type: (entry.patient_sources as any)?.source_type || 'Other',
        year_month: entry.year_month,
        patient_count: entry.patient_count
      })) as MonthlyPatientData[];
    },
    enabled: !!yearMonth,
  });
}

/**
 * Combined hook that provides unified patient data
 * - Uses daily data if available
 * - Falls back to monthly data if no daily entries exist
 * - Provides clear data source indicator
 */
export function useUnifiedPatientData(yearMonth: string) {
  const dailyQuery = useDailyPatients(yearMonth);
  const monthlyQuery = useMonthlyPatients(yearMonth);
  
  const hasDailyData = (dailyQuery.data?.length || 0) > 0;
  const hasMonthlyData = (monthlyQuery.data?.length || 0) > 0;
  
  // Calculate totals
  const dailyTotal = dailyQuery.data?.reduce((sum, e) => sum + e.patient_count, 0) || 0;
  const monthlyTotal = monthlyQuery.data?.reduce((sum, e) => sum + e.patient_count, 0) || 0;
  
  return {
    // Raw data
    dailyEntries: dailyQuery.data || [],
    monthlyEntries: monthlyQuery.data || [],
    
    // Data availability flags
    hasDailyData,
    hasMonthlyData,
    dataSource: hasDailyData ? 'daily' : hasMonthlyData ? 'monthly' : 'none',
    
    // Totals (prefer daily sum, fall back to monthly)
    totalPatients: hasDailyData ? dailyTotal : monthlyTotal,
    dailyTotal,
    monthlyTotal,
    
    // Data consistency check
    isConsistent: !hasDailyData || dailyTotal === monthlyTotal,
    discrepancy: hasDailyData ? monthlyTotal - dailyTotal : 0,
    
    // Loading states
    isLoading: dailyQuery.isLoading || monthlyQuery.isLoading,
    error: dailyQuery.error || monthlyQuery.error,
    
    // Refetch functions
    refetch: () => {
      dailyQuery.refetch();
      monthlyQuery.refetch();
    }
  };
}

/**
 * Get working days in a month (for daily average calculation)
 */
export function getWorkingDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter(day => !isWeekend(day)).length;
}

/**
 * Add daily patients mutation
 * Also syncs to monthly_patients table via database function
 */
export function useAddDailyPatients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (inputs: AddDailyPatientsInput[]) => {
      const results = [];
      
      // Process in parallel for better performance
      const promises = inputs.map(input => 
        supabase.rpc('add_daily_patients', {
          p_source_id: input.source_id,
          p_date: formatDateForDB(input.date),
          p_count: input.count,
          p_notes: input.notes || null
        })
      );

      const responses = await Promise.all(promises);
      
      for (const response of responses) {
        if (response.error) throw response.error;
        results.push(response.data);
      }
      
      return results;
    },
    onSuccess: (_, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['daily-patients'] });
      queryClient.invalidateQueries({ queryKey: ['daily-patients-date'] });
      queryClient.invalidateQueries({ queryKey: ['patient-sources'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['unified-patient-data'] });
      
      const totalPatients = variables.reduce((sum, v) => sum + v.count, 0);
      const dateStr = formatDateDisplay(variables[0].date, 'MMM d');
      
      toast({
        title: "Patients Added",
        description: `Added ${totalPatients} patient${totalPatients !== 1 ? 's' : ''} for ${dateStr}`,
      });
    },
    onError: (error) => {
      console.error('Error adding daily patients:', error);
      toast({
        title: "Error",
        description: "Failed to add daily patients. Please try again.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete daily patient entry
 * Also updates the monthly_patients table via database function
 */
export function useDeleteDailyPatient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase.rpc('delete_daily_patients', {
        p_entry_id: entryId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-patients'] });
      queryClient.invalidateQueries({ queryKey: ['daily-patients-date'] });
      queryClient.invalidateQueries({ queryKey: ['patient-sources'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['unified-patient-data'] });
      
      toast({
        title: "Success",
        description: "Entry deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting daily patient:', error);
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update monthly patient count directly (for bulk/manual entry)
 * Use this when not tracking daily granularity
 */
export function useUpdateMonthlyPatients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sourceId, yearMonth, count }: { 
      sourceId: string; 
      yearMonth: string; 
      count: number;
    }) => {
      const { data, error } = await supabase.rpc('set_patient_count', {
        p_source_id: sourceId,
        p_year_month: yearMonth,
        p_count: count,
        p_reason: 'manual_update'
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['patient-sources'] });
      queryClient.invalidateQueries({ queryKey: ['unified-patient-data'] });
      
      toast({
        title: "Updated",
        description: "Monthly count updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating monthly patients:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    },
  });
}
