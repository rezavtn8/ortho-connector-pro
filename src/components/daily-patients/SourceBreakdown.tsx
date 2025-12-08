import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, TrendingUp } from 'lucide-react';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { cn } from '@/lib/utils';

interface SourceBreakdownProps {
  entries: DailyPatientEntry[];
}

export function SourceBreakdown({ entries }: SourceBreakdownProps) {
  // Group by source
  const sourceStats = entries.reduce((acc, entry) => {
    const key = entry.source_id;
    if (!acc[key]) {
      acc[key] = {
        source_id: entry.source_id,
        source_name: entry.source_name,
        source_type: entry.source_type,
        total: 0,
        entries: 0,
      };
    }
    acc[key].total += entry.patient_count;
    acc[key].entries += 1;
    return acc;
  }, {} as Record<string, { source_id: string; source_name: string; source_type: string; total: number; entries: number }>);

  const totalPatients = entries.reduce((sum, e) => sum + e.patient_count, 0);
  const sortedSources = Object.values(sourceStats).sort((a, b) => b.total - a.total);

  // Get color for source type
  const getSourceColor = (sourceType: string, index: number) => {
    const colors = [
      'bg-primary',
      'bg-success',
      'bg-info',
      'bg-warning',
      'bg-destructive',
      'bg-accent',
    ];
    return colors[index % colors.length];
  };

  if (entries.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Source Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">No data to display</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Source Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {/* Visual representation */}
        <div className="flex h-3 rounded-full overflow-hidden mb-6 bg-muted">
          {sortedSources.map((source, index) => {
            const percentage = (source.total / totalPatients) * 100;
            return (
              <div
                key={source.source_id}
                className={cn("transition-all", getSourceColor(source.source_type, index))}
                style={{ width: `${percentage}%` }}
                title={`${source.source_name}: ${source.total} (${Math.round(percentage)}%)`}
              />
            );
          })}
        </div>

        {/* Source list */}
        <div className="space-y-3">
          {sortedSources.slice(0, 6).map((source, index) => {
            const config = SOURCE_TYPE_CONFIG[source.source_type as SourceType];
            const percentage = totalPatients > 0 ? Math.round((source.total / totalPatients) * 100) : 0;
            
            return (
              <div key={source.source_id} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-base">{config?.icon || '📌'}</span>
                    <span className="text-sm font-medium truncate">{source.source_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{source.total}</span>
                    <Badge variant="secondary" className="text-xs">
                      {percentage}%
                    </Badge>
                  </div>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-1.5"
                />
              </div>
            );
          })}
          
          {sortedSources.length > 6 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{sortedSources.length - 6} more sources
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <span>{sortedSources.length} active sources</span>
          </div>
          <Badge variant="default">{totalPatients} total</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
