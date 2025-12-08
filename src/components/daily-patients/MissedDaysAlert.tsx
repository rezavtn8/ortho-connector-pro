import React, { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import { 
  format, 
  subDays, 
  eachDayOfInterval, 
  isWeekend,
  startOfDay 
} from 'date-fns';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';

interface MissedDaysAlertProps {
  dailyPatients: DailyPatientEntry[];
  onAddClick: (date: Date) => void;
}

export function MissedDaysAlert({ dailyPatients, onAddClick }: MissedDaysAlertProps) {
  const missedDays = useMemo(() => {
    const today = startOfDay(new Date());
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: subDays(today, 1), // Don't include today
    });

    // Get dates with entries
    const datesWithEntries = new Set(
      dailyPatients.map(p => format(new Date(p.patient_date), 'yyyy-MM-dd'))
    );

    // Find weekdays without entries
    return last7Days
      .filter(date => !isWeekend(date)) // Skip weekends
      .filter(date => !datesWithEntries.has(format(date, 'yyyy-MM-dd')));
  }, [dailyPatients]);

  if (missedDays.length === 0) return null;

  return (
    <Alert variant="default" className="border-warning/50 bg-warning/5">
      <AlertCircle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            Missing patient data for {missedDays.length} day{missedDays.length !== 1 ? 's' : ''}:
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {missedDays.slice(0, 3).map((date) => (
              <Badge 
                key={format(date, 'yyyy-MM-dd')}
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => onAddClick(date)}
              >
                <Calendar className="w-3 h-3 mr-1" />
                {format(date, 'EEE, MMM d')}
              </Badge>
            ))}
            {missedDays.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{missedDays.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        {missedDays.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="shrink-0 gap-1"
            onClick={() => onAddClick(missedDays[0])}
          >
            Add Now
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
