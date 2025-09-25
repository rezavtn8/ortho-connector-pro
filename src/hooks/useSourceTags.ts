import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSourceTags = (sourceId: string | undefined, sourceName: string | undefined, onDataChange: () => void) => {
  const [newTag, setNewTag] = useState('');
  const { toast } = useToast();

  const addTag = async () => {
    if (!newTag.trim() || !sourceId) return;

    try {
      const { error } = await supabase
        .from('source_tags')
        .insert([{
          source_id: sourceId,
          tag_name: newTag.trim(),
          user_id: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'tag_added',
        p_resource_type: 'tag',
        p_resource_id: null,
        p_resource_name: newTag.trim(),
        p_details: {
          source_id: sourceId,
          source_name: sourceName,
          tag_name: newTag.trim()
        }
      });

      setNewTag('');
      await onDataChange();

      toast({
        title: "Tag Added",
        description: `Tag "${newTag}" has been added`,
      });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('source_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'tag_removed',
        p_resource_type: 'tag',
        p_resource_id: null,
        p_resource_name: 'Source Tag',
        p_details: {
          source_id: sourceId,
          source_name: sourceName,
          tag_id: tagId
        }
      });

      await onDataChange();

      toast({
        title: "Tag Removed",
        description: "Tag has been removed",
      });
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive",
      });
    }
  };

  return {
    newTag,
    setNewTag,
    addTag,
    removeTag
  };
};