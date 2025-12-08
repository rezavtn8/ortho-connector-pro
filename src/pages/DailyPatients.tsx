import React from 'react';
import { DailyPatientCalendar } from '@/components/DailyPatientCalendar';
import { CalendarDays } from 'lucide-react';

export default function DailyPatients() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8 title-icon" />
          <h1 className="text-2xl sm:text-4xl font-bold page-title">Daily Patient Tracking</h1>
        </div>
        <p className="text-muted-foreground">
          Track patients by day and source. Click any date to add or view patient entries.
        </p>
      </div>
      
      <DailyPatientCalendar />
    </div>
  );
}
