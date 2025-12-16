import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CampaignTemplate {
  id: string;
  name: string;
  campaign_type: string;
  delivery_method: string;
  target_tiers?: string[] | null;
  email_subject_template?: string | null;
  email_body_template?: string | null;
  gift_bundle?: Record<string, any> | null;
  materials_checklist?: string[] | null;
  notes?: string | null;
  created_at: string;
}

export function useCampaignTemplates() {
  const queryClient = useQueryClient();

  // Fetch all templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['campaign-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as CampaignTemplate[];
    },
  });

  // Create template
  const createTemplateMutation = useMutation({
    mutationFn: async (template: Omit<CampaignTemplate, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('campaign_templates')
        .insert({
          user_id: user.id,
          name: template.name,
          campaign_type: template.campaign_type,
          delivery_method: template.delivery_method,
          target_tiers: template.target_tiers,
          email_subject_template: template.email_subject_template,
          email_body_template: template.email_body_template,
          gift_bundle: template.gift_bundle,
          materials_checklist: template.materials_checklist,
          notes: template.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-templates'] });
      toast.success('Template saved');
    },
    onError: () => {
      toast.error('Failed to save template');
    },
  });

  // Update template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaign_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-templates'] });
      toast.success('Template updated');
    },
    onError: () => {
      toast.error('Failed to update template');
    },
  });

  // Delete template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('campaign_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-templates'] });
      toast.success('Template deleted');
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  return {
    templates,
    isLoading,
    createTemplate: createTemplateMutation.mutate,
    updateTemplate: updateTemplateMutation.mutate,
    deleteTemplate: deleteTemplateMutation.mutate,
    isCreating: createTemplateMutation.isPending,
  };
}
