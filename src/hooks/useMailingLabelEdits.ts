import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MailingLabelEdit {
  id: string;
  office_id: string;
  custom_name?: string | null;
  custom_contact_name?: string | null;
  custom_address1?: string | null;
  custom_address2?: string | null;
  custom_city?: string | null;
  custom_state?: string | null;
  custom_zip?: string | null;
}

export function useMailingLabelEdits() {
  const queryClient = useQueryClient();

  // Fetch all saved label edits
  const { data: edits = [], isLoading } = useQuery({
    queryKey: ['mailing-label-edits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mailing_label_edits')
        .select('*');
      
      if (error) throw error;
      return data as MailingLabelEdit[];
    },
  });

  // Get edit for a specific office
  const getEditForOffice = (officeId: string): MailingLabelEdit | undefined => {
    return edits.find(e => e.office_id === officeId);
  };

  // Save or update label edit
  const saveEditMutation = useMutation({
    mutationFn: async (edit: Omit<MailingLabelEdit, 'id'> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('mailing_label_edits')
        .upsert({
          user_id: user.id,
          office_id: edit.office_id,
          custom_name: edit.custom_name,
          custom_contact_name: edit.custom_contact_name,
          custom_address1: edit.custom_address1,
          custom_address2: edit.custom_address2,
          custom_city: edit.custom_city,
          custom_state: edit.custom_state,
          custom_zip: edit.custom_zip,
        }, {
          onConflict: 'user_id,office_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailing-label-edits'] });
    },
    onError: () => {
      toast.error('Failed to save label edit');
    },
  });

  // Save multiple edits at once
  const saveBulkEditsMutation = useMutation({
    mutationFn: async (editsList: Array<Omit<MailingLabelEdit, 'id'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const editsWithUser = editsList.map(edit => ({
        user_id: user.id,
        office_id: edit.office_id,
        custom_name: edit.custom_name,
        custom_contact_name: edit.custom_contact_name,
        custom_address1: edit.custom_address1,
        custom_address2: edit.custom_address2,
        custom_city: edit.custom_city,
        custom_state: edit.custom_state,
        custom_zip: edit.custom_zip,
      }));

      const { error } = await supabase
        .from('mailing_label_edits')
        .upsert(editsWithUser, {
          onConflict: 'user_id,office_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailing-label-edits'] });
      toast.success('Label edits saved');
    },
    onError: () => {
      toast.error('Failed to save label edits');
    },
  });

  // Delete edit
  const deleteEditMutation = useMutation({
    mutationFn: async (officeId: string) => {
      const { error } = await supabase
        .from('mailing_label_edits')
        .delete()
        .eq('office_id', officeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailing-label-edits'] });
    },
  });

  return {
    edits,
    isLoading,
    getEditForOffice,
    saveEdit: saveEditMutation.mutate,
    saveBulkEdits: saveBulkEditsMutation.mutate,
    deleteEdit: deleteEditMutation.mutate,
    isSaving: saveEditMutation.isPending || saveBulkEditsMutation.isPending,
  };
}
