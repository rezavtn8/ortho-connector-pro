import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GoogleBusinessHook {
  isLoading: boolean;
  error: string | null;
  connectBusiness: () => Promise<void>;
  fetchAllReviews: (locationId: string) => Promise<any>;
  replyToReview: (locationId: string, reviewId: string, replyText: string) => Promise<any>;
  isConnected: boolean;
}

export function useGoogleBusinessProfile(): GoogleBusinessHook {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectBusiness = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('useGoogleBusinessProfile: Attempting to connect business');
      
      // Get auth URL from edge function
      const response = await fetch('https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/google-business-profile/auth-url', {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3pxd2liYmN2bWR3Z3FsYWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDAyMDQsImV4cCI6MjA2OTE3NjIwNH0.S6qvIFA1itxemVUTzfz4dDr2J9jz2z69NEv-fgb4gK4',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('useGoogleBusinessProfile: HTTP error:', response.status, errorData);
        throw new Error(errorData.error || `Server returned ${response.status} error`);
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('useGoogleBusinessProfile: Function error:', data);
        throw new Error(data.error);
      }

      if (data.auth_url) {
        // Open popup window for OAuth
        const popup = window.open(
          data.auth_url, 
          'google-business-auth', 
          'width=600,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for messages from popup (OAuth callback)
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GOOGLE_BUSINESS_AUTH_SUCCESS') {
            // Store access token (in a real app, this should be stored securely on the server)
            localStorage.setItem('google_business_access_token', event.data.access_token);
            localStorage.setItem('google_business_refresh_token', event.data.refresh_token);
            
            setIsConnected(true);
            popup?.close();
            window.removeEventListener('message', messageListener);
            
            toast({
              title: 'Business Connected',
              description: 'Successfully connected to Google My Business.',
            });
          } else if (event.data.type === 'GOOGLE_BUSINESS_AUTH_ERROR') {
            throw new Error(event.data.error);
          }
        };

        window.addEventListener('message', messageListener);

        // Check if popup was closed without completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            if (!isConnected) {
              toast({
                title: 'Connection Cancelled',
                description: 'Google My Business connection was cancelled.',
                variant: 'destructive',
              });
            }
          }
        }, 1000);
      } else {
        throw new Error('No auth URL received from server');
      }
    } catch (error: any) {
      console.error('useGoogleBusinessProfile: Error connecting to Google My Business:', error);
      setError(error.message);
      
      let errorMessage = 'Failed to connect to Google My Business.';
      
      if (error.message?.includes('OAUTH_CLIENT_ID_MISSING') || error.message?.includes('OAUTH_CREDENTIALS_MISSING')) {
        errorMessage = 'Google OAuth credentials need to be configured in Supabase secrets. Please contact your administrator.';
      } else if (error.message?.includes('Edge Function returned a non-2xx status code')) {
        errorMessage = 'Server configuration issue. Please check if Google OAuth credentials are properly set up.';
      }
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllReviews = async (locationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = localStorage.getItem('google_business_access_token');
      
      if (!accessToken) {
        throw new Error('Not authenticated with Google My Business');
      }

      const { data, error } = await supabase.functions.invoke('google-business-profile/reviews', {
        body: { location_id: locationId },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (error) throw error;

      return data;

    } catch (error: any) {
      console.error('Error fetching all reviews:', error);
      setError(error.message);
      toast({
        title: 'Failed to Load Reviews',
        description: error.message || 'Could not load all reviews from Google My Business.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const replyToReview = async (locationId: string, reviewId: string, replyText: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = localStorage.getItem('google_business_access_token');
      
      if (!accessToken) {
        throw new Error('Not authenticated with Google My Business');
      }

      const { data, error } = await supabase.functions.invoke('google-business-profile/reply', {
        body: {
          location_id: locationId,
          review_id: reviewId,
          reply_text: replyText
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to post reply');
      }

      return data;

    } catch (error: any) {
      console.error('Error posting reply:', error);
      setError(error.message);
      toast({
        title: 'Reply Failed',
        description: error.message || 'Could not post reply to Google My Business.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if already connected on hook initialization
  React.useEffect(() => {
    const token = localStorage.getItem('google_business_access_token');
    setIsConnected(!!token);
  }, []);

  return {
    isLoading,
    error,
    connectBusiness,
    fetchAllReviews,
    replyToReview,
    isConnected
  };
}