import { useState } from 'react';
import { MonthlyPatients, formatYearMonth } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePatientCounts = (sourceId: string | undefined, onDataChange: () => void) => {
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const { toast } = useToast();

  const adjustPatientCount = async (yearMonth: string, delta: number) => {
    if (!sourceId) return;

    try {
      const { data, error } = await supabase
        .rpc('adjust_patient_count', {
          p_source_id: sourceId,
          p_year_month: yearMonth,
          p_delta: delta
        });

      if (error) throw error;

      await onDataChange();

      toast({
        title: "Success",
        description: `Patient count updated for ${formatYearMonth(yearMonth)}`,
      });
    } catch (error) {
      console.error('Error adjusting patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    }
  };

  const updateMonthlyCount = async (yearMonth: string, newCount: number, monthlyData: MonthlyPatients[]) => {
    try {
      const currentData = monthlyData.find(m => m.year_month === yearMonth);
      const currentCount = currentData?.patient_count || 0;
      const delta = newCount - currentCount;

      if (delta !== 0) {
        await adjustPatientCount(yearMonth, delta);
      }

      setEditingMonth(null);
    } catch (error) {
      console.error('Error updating monthly count:', error);
    }
  };

  const getMonthlyCount = (yearMonth: string, monthlyData: MonthlyPatients[]) => {
    const data = monthlyData.find(m => m.year_month === yearMonth);
    return data?.patient_count || 0;
  };

  const getLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      months.push(yearMonth);
    }
    return months;
  };

  return {
    editingMonth,
    editValue,
    setEditingMonth,
    setEditValue,
    adjustPatientCount,
    updateMonthlyCount,
    getMonthlyCount,
    getLast12Months
  };
};