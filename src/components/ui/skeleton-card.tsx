import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonCardProps {
  variant?: 'default' | 'office' | 'dashboard' | 'activity' | 'metric';
  className?: string;
}

export function SkeletonCard({ variant = 'default', className }: SkeletonCardProps) {
  switch (variant) {
    case 'office':
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Office name and tier */}
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              
              {/* Metrics */}
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <Skeleton className="h-6 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
                <div className="text-center">
                  <Skeleton className="h-6 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
                <div className="text-center">
                  <Skeleton className="h-6 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case 'dashboard':
      return (
        <Card className={className}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case 'activity':
      return (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="text-right">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      );

    case 'metric':
      return (
        <Card className={className}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-3 w-20 mt-1" />
          </CardContent>
        </Card>
      );

    default:
      return (
        <Card className={className}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      );
  }
}