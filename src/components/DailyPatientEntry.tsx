import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { useDailyPatientsForDate } from '@/hooks/useDailyPatients';
import { AddDailyPatientsDialog } from '@/components/AddDailyPatientsDialog';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyPatientEntryProps {
  className?: string;
}

export function DailyPatientEntry({ className }: DailyPatientEntryProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const today = new Date();
  
  const { data: todayEntries = [], isLoading, error, refetch } = useDailyPatientsForDate(today);
  
  const totalToday = todayEntries.reduce((sum, e) => sum + e.patient_count, 0);

  // Handle error state gracefully
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            Today's Patients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Unable to load data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" />
              Today's Patients
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {format(today, 'MMM d')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {todayEntries.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {todayEntries.slice(0, 5).map((entry) => {
                    const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{config?.icon || '📌'}</span>
                          <span className="truncate">{entry.source_name}</span>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {entry.patient_count}
                        </Badge>
                      </div>
                    );
                  })}
                  {todayEntries.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{todayEntries.length - 5} more sources
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No patients added today
                </div>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <Badge variant="default">{totalToday}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddDialog(true)}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AddDailyPatientsDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialDate={today}
        onSuccess={() => refetch()}
      />
    </>
  );
}
