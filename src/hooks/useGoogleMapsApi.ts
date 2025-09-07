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

  // Health check function
  const checkHealth = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-google-maps-key/health', {
        method: 'GET'
      });
      
      return data?.status === 'healthy';
    } catch (err) {
      console.warn('Google Maps API health check failed:', err);
      return false;
    }
  };

  const fetchApiKey = async (attempt = 1) => {
    const maxRetries = 5;
    const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Exponential backoff

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      retryCount: attempt - 1
    }));

    try {
      console.log(`useGoogleMapsApi: Attempting to fetch API key (attempt ${attempt})`);
      
      // Check health first on initial load
      if (attempt === 1) {
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          throw new Error('Google Maps API service is not healthy');
        }
      }
      
      const { data, error } = await supabase.functions.invoke('get-google-maps-key', {
        method: 'GET'
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function call failed: ${error.message || 'Unknown error'}`);
      }

      if (!data?.success) {
        console.error('API key fetch failed:', data);
        throw new Error(data?.error || 'API key fetch failed');
      }

      const apiKey = data.google_maps_api_key;
      if (!apiKey) {
        throw new Error('No API key returned from server');
      }

      // Validate API key format
      if (!apiKey.startsWith('AIza')) {
        throw new Error('Invalid API key format received');
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
      
      const errorMessage = error.message || 'Unknown error occurred';
      
      // Check if we should retry based on error type
      const shouldRetry = attempt < maxRetries && (
        errorMessage.includes('Function call failed') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('not healthy')
      );

      if (shouldRetry) {
        console.log(`useGoogleMapsApi: Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        setTimeout(() => fetchApiKey(attempt + 1), retryDelay);
        return;
      }

      // Final failure
      const finalErrorMessage = getErrorMessage(error);
      setState(prev => ({ 
        ...prev, 
        error: finalErrorMessage, 
        isLoading: false,
        retryCount: attempt 
      }));

      // Show user-friendly toast for specific errors
      if (errorMessage.includes('API_KEY_MISSING')) {
        toast({
          title: 'Configuration Error',
          description: 'Google Maps API key is not configured. Please ensure the GOOGLE_MAPS_API_KEY secret is properly set.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('INVALID_API_KEY') || errorMessage.includes('FORBIDDEN')) {
        toast({
          title: 'Configuration Error', 
          description: 'Google Maps API key is invalid or lacks permissions. Please check the key has Places API enabled.',
          variant: 'destructive',
        });
      } else if (attempt >= maxRetries) {
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to Google Maps API after multiple attempts. Please check your connection and try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const retry = () => {
    console.log('useGoogleMapsApi: Manual retry triggered');
    setState(prev => ({ ...prev, retryCount: 0 }));
    fetchApiKey(1);
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  useEffect(() => {
    fetchApiKey(1);
  }, []);

  // Load Google Maps JavaScript API when we have the key
  useEffect(() => {
    if (!state.apiKey || state.isGoogleMapsLoaded) return;

    const loadGoogleMaps = async () => {
      try {
        console.log('useGoogleMapsApi: Loading Google Maps JavaScript API...');
        
        // Load Google Maps with the fetched API key
        const { Loader } = await import('@googlemaps/js-api-loader');
        
        const loader = new Loader({
          apiKey: state.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
          region: 'US',
          language: 'en'
        });

        await loader.load();
        console.log('useGoogleMapsApi: Google Maps JavaScript API loaded successfully');
        setState(prev => ({ ...prev, isGoogleMapsLoaded: true }));
        
      } catch (err) {
        console.error('useGoogleMapsApi: Failed to load Google Maps JavaScript API:', err);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to load Google Maps. Please check your internet connection and try again.',
          isGoogleMapsLoaded: false 
        }));
      }
    };

    loadGoogleMaps();
  }, [state.apiKey, state.isGoogleMapsLoaded]);

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

// Hook for Google Reviews API with enhanced production features
export function useGoogleReviews() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Health check for reviews service
  const checkReviewsHealth = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-google-reviews/health', {
        method: 'GET'
      });
      
      return data?.status === 'healthy';
    } catch (err) {
      console.warn('Reviews health check failed:', err);
      return false;
    }
  };

  const fetchReviews = async (placeId: string, maxRetries = 4) => {
    setIsLoading(true);
    setLastError(null);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`useGoogleReviews: Fetching reviews for place ${placeId} (attempt ${attempt})`);
        
        // Check health on first attempt
        if (attempt === 1) {
          const isHealthy = await checkReviewsHealth();
          if (!isHealthy) {
            throw new Error('Google Reviews service is not available');
          }
        }
        
        const { data, error } = await supabase.functions.invoke('get-google-reviews', {
          body: { place_id: placeId }
        });

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(`Function call failed: ${error.message || 'Unknown error'}`);
        }

        if (!data?.success) {
          // Handle specific error codes with appropriate user messages
          const errorCode = data?.code;
          let userMessage = data?.error || 'Failed to fetch reviews';
          
          console.error(`Reviews API error [${data?.request_id}]:`, data);
          
          if (errorCode === 'API_KEY_MISSING') {
            userMessage = 'Google Maps API configuration is missing. Please ensure the GOOGLE_MAPS_API_KEY secret is properly configured.';
          } else if (errorCode === 'INVALID_API_KEY_FORMAT' || errorCode === 'INVALID_API_KEY_LENGTH') {
            userMessage = 'Google Maps API key format is invalid. Please check the key configuration.';
          } else if (errorCode === 'FORBIDDEN_API_KEY' || errorCode === 'REQUEST_DENIED') {
            userMessage = 'Google Maps API key lacks required permissions. Please ensure Places API is enabled and the key has proper restrictions.';
          } else if (errorCode === 'RATE_LIMIT_EXCEEDED' || errorCode === 'GOOGLE_API_OVER_QUERY_LIMIT') {
            userMessage = 'Google API usage limit reached. Please try again in a few minutes.';
          } else if (errorCode === 'GOOGLE_API_NOT_FOUND') {
            userMessage = 'This location was not found or has no reviews available on Google.';
          } else if (errorCode === 'INVALID_PLACE_ID' || errorCode === 'GOOGLE_API_INVALID_REQUEST') {
            userMessage = 'Invalid location ID provided. Please try searching for the location again.';
          }
          
          throw new Error(userMessage);
        }

        console.log(`useGoogleReviews: Successfully fetched ${data.reviews?.length || 0} reviews [${data.request_id}]`);
        setLastError(null);
        setIsLoading(false);
        return data;

      } catch (error: any) {
        console.error(`useGoogleReviews: Error on attempt ${attempt}:`, error);
        
        const errorMessage = error.message || 'Unknown error occurred';
        setLastError(errorMessage);
        
        // Determine if we should retry based on error type
        const isRetryableError = (
          errorMessage.includes('Function call failed') ||
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('not available') ||
          errorMessage.includes('server error')
        );
        
        const shouldRetry = attempt < maxRetries && isRetryableError;
        
        if (shouldRetry) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000;
          console.log(`useGoogleReviews: Retrying review fetch in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // All retries exhausted or non-retryable error
        setIsLoading(false);
        
        // Show user-friendly error message
        toast({
          title: 'Error Fetching Reviews',
          description: errorMessage,
          variant: 'destructive',
          duration: 6000,
        });

        throw error;
      }
    }
    
    setIsLoading(false);
  };

  return { 
    fetchReviews, 
    isLoading,
    lastError,
    checkHealth: checkReviewsHealth
  };
}