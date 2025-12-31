import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SavedLabelSettings {
  clinicLogoUrl?: string;
  clinicAddress?: string;
  clinicName?: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch saved clinic logo and address from settings
 * for use in mailing label customization
 */
export function useSavedLabelSettings(): SavedLabelSettings {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SavedLabelSettings>({
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setSettings({ isLoading: false, error: null });
      return;
    }

    const fetchSettings = async () => {
      try {
        // First get the user's clinic_id
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('clinic_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        
        if (!profile?.clinic_id) {
          setSettings({ isLoading: false, error: null });
          return;
        }

        // Fetch clinic info
        const { data: clinic, error: clinicError } = await supabase
          .from('clinics')
          .select('name, address')
          .eq('id', profile.clinic_id)
          .maybeSingle();

        if (clinicError) throw clinicError;

        // Fetch brand settings for logo
        const { data: brand, error: brandError } = await supabase
          .from('clinic_brand_settings')
          .select('logo_url')
          .eq('clinic_id', profile.clinic_id)
          .maybeSingle();

        if (brandError) throw brandError;

        setSettings({
          clinicLogoUrl: brand?.logo_url || undefined,
          clinicAddress: clinic?.address || undefined,
          clinicName: clinic?.name || undefined,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error fetching saved label settings:', error);
        setSettings({
          isLoading: false,
          error: error.message,
        });
      }
    };

    fetchSettings();
  }, [user?.id]);

  return settings;
}
