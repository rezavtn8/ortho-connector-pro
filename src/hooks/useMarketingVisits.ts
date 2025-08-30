import { useState, useEffect } from 'react';
import { MarketingVisit } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useMarketingVisits(officeId: string) {
  const { userProfile } = useAuth();
  const [visits, setVisits] = useState<MarketingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (officeId) {
      loadVisits();
    }
  }, [officeId]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('office_id', officeId)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error('Error loading visits:', error);
      toast({
        title: "Error",
        description: "Failed to load marketing visits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveVisit = async (visitData: Partial<MarketingVisit>) => {
    try {
      setIsSubmitting(true);
      
      if (visitData.id) {
        // Update existing visit
        const { data, error } = await supabase
          .from('marketing_visits')
          .update(visitData)
          .eq('id', visitData.id)
          .select()
          .single();

        if (error) throw error;
        
        setVisits(prev => prev.map(v => v.id === visitData.id ? data : v));
        toast({
          title: "Success",
          description: "Visit updated successfully",
        });
      } else {
        // Create new visit
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('User not authenticated');

        // Ensure all required fields are present for insert
        const insertData = {
          clinic_id: userProfile?.clinic_id || '',
          office_id: visitData.office_id || officeId,
          visit_date: visitData.visit_date || new Date().toISOString().split('T')[0],
          visit_type: visitData.visit_type || 'New Target',
          rep_name: visitData.rep_name || '',
          visited: visitData.visited || false,
          materials_handed_out: visitData.materials_handed_out || [],
          user_id: userData.user.id,
          group_tag: visitData.group_tag,
          contact_person: visitData.contact_person,
          star_rating: visitData.star_rating,
          follow_up_notes: visitData.follow_up_notes,
          photo_url: visitData.photo_url,
        };

        const { data, error } = await supabase
          .from('marketing_visits')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        
        setVisits(prev => [data, ...prev]);
        toast({
          title: "Success",
          description: "Visit saved successfully",
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error saving visit:', error);
      toast({
        title: "Error",
        description: "Failed to save visit",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('marketing_visits')
        .delete()
        .eq('id', visitId);

      if (error) throw error;
      
      setVisits(prev => prev.filter(v => v.id !== visitId));
      toast({
        title: "Success",
        description: "Visit deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting visit:', error);
      toast({
        title: "Error",
        description: "Failed to delete visit",
        variant: "destructive",
      });
    }
  };

  // Helper function to check if office hasn't been visited in 3+ months
  const needsAttention = () => {
    if (visits.length === 0) return true;
    
    const completedVisits = visits.filter(v => v.visited);
    if (completedVisits.length === 0) return true;
    
    const lastVisit = new Date(completedVisits[0].visit_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return lastVisit < threeMonthsAgo;
  };

  // Get visit statistics
  const getVisitStats = () => {
    const total = visits.length;
    const completed = visits.filter(v => v.visited).length;
    const avgRating = visits.filter(v => v.star_rating).length > 0
      ? visits.reduce((sum, v) => sum + (v.star_rating || 0), 0) / visits.filter(v => v.star_rating).length
      : 0;
    
    return {
      total,
      completed,
      avgRating: Math.round(avgRating * 10) / 10,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  return {
    visits,
    loading,
    isSubmitting,
    saveVisit,
    deleteVisit,
    needsAttention,
    getVisitStats,
    refetch: loadVisits,
  };
}