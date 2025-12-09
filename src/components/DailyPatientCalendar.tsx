import React, { useState, useMemo } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { useDailyPatients, useDeleteDailyPatient, DailyPatientEntry } from '@/hooks/useDailyPatients';
import { AddDailyPatientsDialog } from '@/components/AddDailyPatientsDialog';
import { DailyPatientsStats } from '@/components/daily-patients/DailyPatientsStats';
import { DailyPatientsList } from '@/components/daily-patients/DailyPatientsList';
import { SourceBreakdown } from '@/components/daily-patients/SourceBreakdown';
import { CalendarGrid } from '@/components/daily-patients/CalendarGrid';
import { QuickEntryBar } from '@/components/daily-patients/QuickEntryBar';
import { MissedDaysAlert } from '@/components/daily-patients/MissedDaysAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, List, Plus } from 'lucide-react';

interface DailyPatientCalendarProps {
  className?: string;
}

export function DailyPatientCalendar({ className }: DailyPatientCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const yearMonth = format(currentDate, 'yyyy-MM');
  const prevYearMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
  
  const { data: dailyPatients = [], isLoading, refetch } = useDailyPatients(yearMonth);
  const { data: prevMonthPatients = [] } = useDailyPatients(prevYearMonth);
  const deleteDailyPatient = useDeleteDailyPatient();

  const patientsByDate = useMemo(() => {
    return dailyPatients.reduce((acc, entry) => {
      const dateKey = entry.patient_date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    }, {} as Record<string, DailyPatientEntry[]>);
  }, [dailyPatients]);

  const handleDateClick = (date: Date) => setSelectedDate(date);
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

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Compact Stats Row */}
        <DailyPatientsStats 
          dailyPatients={dailyPatients}
          currentDate={currentDate}
          previousMonthPatients={prevMonthPatients}
        />

        {/* Quick Entry Bar */}
        <QuickEntryBar onSuccess={() => refetch()} />

        {/* Missed Days Alert */}
        <MissedDaysAlert 
          dailyPatients={dailyPatients}
          onAddClick={handleAddClick}
        />

        {/* View Toggle + Actions */}
        <div className="flex items-center justify-between gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendar' | 'list')}>
            <TabsList className="h-8">
              <TabsTrigger value="calendar" className="gap-1.5 text-xs h-7 px-2.5">
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-xs h-7 px-2.5">
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => handleAddClick(new Date())}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Multi-Source</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Main Content */}
        {viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3">
              <CalendarGrid
                currentDate={currentDate}
                selectedDate={selectedDate}
                patientsByDate={patientsByDate}
                onDateClick={handleDateClick}
                onAddClick={handleAddClick}
                onDeleteEntry={handleDeleteEntry}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
              />
            </div>
            <div className="xl:col-span-1">
              <SourceBreakdown entries={dailyPatients} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyPatientsList
                entries={dailyPatients}
                onDelete={handleDeleteEntry}
                isDeleting={deleteDailyPatient.isPending}
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
              />
            </div>
            <div className="lg:col-span-1">
              <SourceBreakdown entries={dailyPatients} />
            </div>
          </div>
        )}
      </div>

      <AddDailyPatientsDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialDate={addDialogDate}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
