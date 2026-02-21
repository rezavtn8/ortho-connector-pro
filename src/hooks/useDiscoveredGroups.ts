import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface DiscoveredGroup {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export function useDiscoveredGroups() {
  const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('discovered_office_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts
      if (data && data.length > 0) {
        const { data: members, error: membersError } = await supabase
          .from('discovered_office_group_members')
          .select('group_id')
          .in('group_id', data.map(g => g.id));

        if (!membersError && members) {
          const counts: Record<string, number> = {};
          members.forEach(m => {
            counts[m.group_id] = (counts[m.group_id] || 0) + 1;
          });
          setGroups(data.map(g => ({ ...g, member_count: counts[g.id] || 0 })));
        } else {
          setGroups(data.map(g => ({ ...g, member_count: 0 })));
        }
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const createGroup = async (name: string, officeIds: string[]): Promise<DiscoveredGroup | null> => {
    if (!user) return null;
    try {
      const { data: group, error } = await supabase
        .from('discovered_office_groups')
        .insert({ name, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      if (officeIds.length > 0) {
        const members = officeIds.map(office_id => ({
          group_id: group.id,
          office_id,
        }));
        const { error: memberError } = await supabase
          .from('discovered_office_group_members')
          .insert(members);
        if (memberError) throw memberError;
      }

      toast({ title: 'Group Created', description: `"${name}" with ${officeIds.length} offices` });
      await loadGroups();
      return { ...group, member_count: officeIds.length };
    } catch (error) {
      console.error('Error creating group:', error);
      toast({ title: 'Error', description: 'Failed to create group', variant: 'destructive' });
      return null;
    }
  };

  const addToGroup = async (groupId: string, officeIds: string[]) => {
    try {
      const members = officeIds.map(office_id => ({ group_id: groupId, office_id }));
      const { error } = await supabase
        .from('discovered_office_group_members')
        .upsert(members, { onConflict: 'group_id,office_id' });
      if (error) throw error;
      toast({ title: 'Added', description: `${officeIds.length} office(s) added to group` });
      await loadGroups();
    } catch (error) {
      console.error('Error adding to group:', error);
      toast({ title: 'Error', description: 'Failed to add offices to group', variant: 'destructive' });
    }
  };

  const removeFromGroup = async (groupId: string, officeIds: string[]) => {
    try {
      const { error } = await supabase
        .from('discovered_office_group_members')
        .delete()
        .eq('group_id', groupId)
        .in('office_id', officeIds);
      if (error) throw error;
      await loadGroups();
    } catch (error) {
      console.error('Error removing from group:', error);
    }
  };

  const renameGroup = async (groupId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('discovered_office_groups')
        .update({ name: newName })
        .eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Renamed', description: `Group renamed to "${newName}"` });
      await loadGroups();
    } catch (error) {
      console.error('Error renaming group:', error);
      toast({ title: 'Error', description: 'Failed to rename group', variant: 'destructive' });
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('discovered_office_groups')
        .delete()
        .eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Group has been deleted' });
      await loadGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({ title: 'Error', description: 'Failed to delete group', variant: 'destructive' });
    }
  };

  const getGroupMemberIds = async (groupId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('discovered_office_group_members')
        .select('office_id')
        .eq('group_id', groupId);
      if (error) throw error;
      return data?.map(m => m.office_id) || [];
    } catch (error) {
      console.error('Error getting group members:', error);
      return [];
    }
  };

  return {
    groups,
    isLoading,
    loadGroups,
    createGroup,
    addToGroup,
    removeFromGroup,
    renameGroup,
    deleteGroup,
    getGroupMemberIds,
  };
}
