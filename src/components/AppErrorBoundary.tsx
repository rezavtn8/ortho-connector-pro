import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { QueryErrorBoundary } from '@/components/QueryErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

// Create a stable query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const location = useLocation();

  return (
    <ErrorBoundary 
      level="app"
      onError={(error, errorInfo) => {
        // Global error reporting
        console.error('App-level error:', error, errorInfo);
        
        // You can add additional global error handling here
        // such as sending to analytics, showing toast notifications, etc.
      }}
    >
      <QueryClientProvider client={queryClient}>
        <QueryErrorBoundary>
          <RouteErrorBoundary routeName={location.pathname}>
            {children}
          </RouteErrorBoundary>
        </QueryErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Helper component to wrap individual page components
export function PageErrorBoundary({ 
  children, 
  pageName 
}: { 
  children: React.ReactNode; 
  pageName: string; 
}) {
  return (
    <ErrorBoundary
      level="section"
      onError={(error, errorInfo) => {
        console.error(`Page error in ${pageName}:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Helper component to wrap individual components that might fail
export function ComponentErrorBoundary({ 
  children, 
  componentName,
  fallback 
}: { 
  children: React.ReactNode; 
  componentName: string;
  fallback?: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      level="component"
      fallback={fallback || (
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="text-sm text-destructive">
            Failed to load {componentName}
          </p>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error(`Component error in ${componentName}:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}