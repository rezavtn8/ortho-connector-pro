import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setToken(data.token);
      } catch (error) {
        console.error('Error getting Mapbox token:', error);
        setError('Failed to load Mapbox token');
      } finally {
        setIsLoading(false);
      }
    };
    
    getToken();
  }, []);

  return { token, isLoading, error };
}