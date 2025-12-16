import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OfficeTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagAssignment {
  id: string;
  office_id: string;
  tag_id: string;
  assigned_at: string;
}

export function useOfficeTags() {
  const queryClient = useQueryClient();

  // Fetch all tags for the current user
  const { data: tags = [], isLoading: isLoadingTags, error: tagsError } = useQuery({
    queryKey: ['office-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_tags')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as OfficeTag[];
    },
  });

  // Fetch all tag assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['office-tag-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_tag_assignments')
        .select('*');
      
      if (error) throw error;
      return data as TagAssignment[];
    },
  });

  // Create a new tag
  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('office_tags')
        .insert({ name, color, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-tags'] });
      toast.success('Tag created');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('A tag with this name already exists');
      } else {
        toast.error('Failed to create tag');
      }
    },
  });

  // Update a tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { data, error } = await supabase
        .from('office_tags')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-tags'] });
      toast.success('Tag updated');
    },
    onError: () => {
      toast.error('Failed to update tag');
    },
  });

  // Delete a tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('office_tags')
        .delete()
        .eq('id', tagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-tags'] });
      queryClient.invalidateQueries({ queryKey: ['office-tag-assignments'] });
      toast.success('Tag deleted');
    },
    onError: () => {
      toast.error('Failed to delete tag');
    },
  });

  // Assign tags to offices (bulk)
  const assignTagsMutation = useMutation({
    mutationFn: async ({ officeIds, tagIds }: { officeIds: string[]; tagIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create all assignments
      const assignments = officeIds.flatMap(officeId =>
        tagIds.map(tagId => ({
          office_id: officeId,
          tag_id: tagId,
          assigned_by: user.id,
        }))
      );

      const { error } = await supabase
        .from('office_tag_assignments')
        .upsert(assignments, { onConflict: 'office_id,tag_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-tag-assignments'] });
      toast.success('Tags assigned');
    },
    onError: () => {
      toast.error('Failed to assign tags');
    },
  });

  // Remove tag from offices
  const removeTagsMutation = useMutation({
    mutationFn: async ({ officeIds, tagIds }: { officeIds: string[]; tagIds: string[] }) => {
      const { error } = await supabase
        .from('office_tag_assignments')
        .delete()
        .in('office_id', officeIds)
        .in('tag_id', tagIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-tag-assignments'] });
      toast.success('Tags removed');
    },
    onError: () => {
      toast.error('Failed to remove tags');
    },
  });

  // Get tags for a specific office
  const getTagsForOffice = useCallback((officeId: string): OfficeTag[] => {
    const officeTagIds = assignments
      .filter(a => a.office_id === officeId)
      .map(a => a.tag_id);
    return tags.filter(t => officeTagIds.includes(t.id));
  }, [tags, assignments]);

  // Get offices with a specific tag
  const getOfficesWithTag = useCallback((tagId: string): string[] => {
    return assignments
      .filter(a => a.tag_id === tagId)
      .map(a => a.office_id);
  }, [assignments]);

  return {
    tags,
    assignments,
    isLoading: isLoadingTags || isLoadingAssignments,
    error: tagsError,
    createTag: createTagMutation.mutate,
    updateTag: updateTagMutation.mutate,
    deleteTag: deleteTagMutation.mutate,
    assignTags: assignTagsMutation.mutate,
    removeTags: removeTagsMutation.mutate,
    getTagsForOffice,
    getOfficesWithTag,
    isCreating: createTagMutation.isPending,
    isAssigning: assignTagsMutation.isPending,
  };
}
