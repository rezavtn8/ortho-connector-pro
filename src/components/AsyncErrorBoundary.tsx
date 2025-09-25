import React, { useState, useEffect } from 'react';
import { ErrorBoundary, useErrorReporting } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<AsyncErrorFallbackProps>;
  onRetry?: () => void | Promise<void>;
  maxRetries?: number;
}

interface AsyncErrorFallbackProps {
  error: Error | null;
  retry: () => void;
  canRetry: boolean;
  isRetrying: boolean;
  isOnline: boolean;
}

export function AsyncErrorBoundary({ 
  children, 
  fallback: CustomFallback,
  onRetry,
  maxRetries = 3 
}: AsyncErrorBoundaryProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { reportError } = useErrorReporting();

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

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      await onRetry?.();
      // Reset error boundary by remounting component
      window.location.reload();
    } catch (error) {
      console.error('Retry failed:', error);
      reportError(error as Error, {
        level: 'error',
        metadata: { retryCount: retryCount + 1, context: 'async_retry' }
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const DefaultFallback: React.FC<AsyncErrorFallbackProps> = ({ 
    error, 
    retry, 
    canRetry, 
    isRetrying: fallbackIsRetrying,
    isOnline: fallbackIsOnline 
  }) => (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          {!fallbackIsOnline ? (
            <WifiOff className="h-6 w-6 text-destructive" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <CardTitle className="text-center">
          {!fallbackIsOnline ? 'Connection Lost' : 'Something went wrong'}
        </CardTitle>
        <CardDescription className="text-center">
          {!fallbackIsOnline 
            ? 'Please check your internet connection and try again.'
            : 'We encountered an unexpected error while loading this content.'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!fallbackIsOnline && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You appear to be offline. Some features may not work properly.
            </AlertDescription>
          </Alert>
        )}

        {process.env.NODE_ENV === 'development' && error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap">{error.message}</pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          {canRetry && (
            <Button 
              onClick={retry}
              disabled={fallbackIsRetrying}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${fallbackIsRetrying ? 'animate-spin' : ''}`} />
              {fallbackIsRetrying ? 'Retrying...' : `Try Again (${maxRetries - retryCount} left)`}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const FallbackComponent = CustomFallback || DefaultFallback;

  return (
    <ErrorBoundary
      level="component"
      fallback={
        <FallbackComponent
          error={null}
          retry={handleRetry}
          canRetry={retryCount < maxRetries}
          isRetrying={isRetrying}
          isOnline={isOnline}
        />
      }
      onError={(error, errorInfo) => {
        reportError(error, {
          level: 'error',
          metadata: { 
            retryCount, 
            context: 'async_component',
            componentStack: errorInfo.componentStack 
          }
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}