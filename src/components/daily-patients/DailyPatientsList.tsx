import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Clock, FileText, ChevronRight } from 'lucide-react';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DailyPatientsListProps {
  entries: DailyPatientEntry[];
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  selectedDate?: Date | null;
  onDateClick?: (date: Date) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, MMM d');
}

export function DailyPatientsList({ 
  entries, 
  onDelete, 
  isDeleting,
  selectedDate,
  onDateClick 
}: DailyPatientsListProps) {
  // Group entries by date
  const groupedByDate = entries.reduce((acc, entry) => {
    const dateKey = entry.patient_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, DailyPatientEntry[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (entries.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No patient entries yet this month</p>
            <p className="text-sm text-muted-foreground mt-1">Click on a date to add patients</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-4">
            {sortedDates.map((dateKey) => {
              const dateEntries = groupedByDate[dateKey];
              const totalForDay = dateEntries.reduce((sum, e) => sum + e.patient_count, 0);
              const date = parseISO(dateKey);
              const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey;

              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "rounded-lg border p-3 transition-all cursor-pointer hover:border-primary/50",
                    isSelected && "border-primary bg-primary/5"
                  )}
                  onClick={() => onDateClick?.(date)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatRelativeDate(dateKey)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {totalForDay} patient{totalForDay !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-1">
                    {dateEntries.map((entry) => {
                      const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                      return (
                        <div 
                          key={entry.id} 
                          className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-base">{config?.icon || '📌'}</span>
                            <span className="text-sm truncate text-muted-foreground">
                              {entry.source_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {entry.patient_count}
                            </Badge>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Remove {entry.patient_count} patient(s) from {entry.source_name} on {format(date, 'MMM d')}?
                                    This will also update the monthly totals.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDelete(entry.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {dateEntries[0]?.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      "{dateEntries[0].notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
