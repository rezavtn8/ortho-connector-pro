import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface CriticalErrorBoundaryProps {
  children: React.ReactNode;
  name: string;
}

/**
 * A specialized error boundary for critical sections that should never fail
 * Examples: Authentication, Data fetching, Payment processing
 */
export function CriticalErrorBoundary({ children, name }: CriticalErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log critical errors with high priority
    console.error(`Critical error in ${name}:`, error, errorInfo);
    
    // In a real app, you might want to:
    // - Send alerts to monitoring services
    // - Notify administrators immediately
    // - Trigger failover mechanisms
  };

  const fallback = (
    <div className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="h-8 w-8 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-destructive">Critical System Error</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        A critical component ({name}) has failed. Please refresh the page or contact support.
      </p>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      fallback={fallback}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
}