import React from 'react';
import { ComponentErrorBoundary } from '@/components/AppErrorBoundary';

interface ComponentErrorWrapperProps {
  children: React.ReactNode;
  componentName: string;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

export function ComponentErrorWrapper({ 
  children, 
  componentName, 
  fallback,
  showFallback = true 
}: ComponentErrorWrapperProps) {
  const defaultFallback = showFallback ? (
    <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 text-center">
      <p className="text-sm text-destructive font-medium">
        {componentName} Error
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        This component failed to load properly.
      </p>
    </div>
  ) : null;

  return (
    <ComponentErrorBoundary 
      componentName={componentName}
      fallback={fallback || defaultFallback}
    >
      {children}
    </ComponentErrorBoundary>
  );
}

// Higher-order component for easy wrapping
export function withComponentError<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string,
  fallback?: React.ReactNode
) {
  const displayName = componentName || Component.displayName || Component.name || 'Unknown';
  
  const WrappedComponent = (props: P) => (
    <ComponentErrorWrapper 
      componentName={displayName}
      fallback={fallback}
    >
      <Component {...props} />
    </ComponentErrorWrapper>
  );

  WrappedComponent.displayName = `withComponentError(${displayName})`;
  
  return WrappedComponent;
}