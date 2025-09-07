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
        if (error) {
          console.warn('Dashboard RPC failed, using fallback data:', error);
          
          // Fallback: get basic source counts
          const { data: sources, error: sourcesError } = await supabase
            .from('patient_sources')
            .select('source_type');
            
          if (sourcesError) throw sourcesError;
          
          // Return minimal dashboard data
          return {
            user_id: 'current-user',
            source_groups: [],
            monthly_trends: []
          };
        }
        
        if (data && data.length > 0 && data[0].summary) {
          const summary = data[0].summary;
          if (typeof summary === 'object' && summary !== null && !Array.isArray(summary)) {
            return (summary as unknown) as any;
          }
        }
        
        // Return fallback empty data structure
        return {
          user_id: 'current-user',
          source_groups: [],
          monthly_trends: []
        };
      } catch (error) {
        console.error('useDashboardData error:', error);
        
        // Return empty data instead of throwing
        return {
          user_id: 'current-user',
          source_groups: [],
          monthly_trends: []
        };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for critical dashboard data
    refetchInterval: refetchIntervals.dashboard,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
        // Use direct query instead of broken RPC function
        const { data, error } = await supabase
          .from('patient_sources')
          .select(`
            *,
            source_tags!inner(
              id,
              tag_name,
              created_at
            ),
            monthly_patients!inner(
              id,
              year_month,
              patient_count,
              created_at,
              updated_at
            )
          `)
          .range(startIndex, endIndex);
          
        if (error) {
          console.warn('Office data query failed, using fallback:', error);
          
          // Fallback to basic patient sources query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('patient_sources')
            .select('*')
            .range(startIndex, endIndex);
            
          if (fallbackError) throw fallbackError;
          
          const processedData = (fallbackData || []).map(source => ({
            ...source,
            tags: [],
            monthly_data: []
          }));
          
          return {
            data: processedData,
            nextPage: endIndex < processedData.length + startIndex ? pageParam + 1 : undefined,
            totalCount: processedData.length,
          };
        }

        const allData = (data || []) as any[];
        const totalCount = allData.length;
        const paginatedData = allData.slice(0, pageSize);

        return {
          data: paginatedData,
          nextPage: endIndex < totalCount - 1 ? pageParam + 1 : undefined,
          totalCount,
        };
      } catch (error) {
        console.error('useOfficeData error:', error);
        
        // Return empty data instead of throwing to prevent app crash
        return {
          data: [],
          nextPage: undefined,
          totalCount: 0,
        };
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
        console.error('useSourcesData error:', error);
        
        // Return empty data instead of throwing
        return {
          data: [],
          nextPage: undefined,
          totalCount: 0,
        };
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
      try {
        const { data, error } = await supabase
          .from('monthly_patients')
          .select('*');

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('useMonthlyPatientsData error:', error);
        
        // Return empty array instead of throwing
        return [];
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: refetchIntervals.monthlyPatients,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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

// Campaign Mutations with Optimistic Updates

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ campaignData, deliveries }: { 
      campaignData: any, 
      deliveries: Array<{ office_id: string }> 
    }) => {
      try {
        // Create campaign
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert([campaignData])
          .select()
          .single();

        if (campaignError) throw campaignError;

        // Create campaign deliveries
        const deliveriesWithCampaignId = deliveries.map(delivery => ({
          ...delivery,
          campaign_id: campaign.id,
          created_by: campaignData.created_by
        }));

        const { data: createdDeliveries, error: deliveriesError } = await supabase
          .from('campaign_deliveries')
          .insert(deliveriesWithCampaignId)
          .select();

        if (deliveriesError) throw deliveriesError;

        return { campaign, deliveries: createdDeliveries };
      } catch (error) {
        await errorHandler.handleError(error, 'useCreateCampaign');
        throw error;
      }
    },
    onMutate: async ({ campaignData, deliveries }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns });

      // Create optimistic campaign entry
      const optimisticCampaign = {
        ...campaignData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'Draft',
      };

      // Optimistically update campaigns list
      queryClient.setQueryData(queryKeys.campaignsList(), (old: any) => {
        if (!old?.pages?.[0]) return old;
        
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: [optimisticCampaign, ...old.pages[0].data],
              totalCount: old.pages[0].totalCount + 1,
            },
            ...old.pages.slice(1),
          ],
        };
      });

      return { optimisticCampaign };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update
      if (context?.optimisticCampaign) {
        queryClient.setQueryData(queryKeys.campaignsList(), (old: any) => {
          if (!old?.pages?.[0]) return old;
          
          return {
            ...old,
            pages: [
              {
                ...old.pages[0],
                data: old.pages[0].data.filter((campaign: any) => campaign.id !== context.optimisticCampaign.id),
                totalCount: old.pages[0].totalCount - 1,
              },
              ...old.pages.slice(1),
            ],
          };
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onSettled: () => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

export function useUpdateCampaignDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ deliveryId, updateData }: { deliveryId: string, updateData: any }) => {
      try {
        const { data, error } = await supabase
          .from('campaign_deliveries')
          .update(updateData)
          .eq('id', deliveryId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        await errorHandler.handleError(error, 'useUpdateCampaignDelivery');
        throw error;
      }
    },
    onMutate: async ({ deliveryId, updateData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.campaignDeliveries });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.campaignDeliveries);

      // Optimistically update delivery
      queryClient.setQueryData(queryKeys.campaignDeliveries, (old: any) => {
        if (!old?.pages) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((delivery: any) => 
              delivery.id === deliveryId 
                ? { ...delivery, ...updateData, updated_at: new Date().toISOString() }
                : delivery
            )
          }))
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.campaignDeliveries, context.previousData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Delivery status updated successfully",
      });
    },
    onSettled: () => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignDeliveries });
    },
  });
}