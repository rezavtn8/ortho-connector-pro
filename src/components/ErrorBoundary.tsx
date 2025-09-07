import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  isLogging: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isLogging: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to Supabase
    this.logErrorToSupabase(error, errorInfo);
  }

  private logErrorToSupabase = async (error: Error, errorInfo: ErrorInfo) => {
    if (this.state.isLogging) return;

    this.setState({ isLogging: true });

    try {
      const metadata: Record<string, string | number | boolean | null> = {
        retryCount: this.retryCount,
        level: this.props.level || 'component',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: JSON.stringify({
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      };

      const { data, error: logError } = await supabase.rpc('log_application_error', {
        p_error_message: error.message,
        p_error_stack: error.stack || null,
        p_component_stack: errorInfo.componentStack || null,
        p_url: window.location.href,
        p_user_agent: navigator.userAgent,
        p_severity: this.props.level === 'app' ? 'critical' : 'error',
        p_metadata: metadata,
      });

      if (logError) {
        console.error('Failed to log error to Supabase:', logError);
      } else {
        console.log('Error logged to Supabase with ID:', data);
        this.setState({ errorId: data });
      }
    } catch (logError) {
      console.error('Error logging to Supabase:', logError);
    } finally {
      this.setState({ isLogging: false });
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount += 1;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  private renderFallbackUI() {
    const { error, errorInfo, errorId, isLogging } = this.state;
    const { level = 'component' } = this.props;
    
    const isAppLevel = level === 'app';
    const canRetry = this.retryCount < this.maxRetries;

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className={`flex items-center justify-center p-6 ${isAppLevel ? 'min-h-screen bg-background' : 'min-h-[200px]'}`}>
        <Card className={`w-full ${isAppLevel ? 'max-w-2xl' : 'max-w-md'} shadow-lg`}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">
              {isAppLevel ? 'Application Error' : 'Something went wrong'}
            </CardTitle>
            <CardDescription>
              {isAppLevel 
                ? 'We encountered an unexpected error. Our team has been notified.'
                : 'This section failed to load properly.'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {errorId && (
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  Error ID: <code className="text-sm font-mono">{errorId}</code>
                  <br />
                  {isLogging && <span className="text-sm text-muted-foreground">Logging error details...</span>}
                </AlertDescription>
              </Alert>
            )}

            {process.env.NODE_ENV === 'development' && error && (
              <div className="rounded-md bg-muted p-3">
                <h4 className="text-sm font-semibold mb-2">Debug Information:</h4>
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {error.message}
                    {error.stack && `\n\nStack:\n${error.stack}`}
                  </pre>
                </details>
                {errorInfo && (
                  <details className="text-xs mt-2">
                    <summary className="cursor-pointer font-medium">Component Stack</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry} 
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              
              {isAppLevel ? (
                <Button 
                  onClick={this.handleReload} 
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              ) : (
                <Button 
                  onClick={this.handleGoHome} 
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              )}
            </div>

            {!canRetry && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maximum retry attempts reached. Please refresh the page or contact support if the problem persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for programmatic error reporting
export function useErrorReporting() {
  const reportError = React.useCallback(async (
    error: Error,
    context?: {
      level?: 'error' | 'warning' | 'info';
      metadata?: Record<string, string | number | boolean | null>;
    }
  ) => {
    try {
      const metadata: Record<string, string | number | boolean | null> = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        contextData: JSON.stringify(context?.metadata || {}),
      };

      await supabase.rpc('log_application_error', {
        p_error_message: error.message,
        p_error_stack: error.stack || null,
        p_component_stack: null,
        p_url: window.location.href,
        p_user_agent: navigator.userAgent,
        p_severity: context?.level || 'error',
        p_metadata: metadata,
      });
    } catch (logError) {
      console.error('Failed to report error:', logError);
    }
  }, []);

  return { reportError };
}