import React from 'react';
import { DailyPatientCalendar } from '@/components/DailyPatientCalendar';
import { CalendarDays } from 'lucide-react';

export default function DailyPatients() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold page-title">Daily Patient Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage patient visits by day and source
            </p>
          </div>
        </div>
      </div>
      
      <DailyPatientCalendar />
    </div>
  );
}
