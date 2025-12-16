import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OfficeInteraction {
  id: string;
  office_id: string;
  interaction_type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

export function useOfficeInteractions(officeId?: string) {
  const queryClient = useQueryClient();

  // Fetch interactions for an office
  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['office-interactions', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('office_interactions')
        .select('*')
        .eq('office_id', officeId)
        .order('occurred_at', { ascending: false });
      
      if (error) throw error;
      return data as OfficeInteraction[];
    },
    enabled: !!officeId,
  });

  // Add interaction
  const addInteractionMutation = useMutation({
    mutationFn: async (interaction: {
      office_id: string;
      interaction_type: string;
      title: string;
      description?: string;
      metadata?: Record<string, any>;
      occurred_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('office_interactions')
        .insert({
          user_id: user.id,
          office_id: interaction.office_id,
          interaction_type: interaction.interaction_type,
          title: interaction.title,
          description: interaction.description,
          metadata: interaction.metadata || {},
          occurred_at: interaction.occurred_at || new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['office-interactions', variables.office_id] });
    },
    onError: () => {
      toast.error('Failed to log interaction');
    },
  });

  // Delete interaction
  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      const { error } = await supabase
        .from('office_interactions')
        .delete()
        .eq('id', interactionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-interactions', officeId] });
      toast.success('Interaction deleted');
    },
    onError: () => {
      toast.error('Failed to delete interaction');
    },
  });

  return {
    interactions,
    isLoading,
    addInteraction: addInteractionMutation.mutate,
    deleteInteraction: deleteInteractionMutation.mutate,
    isAdding: addInteractionMutation.isPending,
  };
}

// Helper to log common interactions
export function useLogInteraction() {
  const { addInteraction } = useOfficeInteractions();

  const logCampaignSent = (officeId: string, campaignName: string, campaignType: string) => {
    addInteraction({
      office_id: officeId,
      interaction_type: 'campaign',
      title: `Campaign: ${campaignName}`,
      description: `${campaignType} campaign sent`,
      metadata: { campaign_type: campaignType },
    });
  };

  const logVisitScheduled = (officeId: string, visitDate: string, repName: string) => {
    addInteraction({
      office_id: officeId,
      interaction_type: 'visit',
      title: `Visit scheduled`,
      description: `Marketing visit scheduled for ${visitDate}`,
      metadata: { rep_name: repName, visit_date: visitDate },
    });
  };

  const logReferralReceived = (officeId: string, count: number, month: string) => {
    addInteraction({
      office_id: officeId,
      interaction_type: 'referral',
      title: `${count} referral${count > 1 ? 's' : ''} received`,
      description: `New referrals for ${month}`,
      metadata: { count, month },
    });
  };

  const logNote = (officeId: string, note: string) => {
    addInteraction({
      office_id: officeId,
      interaction_type: 'note',
      title: 'Note added',
      description: note,
    });
  };

  const logCall = (officeId: string, contactName: string, outcome?: string) => {
    addInteraction({
      office_id: officeId,
      interaction_type: 'call',
      title: `Call with ${contactName}`,
      description: outcome || 'Phone call logged',
      metadata: { contact_name: contactName },
    });
  };

  return {
    logCampaignSent,
    logVisitScheduled,
    logReferralReceived,
    logNote,
    logCall,
  };
}
