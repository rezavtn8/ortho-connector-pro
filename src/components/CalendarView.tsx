import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
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

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'visit' | 'campaign' | 'deadline';
  status?: string;
  description?: string;
}

interface CalendarViewProps {
  events?: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
  className?: string;
}

const EVENT_COLORS = {
  visit: 'bg-blue-100 text-blue-800 border-blue-200',
  campaign: 'bg-purple-100 text-purple-800 border-purple-200',
  deadline: 'bg-red-100 text-red-800 border-red-200'
};

export function CalendarView({
  events = [],
  onDateClick,
  onEventClick,
  onAddEvent,
  className
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = format(event.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const renderEventPopover = (date: Date, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="absolute bottom-1 right-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              dayEvents.length > 3 ? "bg-primary" : "bg-blue-500"
            )} />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4">
            <h4 className="font-semibold mb-2">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h4>
            <div className="space-y-2">
              {dayEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full mt-0.5 flex-shrink-0",
                    event.type === 'visit' && "bg-blue-500",
                    event.type === 'campaign' && "bg-purple-500",
                    event.type === 'deadline' && "bg-red-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                    )}
                    {event.status && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {event.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {dayEvents.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  +{dayEvents.length - 5} more events
                </p>
              )}
            </div>
            {onAddEvent && (
              <div className="pt-3 border-t mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddEvent(date)}
                  className="w-full gap-2"
                >
                  <Plus className="w-3 h-3" />
                  Add Event
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendar View
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-muted rounded-md overflow-hidden">
          {/* Header */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="bg-muted-foreground/10 p-2 text-center text-xs font-medium text-muted-foreground h-8 flex items-center justify-center"
            >
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {calendarDays.map((date, index) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isTodayDate = isToday(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);

            return (
              <div
                key={index}
                className={cn(
                  "bg-background min-h-[100px] p-2 cursor-pointer relative hover:bg-muted/50 transition-colors border-r border-b border-muted",
                  !isCurrentMonth && "text-muted-foreground bg-muted/30",
                  isTodayDate && "bg-primary/10 border-primary/20",
                  isSelected && "bg-primary/20 border-primary/40"
                )}
                onClick={() => handleDateClick(date)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isTodayDate && "font-bold text-primary bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    !isCurrentMonth && "text-muted-foreground"
                  )}>
                    {format(date, 'd')}
                  </span>
                </div>
                
                {/* Events */}
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={cn(
                        "text-xs px-1 py-0.5 rounded border truncate",
                        EVENT_COLORS[event.type]
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
                
                {/* Event Indicator & Popover */}
                {renderEventPopover(date, dayEvents)}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <span className="text-sm font-medium">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs">Visits</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs">Campaigns</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs">Deadlines</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}