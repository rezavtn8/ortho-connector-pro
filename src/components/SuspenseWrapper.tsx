import React, { Suspense, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface SuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  type?: 'page' | 'component' | 'minimal';
}

const PageLoadingFallback = () => (
  <div className="space-y-6">
    <div className="flex flex-col space-y-3 mb-8">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-6 w-96" />
    </div>
    
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const ComponentLoadingFallback = () => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </CardContent>
  </Card>
);

const MinimalLoadingFallback = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export function SuspenseWrapper({ children, fallback, type = 'component' }: SuspenseWrapperProps) {
  const defaultFallback = () => {
    switch (type) {
      case 'page':
        return <PageLoadingFallback />;
      case 'minimal':
        return <MinimalLoadingFallback />;
      default:
        return <ComponentLoadingFallback />;
    }
  };

  return (
    <Suspense fallback={fallback || defaultFallback()}>
      {children}
    </Suspense>
  );
}