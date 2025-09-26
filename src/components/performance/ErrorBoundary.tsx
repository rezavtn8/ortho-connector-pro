/**
 * Performance-optimized error boundary with retry logic
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  retryable?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
  retryCount: number;
}

export class PerformanceErrorBoundary extends Component<Props, State> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to performance monitoring
    console.error('ErrorBoundary caught error:', {
      error: error.message,
      stack: error.stack,
      errorInfo: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Send to error tracking service
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app-error', {
          detail: {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            errorId: this.state.errorId,
          },
        })
      );
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    // Progressive backoff for retries
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: undefined,
        retryCount: retryCount + 1,
      });
      this.retryTimeouts.delete(timeout);
    }, delay);
    
    this.retryTimeouts.add(timeout);
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="m-4 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            {this.state.retryCount < 3 && this.props.retryable !== false && (
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry ({3 - this.state.retryCount} left)
                </Button>
                <Button onClick={this.handleReload} variant="outline" size="sm">
                  Reload Page
                </Button>
              </div>
            )}
            
            {this.state.retryCount >= 3 && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  Multiple retry attempts failed. Please reload the page.
                </p>
                <Button onClick={this.handleReload} variant="destructive" size="sm">
                  Reload Page
                </Button>
              </div>
            )}
            
            <details className="text-xs text-gray-600">
              <summary>Error Details</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withPerformanceErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <PerformanceErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </PerformanceErrorBoundary>
  );

  WrappedComponent.displayName = `withPerformanceErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}