import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type EmailType = 'outreach' | 'follow_up' | 'thank_you' | 're_engagement' | 'holiday' | 'custom';
export type EmailStatus = 'draft' | 'sent' | 'replied';

export interface OfficeEmail {
  id: string;
  user_id: string;
  office_id: string;
  contact_id?: string | null;
  recipient_email?: string | null;
  subject: string;
  body: string;
  email_type: EmailType;
  status: EmailStatus;
  is_ai_generated: boolean;
  ai_content_id?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailInput {
  office_id: string;
  contact_id?: string | null;
  recipient_email?: string | null;
  subject: string;
  body: string;
  email_type: EmailType;
  status?: EmailStatus;
  is_ai_generated?: boolean;
  ai_content_id?: string | null;
}

export interface UpdateEmailInput {
  id: string;
  subject?: string;
  body?: string;
  email_type?: EmailType;
  status?: EmailStatus;
  recipient_email?: string | null;
  sent_at?: string | null;
}

export function useOfficeEmails(officeId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: emails = [], isLoading, error } = useQuery({
    queryKey: ['office-emails', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('office_emails')
        .select('*')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OfficeEmail[];
    },
    enabled: !!officeId,
  });

  const addEmailMutation = useMutation({
    mutationFn: async (input: CreateEmailInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('office_emails')
        .insert({
          ...input,
          user_id: user.id,
          status: input.status || 'draft',
          is_ai_generated: input.is_ai_generated || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OfficeEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-emails', officeId] });
      toast({
        title: 'Email saved',
        description: 'Your email has been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save email',
        variant: 'destructive',
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (input: UpdateEmailInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('office_emails')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OfficeEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-emails', officeId] });
      toast({
        title: 'Email updated',
        description: 'Your email has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update email',
        variant: 'destructive',
      });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from('office_emails')
        .delete()
        .eq('id', emailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-emails', officeId] });
      toast({
        title: 'Email deleted',
        description: 'Your email has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete email',
        variant: 'destructive',
      });
    },
  });

  const markAsSentMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { data, error } = await supabase
        .from('office_emails')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', emailId)
        .select()
        .single();

      if (error) throw error;
      return data as OfficeEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-emails', officeId] });
      toast({
        title: 'Email marked as sent',
        description: 'The email has been marked as sent.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark email as sent',
        variant: 'destructive',
      });
    },
  });

  return {
    emails,
    isLoading,
    error,
    addEmail: addEmailMutation.mutate,
    updateEmail: updateEmailMutation.mutate,
    deleteEmail: deleteEmailMutation.mutate,
    markAsSent: markAsSentMutation.mutate,
    isAdding: addEmailMutation.isPending,
    isUpdating: updateEmailMutation.isPending,
    isDeleting: deleteEmailMutation.isPending,
  };
}

// Export function for exporting email history
export function exportEmailsToCSV(emails: OfficeEmail[], officeName: string) {
  const headers = ['Date', 'Subject', 'Type', 'Status', 'Recipient', 'AI Generated'];
  const rows = emails.map(email => [
    new Date(email.created_at).toLocaleDateString(),
    `"${email.subject.replace(/"/g, '""')}"`,
    email.email_type,
    email.status,
    email.recipient_email || '',
    email.is_ai_generated ? 'Yes' : 'No',
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${officeName.replace(/[^a-z0-9]/gi, '_')}_emails_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// Export function for office contacts
export async function exportOfficeContactsToCSV(officeIds?: string[]) {
  let query = supabase
    .from('patient_sources')
    .select(`
      id,
      name,
      address,
      phone,
      email,
      office_contacts (
        name,
        email,
        phone,
        role,
        is_primary
      )
    `)
    .eq('source_type', 'Office')
    .eq('is_active', true);

  if (officeIds && officeIds.length > 0) {
    query = query.in('id', officeIds);
  }

  const { data: offices, error } = await query;

  if (error) throw error;

  const headers = ['Office Name', 'Address', 'Office Phone', 'Office Email', 'Contact Name', 'Contact Role', 'Contact Email', 'Contact Phone', 'Primary Contact'];
  const rows: string[][] = [];

  offices?.forEach((office: any) => {
    if (office.office_contacts && office.office_contacts.length > 0) {
      office.office_contacts.forEach((contact: any) => {
        rows.push([
          `"${(office.name || '').replace(/"/g, '""')}"`,
          `"${(office.address || '').replace(/"/g, '""')}"`,
          office.phone || '',
          office.email || '',
          `"${(contact.name || '').replace(/"/g, '""')}"`,
          contact.role || '',
          contact.email || '',
          contact.phone || '',
          contact.is_primary ? 'Yes' : 'No',
        ]);
      });
    } else {
      rows.push([
        `"${(office.name || '').replace(/"/g, '""')}"`,
        `"${(office.address || '').replace(/"/g, '""')}"`,
        office.phone || '',
        office.email || '',
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `office_contacts_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  return offices?.length || 0;
}
