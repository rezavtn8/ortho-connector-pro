import React from 'react';
import { QueryErrorResetBoundary, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, Database, Wifi } from 'lucide-react';
import { useErrorReporting } from '@/components/ErrorBoundary';

interface QueryErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function QueryErrorFallback({ error, resetErrorBoundary }: QueryErrorFallbackProps) {
  const { reportError } = useErrorReporting();
  const { reset } = useQueryErrorResetBoundary();

  const handleRetry = () => {
    reset();
    resetErrorBoundary();
  };

  const isNetworkError = error.message.includes('fetch') || 
                        error.message.includes('network') ||
                        error.message.includes('Failed to fetch');

  const isSupabaseError = error.message.includes('supabase') ||
                         error.message.includes('postgresql') ||
                         error.message.includes('JWT');

  React.useEffect(() => {
    reportError(error, {
      level: 'error',
      metadata: { 
        context: 'query_error',
        isNetworkError,
        isSupabaseError,
        errorType: error.constructor.name
      }
    });
  }, [error, reportError, isNetworkError, isSupabaseError]);

  return (
    <Card className="w-full max-w-lg mx-auto mt-8">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          {isNetworkError ? (
            <Wifi className="h-6 w-6 text-destructive" />
          ) : isSupabaseError ? (
            <Database className="h-6 w-6 text-destructive" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <CardTitle className="text-center">
          {isNetworkError ? 'Connection Error' : 
           isSupabaseError ? 'Database Error' : 
           'Data Loading Error'}
        </CardTitle>
        <CardDescription className="text-center">
          {isNetworkError ? 'Unable to connect to our servers. Please check your internet connection.' :
           isSupabaseError ? 'There was a problem accessing the database. Please try again.' :
           'We encountered an error while loading your data.'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isNetworkError && 'Check your internet connection and try again.'}
            {isSupabaseError && 'Our database is temporarily unavailable. We\'re working to fix this.'}
            {!isNetworkError && !isSupabaseError && 'This is a temporary issue. Please try refreshing the page.'}
          </AlertDescription>
        </Alert>

        {process.env.NODE_ENV === 'development' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-medium">Debug Information</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap">{error.message}</pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
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
}

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<QueryErrorFallbackProps>;
}

export function QueryErrorBoundary({ children, fallback }: QueryErrorBoundaryProps) {
  const FallbackComponent = fallback || QueryErrorFallback;

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <FallbackComponent error={error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// Error Boundary component for legacy compatibility
class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallbackRender: ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => React.ReactNode;
    onReset?: () => void;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Query Error Boundary caught error:', error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallbackRender({
        error: this.state.error,
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }

    return this.props.children;
  }
}