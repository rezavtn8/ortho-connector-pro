import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BusinessAnalysisLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Control Panel Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Insights Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              
              <div className="p-3 bg-muted/50 rounded-md space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          <div className="h-2 w-2 bg-primary/60 rounded-full animate-pulse [animation-delay:0.2s]" />
          <div className="h-2 w-2 bg-primary/30 rounded-full animate-pulse [animation-delay:0.4s]" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          AI analyzing your practice data...
        </p>
      </div>
    </div>
  );
}