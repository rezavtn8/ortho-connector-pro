import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useClinicLogo = () => {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClinicLogo = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get user's clinic_id from profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('clinic_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.clinic_id) {
          // Get clinic logo
          const { data: clinic, error: clinicError } = await supabase
            .from('clinics')
            .select('logo_url')
            .eq('id', profile.clinic_id)
            .single();

          if (clinicError) throw clinicError;

          setLogoUrl(clinic?.logo_url || null);
        }
      } catch (error) {
        console.error('Error fetching clinic logo:', error);
        setLogoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchClinicLogo();
  }, [user?.id]);

  return { logoUrl, loading };
};
