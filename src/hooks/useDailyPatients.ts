import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface DailyPatientEntry {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  patient_date: string;
  patient_count: number;
  notes: string | null;
}

export interface AddDailyPatientsInput {
  source_id: string;
  date: Date;
  count: number;
  notes?: string;
}

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

export function useAddDailyPatients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (inputs: AddDailyPatientsInput[]) => {
      const results = [];
      
      for (const input of inputs) {
        const { data, error } = await supabase.rpc('add_daily_patients', {
          p_source_id: input.source_id,
          p_date: format(input.date, 'yyyy-MM-dd'),
          p_count: input.count,
          p_notes: input.notes || null
        });

        if (error) throw error;
        results.push(data);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-patients'] });
      queryClient.invalidateQueries({ queryKey: ['daily-patients-date'] });
      queryClient.invalidateQueries({ queryKey: ['patient-sources'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-patients'] });
      
      toast({
        title: "Success",
        description: "Daily patients added successfully",
      });
    },
    onError: (error) => {
      console.error('Error adding daily patients:', error);
      toast({
        title: "Error",
        description: "Failed to add daily patients",
        variant: "destructive",
      });
    },
  });
}

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
