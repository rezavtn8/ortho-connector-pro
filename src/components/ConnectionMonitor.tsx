import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function ConnectionMonitor() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  // Monitor network connection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Supabase connection
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        const { error } = await supabase.from('user_profiles').select('id').limit(1);
        setIsSupabaseConnected(!error);
      } catch (error) {
        setIsSupabaseConnected(false);
      }
    };

    // Check initially
    checkSupabaseConnection();

    // Check every 30 seconds when offline
    const interval = setInterval(() => {
      if (!isSupabaseConnected || !isOnline) {
        checkSupabaseConnection();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isSupabaseConnected, isOnline]);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    try {
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      setIsSupabaseConnected(!error);
    } catch (error) {
      setIsSupabaseConnected(false);
    } finally {
      setIsRetrying(false);
    }
  };

  const showBanner = !isOnline || !isSupabaseConnected;

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground">
      <Alert className="rounded-none border-0 bg-destructive text-destructive-foreground">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <AlertDescription className="font-medium">
              {!isOnline 
                ? "No internet connection. Please check your network." 
                : "Connection lost. Retrying..."
              }
            </AlertDescription>
          </div>
          
          {isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-transparent border-destructive-foreground text-destructive-foreground hover:bg-destructive-foreground hover:text-destructive"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Retry
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}