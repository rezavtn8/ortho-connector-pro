import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  endOfWeek,
  eachDayOfInterval, 
  isSameMonth
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { isToday, isSameDay, getToday, formatDateForDB } from '@/utils/dateUtils';

interface CalendarGridProps {
  currentDate: Date;
  selectedDate: Date | null;
  patientsByDate: Record<string, DailyPatientEntry[]>;
  onDateClick: (date: Date) => void;
  onAddClick: (date: Date) => void;
  onDeleteEntry: (id: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarGrid({
  currentDate,
  selectedDate,
  patientsByDate,
  onDateClick,
  onAddClick,
  onDeleteEntry,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayTotal = (dateKey: string) => {
    const entries = patientsByDate[dateKey] || [];
    return entries.reduce((sum, e) => sum + e.patient_count, 0);
  };

  const renderDayCell = (date: Date) => {
    const dateKey = formatDateForDB(date);
    const dayEntries = patientsByDate[dateKey] || [];
    const dayTotal = getDayTotal(dateKey);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const isTodayDate = isToday(date);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

    return (
      <Popover key={dateKey}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "min-h-[100px] p-2 relative border-r border-b border-border cursor-pointer transition-all",
              "hover:bg-muted/50",
              !isCurrentMonth && "bg-muted/20 text-muted-foreground",
              isTodayDate && "bg-primary/5 ring-2 ring-primary/20 ring-inset",
              isSelected && "ring-2 ring-primary ring-inset"
            )}
            onClick={() => onDateClick(date)}
          >
            {/* Date Number */}
            <div className="flex justify-between items-start mb-2">
              <span className={cn(
                "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                isTodayDate && "bg-primary text-primary-foreground",
                !isTodayDate && isCurrentMonth && "hover:bg-muted"
              )}>
                {format(date, 'd')}
              </span>
              
              {dayTotal > 0 && (
                <Badge 
                  variant="default" 
                  className={cn(
                    "text-xs h-6 px-2 font-bold shadow-sm",
                    dayTotal >= 10 && "bg-success text-success-foreground",
                    dayTotal >= 5 && dayTotal < 10 && "bg-info text-info-foreground"
                  )}
                >
                  <Users className="w-3 h-3 mr-1" />
                  {dayTotal}
                </Badge>
              )}
            </div>
            
            {/* Source indicators */}
            {dayEntries.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dayEntries.slice(0, 3).map((entry, idx) => {
                  const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded-full"
                      title={`${entry.source_name}: ${entry.patient_count}`}
                    >
                      <span>{config?.icon || '📌'}</span>
                      <span className="font-medium">{entry.patient_count}</span>
                    </div>
                  );
                })}
                {dayEntries.length > 3 && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    +{dayEntries.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {/* Empty state indicator */}
            {dayEntries.length === 0 && isCurrentMonth && (
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-lg">
                  {format(date, 'EEEE')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {format(date, 'MMMM d, yyyy')}
                </p>
              </div>
              {dayTotal > 0 && (
                <Badge variant="default" className="text-lg px-3 py-1">
                  {dayTotal}
                </Badge>
              )}
            </div>
            
            {dayEntries.length > 0 ? (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2 pr-2">
                  {dayEntries.map((entry) => {
                    const config = SOURCE_TYPE_CONFIG[entry.source_type as SourceType];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="text-xl">{config?.icon || '📌'}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {entry.source_name}
                            </span>
                            {entry.notes && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {entry.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold">
                            {entry.patient_count}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEntry(entry.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="py-6 text-center">
                <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No patients recorded
                </p>
              </div>
            )}
            
            <Button
              onClick={() => onAddClick(date)}
              className="w-full mt-4 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Patients
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
      </div>
      
      {/* Day Headers */}
      <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date) => renderDayCell(date))}
      </div>
    </div>
  );
}
