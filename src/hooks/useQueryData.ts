import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, refetchIntervals } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { PatientSource, MonthlyPatients } from '@/lib/database.types';
import { handleSupabaseOperation, errorHandler } from '@/utils/errorUtils';

// Dashboard Data Hook with Background Refetch
export function useDashboardData() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_dashboard_data');
        if (error) throw error;
        
        if (data && data.length > 0 && data[0].summary) {
          const summary = data[0].summary;
          if (typeof summary === 'object' && summary !== null && !Array.isArray(summary)) {
            return (summary as unknown) as any;
          }
        }
        return null;
      } catch (error) {
        await errorHandler.handleError(error, 'useDashboardData');
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for critical dashboard data
    refetchInterval: refetchIntervals.dashboard,
    refetchIntervalInBackground: true,
  });
}

// Office Data Hook with Infinite Query
export function useOfficeData() {
  return useInfiniteQuery({
    queryKey: queryKeys.officeMetrics,
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = 20;
      const startIndex = pageParam * pageSize;
      const endIndex = startIndex + pageSize - 1;

      try {
        // For RPC functions, we handle pagination client-side for now
        const { data, error } = await supabase.rpc('get_office_data_with_relations');
        if (error) throw error;

        const allData = (data || []) as any[];
        const totalCount = allData.length;
        const paginatedData = allData.slice(startIndex, startIndex + pageSize);

        return {
          data: paginatedData,
          nextPage: endIndex < totalCount - 1 ? pageParam + 1 : undefined,
          totalCount,
        };
      } catch (error) {
        await errorHandler.handleError(error, 'useOfficeData');
        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: true,
  });
}

// Sources Data Hook with Infinite Query
export function useSourcesData(filters?: any) {
  return useInfiniteQuery({
    queryKey: queryKeys.sourcesList(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = 20;
      const startIndex = pageParam * pageSize;
      const endIndex = startIndex + pageSize - 1;

      try {
        // First get count
        const { count, error: countError } = await supabase
          .from('patient_sources')
          .select('*', { count: 'exact', head: true })
          .order('name');

        if (countError) throw countError;

        // Then get data with range
        const { data, error } = await supabase
          .from('patient_sources')
          .select('*')
          .order('name')
          .range(startIndex, endIndex);

        if (error) throw error;

        return {
          data: data || [],
          nextPage: endIndex < (count || 0) - 1 ? pageParam + 1 : undefined,
          totalCount: count || 0,
        };
      } catch (error) {
        await errorHandler.handleError(error, 'useSourcesData');
        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Marketing Visits Data Hook with Infinite Query
export function useMarketingVisitsData(filters?: any) {
  return useInfiniteQuery({
    queryKey: queryKeys.marketingVisitsList(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = 20;
      const startIndex = pageParam * pageSize;
      const endIndex = startIndex + pageSize - 1;

      // First get count
      const { count, error: countError } = await supabase
        .from('marketing_visits')
        .select('*', { count: 'exact', head: true })
        .order('visit_date', { ascending: false });

      if (countError) throw countError;

      // Then get data with range
      const { data, error } = await supabase
        .from('marketing_visits')
        .select(`
          id,
          office_id,
          visit_date,
          visit_type,
          group_tag,
          contact_person,
          visited,
          rep_name,
          materials_handed_out,
          star_rating,
          follow_up_notes,
          photo_url,
          created_at,
          updated_at,
          user_id,
          clinic_id
        `)
        .order('visit_date', { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;

      return {
        data: data || [],
        nextPage: endIndex < (count || 0) - 1 ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: refetchIntervals.marketingVisits,
    refetchIntervalInBackground: true,
  });
}

// Monthly Patients Data Hook
export function useMonthlyPatientsData() {
  return useQuery({
    queryKey: queryKeys.monthlyPatients,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_patients')
        .select('*');

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: refetchIntervals.monthlyPatients,
    refetchIntervalInBackground: true,
  });
}

// Mutation Hooks with Optimistic Updates

export function useUpdatePatientCount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sourceId, count, yearMonth }: { sourceId: string; count: number; yearMonth: string }) => {
      try {
        const { data, error } = await supabase.rpc('set_patient_count', {
          p_source_id: sourceId,
          p_year_month: yearMonth,
          p_count: count,
        });

        if (error) throw error;
        return data;
      } catch (error) {
        await errorHandler.handleError(error, 'useUpdatePatientCount');
        throw error;
      }
    },
    onMutate: async ({ sourceId, count, yearMonth }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.monthlyPatients });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.monthlyPatients);

      // Optimistically update
      queryClient.setQueryData(queryKeys.monthlyPatients, (old: MonthlyPatients[] | undefined) => {
        if (!old) return old;
        
        const existingIndex = old.findIndex(
          item => item.source_id === sourceId && item.year_month === yearMonth
        );

        if (existingIndex >= 0) {
          // Update existing entry
          const newData = [...old];
          newData[existingIndex] = { ...newData[existingIndex], patient_count: count };
          return newData;
        } else {
          // Add new entry
          return [...old, {
            id: `temp-${Date.now()}`,
            source_id: sourceId,
            year_month: yearMonth,
            patient_count: count,
            user_id: 'current-user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            clinic_id: null,
            last_modified_by: null,
          }];
        }
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.monthlyPatients, context.previousData);
      }
      // Error handling is done in the mutation function, no need for toast here
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Patient count updated successfully",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyPatients });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useCreateMarketingVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (visitData: any) => {
      try {
        const { data, error } = await supabase
          .from('marketing_visits')
          .insert([visitData])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        await errorHandler.handleError(error, 'useCreateMarketingVisit');
        throw error;
      }
    },
    onMutate: async (newVisit) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.marketingVisits });

      // Create optimistic entry
      const optimisticVisit = {
        ...newVisit,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update the first page of infinite query
      queryClient.setQueryData(queryKeys.marketingVisitsList(), (old: any) => {
        if (!old?.pages?.[0]) return old;
        
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: [optimisticVisit, ...old.pages[0].data],
              totalCount: old.pages[0].totalCount + 1,
            },
            ...old.pages.slice(1),
          ],
        };
      });

      return { optimisticVisit };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update
      if (context?.optimisticVisit) {
        queryClient.setQueryData(queryKeys.marketingVisitsList(), (old: any) => {
          if (!old?.pages?.[0]) return old;
          
          return {
            ...old,
            pages: [
              {
                ...old.pages[0],
                data: old.pages[0].data.filter((visit: any) => visit.id !== context.optimisticVisit.id),
                totalCount: old.pages[0].totalCount - 1,
              },
              ...old.pages.slice(1),
            ],
          };
        });
      }
      
      // Error handling is done in the mutation function, no additional toast needed
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Marketing visit created successfully",
      });
    },
    onSettled: () => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: queryKeys.marketingVisits });
    },
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sourceData: Partial<PatientSource>) => {
      try {
        const { data, error } = await supabase
          .from('patient_sources')
          .insert([sourceData as any])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        await errorHandler.handleError(error, 'useCreateSource');
        throw error;
      }
    },
    onMutate: async (newSource) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.sources });

      // Create optimistic entry
      const optimisticSource = {
        ...newSource,
        id: `temp-${Date.now()}`,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update sources list
      queryClient.setQueryData(queryKeys.sourcesList(), (old: any) => {
        if (!old?.pages?.[0]) return old;
        
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: [optimisticSource, ...old.pages[0].data],
              totalCount: old.pages[0].totalCount + 1,
            },
            ...old.pages.slice(1),
          ],
        };
      });

      return { optimisticSource };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update
      if (context?.optimisticSource) {
        queryClient.setQueryData(queryKeys.sourcesList(), (old: any) => {
          if (!old?.pages?.[0]) return old;
          
          return {
            ...old,
            pages: [
              {
                ...old.pages[0],
                data: old.pages[0].data.filter((source: any) => source.id !== context.optimisticSource.id),
                totalCount: old.pages[0].totalCount - 1,
              },
              ...old.pages.slice(1),
            ],
          };
        });
      }
      
      // Error handling is done in the mutation function, no additional toast needed
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Source created successfully",
      });
      
      // Invalidate dashboard to update counts
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
    onSettled: () => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: queryKeys.sources });
    },
  });
}