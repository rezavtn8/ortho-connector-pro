import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface BrandSettings {
  id?: string;
  clinic_id?: string;
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  brand_name?: string;
  tagline?: string;
  font_family: string;
  website_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  social_links: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  custom_css?: string;
  brand_voice?: string;
}

const defaultBrandSettings: BrandSettings = {
  primary_color: '262.1 83.3% 57.8%',
  secondary_color: '252 40% 50%',
  accent_color: '262.1 83.3% 57.8%',
  background_color: '0 0% 100%',
  foreground_color: '222.2 84% 4.9%',
  font_family: 'system-ui',
  social_links: {},
};

export const useBrandSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BrandSettings>(defaultBrandSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get user's clinic_id
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.clinic_id) {
        // Get clinic info for fallback
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('name, logo_url')
          .eq('id', profile.clinic_id)
          .single();

        // Get brand settings
        const { data: brandData, error: brandError } = await supabase
          .from('clinic_brand_settings')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .maybeSingle();

        if (brandError && brandError.code !== 'PGRST116') throw brandError;

        if (brandData) {
          setSettings({
            ...defaultBrandSettings,
            ...brandData,
            // Use clinic name as fallback if brand_name is not set
            brand_name: brandData.brand_name || clinicData?.name || '',
            logo_url: brandData.logo_url || clinicData?.logo_url || '',
            social_links: (brandData.social_links as any) || {},
          });
        } else {
          // Create default settings with clinic name
          const { data: newSettings, error: createError } = await supabase
            .from('clinic_brand_settings')
            .insert({
              clinic_id: profile.clinic_id,
              ...defaultBrandSettings,
              brand_name: clinicData?.name || '',
              logo_url: clinicData?.logo_url || '',
              created_by: user.id,
            })
            .select()
            .single();

          if (createError) throw createError;
          setSettings({ 
            ...defaultBrandSettings, 
            ...newSettings,
            brand_name: newSettings.brand_name || clinicData?.name || '',
            logo_url: newSettings.logo_url || clinicData?.logo_url || '',
            social_links: (newSettings.social_links as any) || {},
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching brand settings:', error);
      toast({
        title: 'Warning',
        description: 'Could not load brand settings. Using defaults.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<BrandSettings>) => {
    if (!user?.id || !settings.clinic_id) {
      toast({
        title: 'Error',
        description: 'Cannot update settings without a clinic',
        variant: 'destructive',
      });
      return false;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clinic_brand_settings')
        .update(updates)
        .eq('clinic_id', settings.clinic_id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
      
      toast({
        title: 'Success',
        description: 'Brand settings updated successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error updating brand settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update brand settings',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyBrandColors = () => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--secondary', settings.secondary_color);
    root.style.setProperty('--accent', settings.accent_color);
    root.style.setProperty('--background', settings.background_color);
    root.style.setProperty('--foreground', settings.foreground_color);
  };

  useEffect(() => {
    fetchSettings();
  }, [user?.id]);

  useEffect(() => {
    applyBrandColors();
  }, [settings]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    refetchSettings: fetchSettings,
    applyBrandColors,
  };
};
