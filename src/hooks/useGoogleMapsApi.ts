import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/hooks/use-toast';

interface GoogleMapsApiState {
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
  isGoogleMapsLoaded: boolean;
  retryCount: number;
}

interface GoogleMapsApiHook extends GoogleMapsApiState {
  retry: () => void;
  clearError: () => void;
}

export function useGoogleMapsApi(): GoogleMapsApiHook {
  const [state, setState] = useState<GoogleMapsApiState>({
    apiKey: null,
    isLoading: true,
    error: null,
    isGoogleMapsLoaded: false,
    retryCount: 0
  });
  const { toast } = useToast();

  const fetchApiKey = async (attempt = 1) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      retryCount: attempt - 1
    }));

    try {
      console.log(`useGoogleMapsApi: Attempting to fetch API key (attempt ${attempt})`);
      
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      
      if (error) {
        throw new Error(`Supabase function error: ${error.message || 'Unknown error'}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'API key fetch failed');
      }

      const apiKey = data.google_maps_api_key;
      if (!apiKey) {
        throw new Error('No API key returned from server');
      }

      console.log('useGoogleMapsApi: Successfully fetched API key');
      setState(prev => ({ 
        ...prev, 
        apiKey, 
        isLoading: false, 
        error: null,
        isGoogleMapsLoaded: false 
      }));

      return apiKey;

    } catch (error: any) {
      console.error(`useGoogleMapsApi: Error on attempt ${attempt}:`, error);
      
      // Determine if error is retryable
      const isRetryable = !error.message?.includes('API_KEY_MISSING') && 
                         !error.message?.includes('INVALID_API_KEY') &&
                         !error.message?.includes('Method not allowed');

      if (attempt < maxRetries && isRetryable) {
        console.log(`useGoogleMapsApi: Retrying in ${retryDelay}ms...`);
        setTimeout(() => fetchApiKey(attempt + 1), retryDelay);
        return;
      }

      // Final failure
      const errorMessage = getErrorMessage(error);
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false,
        retryCount: attempt 
      }));

      // Show user-friendly toast for specific errors
      if (error.message?.includes('API_KEY_MISSING')) {
        toast({
          title: 'Configuration Error',
          description: 'Google Maps API key is not configured. Please contact support.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('INVALID_API_KEY')) {
        toast({
          title: 'Configuration Error', 
          description: 'Google Maps API key is invalid. Please contact support.',
          variant: 'destructive',
        });
      } else if (attempt >= maxRetries) {
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to Google Maps API. Please check your internet connection and try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const retry = () => {
    fetchApiKey(1);
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  useEffect(() => {
    fetchApiKey(1);
  }, []);

  return {
    ...state,
    retry,
    clearError
  };
}

function getErrorMessage(error: any): string {
  if (error.message?.includes('API_KEY_MISSING')) {
    return 'Google Maps API key is not configured on the server';
  }
  if (error.message?.includes('INVALID_API_KEY')) {
    return 'Google Maps API key configuration is invalid';
  }
  if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
    return 'Network connection error. Please check your internet connection.';
  }
  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  return error.message || 'An unexpected error occurred while loading Google Maps API';
}

// Hook for Google Reviews API with similar retry logic
export function useGoogleReviews() {
  const { toast } = useToast();

  const fetchReviews = async (placeId: string, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`useGoogleReviews: Fetching reviews for place ${placeId} (attempt ${attempt})`);
        
        const { data, error } = await supabase.functions.invoke('get-google-reviews', {
          body: { place_id: placeId }
        });

        if (error) {
          throw new Error(`Supabase function error: ${error.message || 'Unknown error'}`);
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to fetch reviews');
        }

        console.log(`useGoogleReviews: Successfully fetched ${data.reviews?.length || 0} reviews`);
        return data;

      } catch (error: any) {
        console.error(`useGoogleReviews: Error on attempt ${attempt}:`, error);
        
        // Don't retry on certain errors
        const nonRetryableErrors = [
          'INVALID_PLACE_ID', 
          'NOT_FOUND', 
          'REQUEST_DENIED',
          'API_KEY_MISSING'
        ];

        const isNonRetryable = nonRetryableErrors.some(code => 
          error.message?.includes(code) || error.code?.includes(code)
        );

        if (isNonRetryable || attempt === maxRetries) {
          // Show appropriate error message
          let toastMessage = 'Failed to fetch reviews. Please try again.';
          
          if (error.message?.includes('NOT_FOUND')) {
            toastMessage = 'Place not found in Google database.';
          } else if (error.message?.includes('INVALID_PLACE_ID')) {
            toastMessage = 'Invalid Google Place ID provided.';
          } else if (error.message?.includes('API_KEY_MISSING')) {
            toastMessage = 'Google API configuration error. Please contact support.';
          } else if (error.message?.includes('OVER_QUERY_LIMIT')) {
            toastMessage = 'Google API quota exceeded. Please try again later.';
          }

          toast({
            title: 'Error Fetching Reviews',
            description: toastMessage,
            variant: 'destructive',
          });

          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  return { fetchReviews };
}