import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, Calendar, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface DailyPatientsStatsProps {
  dailyPatients: DailyPatientEntry[];
  currentDate: Date;
  previousMonthPatients?: DailyPatientEntry[];
}

export function DailyPatientsStats({ dailyPatients, currentDate, previousMonthPatients = [] }: DailyPatientsStatsProps) {
  const monthlyTotal = dailyPatients.reduce((sum, e) => sum + e.patient_count, 0);
  const previousMonthTotal = previousMonthPatients.reduce((sum, e) => sum + e.patient_count, 0);
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weeklyPatients = dailyPatients.filter(e => {
    const date = parseISO(e.patient_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });
  const weeklyTotal = weeklyPatients.reduce((sum, e) => sum + e.patient_count, 0);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayPatients = dailyPatients.filter(e => e.patient_date === todayStr);
  const todayTotal = todayPatients.reduce((sum, e) => sum + e.patient_count, 0);

  const uniqueDays = new Set(dailyPatients.map(e => e.patient_date)).size;
  const dailyAverage = uniqueDays > 0 ? Math.round(monthlyTotal / uniqueDays) : 0;

  const monthChange = previousMonthTotal > 0 
    ? Math.round(((monthlyTotal - previousMonthTotal) / previousMonthTotal) * 100) 
    : 0;
  const isPositiveChange = monthChange >= 0;

  const stats = [
    { label: 'Today', value: todayTotal, icon: Activity, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Week', value: weeklyTotal, icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Month', value: monthlyTotal, icon: Users, color: 'text-green-500', bgColor: 'bg-green-500/10', change: monthChange },
    { label: 'Avg/Day', value: dailyAverage, icon: TrendingUp, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-md shrink-0", stat.bgColor)}>
                <stat.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", stat.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-lg sm:text-xl font-bold leading-none", stat.color)}>
                  {stat.value}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {stat.label}
                  </p>
                  {stat.change !== undefined && (
                    <span className={cn(
                      "text-[10px] flex items-center",
                      isPositiveChange ? "text-green-500" : "text-red-500"
                    )}>
                      {isPositiveChange ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                      {Math.abs(stat.change)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
