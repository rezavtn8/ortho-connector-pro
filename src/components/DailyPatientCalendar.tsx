import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Users, Trash2 } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  endOfWeek,
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  isSameDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useDailyPatients, useDeleteDailyPatient, DailyPatientEntry } from '@/hooks/useDailyPatients';
import { AddDailyPatientsDialog } from '@/components/AddDailyPatientsDialog';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyPatientCalendarProps {
  className?: string;
}

export function DailyPatientCalendar({ className }: DailyPatientCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date>(new Date());

  const yearMonth = format(currentDate, 'yyyy-MM');
  const { data: dailyPatients = [], isLoading, refetch } = useDailyPatients(yearMonth);
  const deleteDailyPatient = useDeleteDailyPatient();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group patients by date
  const patientsByDate = useMemo(() => {
    return dailyPatients.reduce((acc, entry) => {
      const dateKey = entry.patient_date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    }, {} as Record<string, DailyPatientEntry[]>);
  }, [dailyPatients]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddClick = (date: Date) => {
    setAddDialogDate(date);
    setShowAddDialog(true);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDeleteEntry = async (entryId: string) => {
    await deleteDailyPatient.mutateAsync(entryId);
  };

  const getDayTotal = (dateKey: string) => {
    const entries = patientsByDate[dateKey] || [];
    return entries.reduce((sum, e) => sum + e.patient_count, 0);
  };

  const renderDayPopover = (date: Date, dayEntries: DailyPatientEntry[]) => {
    const total = dayEntries.reduce((sum, e) => sum + e.patient_count, 0);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "absolute inset-0 cursor-pointer hover:bg-muted/30 transition-colors",
              isSameDay(date, selectedDate || new Date(0)) && "ring-2 ring-primary ring-inset"
            )}
            onClick={() => handleDateClick(date)}
          />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">
                {format(date, 'EEEE, MMMM d')}
              </h4>
              <Badge variant="secondary">{total} patients</Badge>
            </div>
            
            {dayEntries.length > 0 ? (
              <div className="space-y-2 mb-4">
                {dayEntries.map((entry) => {
                  const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span>{config?.icon || '📌'}</span>
                        <span className="text-sm truncate">{entry.source_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{entry.patient_count}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                No patients recorded for this day.
              </p>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddClick(date)}
              className="w-full gap-2"
            >
              <Plus className="w-3 h-3" />
              Add Patients
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Daily Patient Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleAddClick(new Date())}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(currentDate, 'MMMM yyyy')}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-semibold text-muted-foreground border-r border-border last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((date, index) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayEntries = patientsByDate[dateKey] || [];
                  const dayTotal = getDayTotal(dateKey);
                  const isCurrentMonth = isSameMonth(date, currentDate);
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={index}
                      className={cn(
                        "min-h-[80px] p-1 relative border-r border-b border-border last:border-r-0",
                        !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                        isTodayDate && "bg-primary/5"
                      )}
                    >
                      {renderDayPopover(date, dayEntries)}
                      
                      <div className="relative z-10 pointer-events-none">
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                            isTodayDate && "bg-primary text-primary-foreground"
                          )}>
                            {format(date, 'd')}
                          </span>
                          {dayTotal > 0 && (
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] h-5 px-1.5 pointer-events-auto"
                            >
                              <Users className="w-3 h-3 mr-0.5" />
                              {dayTotal}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Source indicators */}
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {dayEntries.slice(0, 4).map((entry, idx) => {
                            const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                            return (
                              <span
                                key={idx}
                                className="text-[10px]"
                                title={`${entry.source_name}: ${entry.patient_count}`}
                              >
                                {config?.icon || '📌'}
                              </span>
                            );
                          })}
                          {dayEntries.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{dayEntries.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Monthly Summary */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Monthly Total:</span>
              <Badge variant="default" className="text-sm">
                <Users className="w-4 h-4 mr-1" />
                {dailyPatients.reduce((sum, e) => sum + e.patient_count, 0)} patients
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Click any day to view details or add patients
            </div>
          </div>
        </CardContent>
      </Card>

      <AddDailyPatientsDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialDate={addDialogDate}
        onSuccess={() => refetch()}
      />
    </>
  );
}
