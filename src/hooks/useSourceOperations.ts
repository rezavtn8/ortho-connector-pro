import { useState } from 'react';
import { PatientSource } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSourceOperations = (onDataChange: () => void) => {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PatientSource>>({});
  const { toast } = useToast();

  const handleSelectAll = (sources: PatientSource[], checked: boolean) => {
    const sourceIds = sources.map(s => s.id);
    if (checked) {
      setSelectedSources(prev => [...new Set([...prev, ...sourceIds])]);
    } else {
      setSelectedSources(prev => prev.filter(id => !sourceIds.includes(id)));
    }
  };

  const handleSelectSource = (sourceId: string, checked: boolean) => {
    if (checked) {
      setSelectedSources(prev => [...prev, sourceId]);
    } else {
      setSelectedSources(prev => prev.filter(id => id !== sourceId));
    }
  };

  const handleEditSource = (source: PatientSource) => {
    setEditingSource(source.id);
    setEditForm(source);
  };

  const handleSaveEdit = async () => {
    if (!editingSource || !editForm.name) return;

    try {
      const updateData: Partial<PatientSource> = {
        name: editForm.name,
        source_type: editForm.source_type,
      };

      if (editForm.address !== undefined) {
        updateData.address = editForm.address || null;
      }

      const { error } = await supabase
        .from('patient_sources')
        .update(updateData)
        .eq('id', editingSource);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Source updated successfully",
      });

      setEditingSource(null);
      setEditForm({});
      onDataChange();
    } catch (error) {
      console.error('Error updating source:', error);
      toast({
        title: "Error",
        description: "Failed to update source",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditForm({});
  };

  const handleDeleteSources = async (sourceIds: string[]) => {
    if (sourceIds.length === 0) return;

    const confirmMessage = sourceIds.length === 1 
      ? "Are you sure you want to delete this source?"
      : `Are you sure you want to delete ${sourceIds.length} sources?`;

    if (!confirm(confirmMessage)) return;

    try {
      // Delete monthly data first
      const { error: monthlyError } = await supabase
        .from('monthly_patients')
        .delete()
        .in('source_id', sourceIds);

      if (monthlyError) throw monthlyError;

      // Delete source tags
      const { error: tagsError } = await supabase
        .from('source_tags')
        .delete()
        .in('source_id', sourceIds);

      if (tagsError) throw tagsError;

      // Delete change logs
      const { error: logsError } = await supabase
        .from('patient_changes_log')
        .delete()
        .in('source_id', sourceIds);

      if (logsError) throw logsError;

      // Get source names before deletion for logging
      const { data: sourcesToDelete } = await supabase
        .from('patient_sources')
        .select('id, name')
        .in('id', sourceIds);

      // Finally delete sources
      const { error: sourcesError } = await supabase
        .from('patient_sources')  
        .delete()
        .in('id', sourceIds);

      if (sourcesError) throw sourcesError;

      // Log each deletion
      if (sourcesToDelete) {
        for (const source of sourcesToDelete) {
          await supabase.rpc('log_activity', {
            p_action_type: 'source_deleted',
            p_resource_type: 'source',
            p_resource_id: source.id,
            p_resource_name: source.name,
            p_details: {
              method: 'bulk_delete',
              total_deleted: sourceIds.length
            }
          });
        }
      }

      toast({
        title: "Success",
        description: `${sourceIds.length} source(s) deleted successfully`,
      });

      setSelectedSources([]);
      onDataChange();
    } catch (error) {
      console.error('Error deleting sources:', error);
      toast({
        title: "Error",
        description: "Failed to delete sources",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (sourceId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({ is_active: isActive })
        .eq('id', sourceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Source ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      onDataChange();
    } catch (error) {
      console.error('Error updating source status:', error);
      toast({
        title: "Error",
        description: "Failed to update source status",
        variant: "destructive",
      });
    }
  };

  return {
    selectedSources,
    editingSource,
    editForm,
    setEditForm,
    handleSelectAll,
    handleSelectSource,
    handleEditSource,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteSources,
    handleToggleActive
  };
};