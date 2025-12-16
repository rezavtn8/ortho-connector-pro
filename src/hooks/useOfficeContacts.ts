import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OfficeContact {
  id: string;
  office_id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
  notes?: string | null;
  birthday?: string | null;
  created_at: string;
}

export function useOfficeContacts(officeId?: string) {
  const queryClient = useQueryClient();

  // Fetch contacts for an office
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['office-contacts', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('office_contacts')
        .select('*')
        .eq('office_id', officeId)
        .order('is_primary', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as OfficeContact[];
    },
    enabled: !!officeId,
  });

  // Add contact
  const addContactMutation = useMutation({
    mutationFn: async (contact: {
      office_id: string;
      name: string;
      role?: string;
      email?: string;
      phone?: string;
      is_primary?: boolean;
      notes?: string;
      birthday?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // If setting as primary, unset other primary contacts
      if (contact.is_primary) {
        await supabase
          .from('office_contacts')
          .update({ is_primary: false })
          .eq('office_id', contact.office_id);
      }

      const { data, error } = await supabase
        .from('office_contacts')
        .insert({
          user_id: user.id,
          office_id: contact.office_id,
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          is_primary: contact.is_primary || false,
          notes: contact.notes,
          birthday: contact.birthday,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['office-contacts', variables.office_id] });
      toast.success('Contact added');
    },
    onError: () => {
      toast.error('Failed to add contact');
    },
  });

  // Update contact
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OfficeContact> & { id: string }) => {
      // If setting as primary, unset other primary contacts
      if (updates.is_primary && officeId) {
        await supabase
          .from('office_contacts')
          .update({ is_primary: false })
          .eq('office_id', officeId)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('office_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-contacts', officeId] });
      toast.success('Contact updated');
    },
    onError: () => {
      toast.error('Failed to update contact');
    },
  });

  // Delete contact
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('office_contacts')
        .delete()
        .eq('id', contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-contacts', officeId] });
      toast.success('Contact deleted');
    },
    onError: () => {
      toast.error('Failed to delete contact');
    },
  });

  // Get primary contact
  const primaryContact = contacts.find(c => c.is_primary);

  return {
    contacts,
    primaryContact,
    isLoading,
    addContact: addContactMutation.mutate,
    updateContact: updateContactMutation.mutate,
    deleteContact: deleteContactMutation.mutate,
    isAdding: addContactMutation.isPending,
  };
}
