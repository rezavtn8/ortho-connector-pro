import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocation } from 'react-router-dom';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName?: string;
}

export function RouteErrorBoundary({ children, routeName }: RouteErrorBoundaryProps) {
  const location = useLocation();
  const displayName = routeName || location.pathname;

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`Route error in ${displayName}:`, error, errorInfo);
    
    // Additional route-specific error handling
    const metadata = {
      route: displayName,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      timestamp: new Date().toISOString()
    };

    // You could send this to analytics or other services
    console.log('Route error metadata:', metadata);
  };

  return (
    <ErrorBoundary
      level="section"
      onError={handleError}
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Route Error
            </h2>
            <p className="text-muted-foreground">
              Failed to load {displayName}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}