import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AISettings {
  id?: string;
  communication_style: string;
  competitive_advantages: string[];
  practice_values: string[];
  specialties: string[];
  target_audience?: string;
  brand_voice?: any;
  business_persona?: any;
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          communication_style: data.communication_style || 'professional',
          competitive_advantages: data.competitive_advantages || [],
          practice_values: data.practice_values || [],
          specialties: data.specialties || [],
          target_audience: data.target_audience,
          brand_voice: data.brand_voice,
          business_persona: data.business_persona,
        });
      } else {
        // Create default settings
        const defaultSettings: AISettings = {
          communication_style: 'professional',
          competitive_advantages: [],
          practice_values: [],
          specialties: [],
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AISettings>) => {
    if (!user) throw new Error('User not authenticated');

    const updatedSettings = { ...settings, ...updates };

    try {
      const { data, error } = await supabase
        .from('ai_business_profiles')
        .upsert(
          {
            user_id: user.id,
            communication_style: updatedSettings.communication_style,
            competitive_advantages: updatedSettings.competitive_advantages,
            practice_values: updatedSettings.practice_values,
            specialties: updatedSettings.specialties,
            target_audience: updatedSettings.target_audience,
            brand_voice: updatedSettings.brand_voice,
            last_updated: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select()
        .single();

      if (error) throw error;

      setSettings({
        ...updatedSettings,
        id: data.id,
      });
    } catch (error) {
      console.error('Error updating AI settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}