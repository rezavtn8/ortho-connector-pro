import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Calendar, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { DailyPatientEntry } from '@/hooks/useDailyPatients';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface DailyPatientsStatsProps {
  dailyPatients: DailyPatientEntry[];
  currentDate: Date;
  previousMonthPatients?: DailyPatientEntry[];
}

export function DailyPatientsStats({ dailyPatients, currentDate, previousMonthPatients = [] }: DailyPatientsStatsProps) {
  // Calculate stats
  const monthlyTotal = dailyPatients.reduce((sum, e) => sum + e.patient_count, 0);
  const previousMonthTotal = previousMonthPatients.reduce((sum, e) => sum + e.patient_count, 0);
  
  // Week stats
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weeklyPatients = dailyPatients.filter(e => {
    const date = parseISO(e.patient_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });
  const weeklyTotal = weeklyPatients.reduce((sum, e) => sum + e.patient_count, 0);

  // Today's stats
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayPatients = dailyPatients.filter(e => e.patient_date === todayStr);
  const todayTotal = todayPatients.reduce((sum, e) => sum + e.patient_count, 0);

  // Daily average
  const uniqueDays = new Set(dailyPatients.map(e => e.patient_date)).size;
  const dailyAverage = uniqueDays > 0 ? Math.round(monthlyTotal / uniqueDays) : 0;

  // Month-over-month change
  const monthChange = previousMonthTotal > 0 
    ? Math.round(((monthlyTotal - previousMonthTotal) / previousMonthTotal) * 100) 
    : 0;
  const isPositiveChange = monthChange >= 0;

  const stats = [
    {
      label: 'Today',
      value: todayTotal,
      icon: Activity,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: `${todayPatients.length} sources`
    },
    {
      label: 'This Week',
      value: weeklyTotal,
      icon: Calendar,
      color: 'text-info',
      bgColor: 'bg-info/10',
      description: `${weeklyPatients.length} entries`
    },
    {
      label: 'This Month',
      value: monthlyTotal,
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: (
        <span className={cn("flex items-center gap-1", isPositiveChange ? "text-success" : "text-destructive")}>
          {isPositiveChange ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(monthChange)}% vs last month
        </span>
      )
    },
    {
      label: 'Daily Avg',
      value: dailyAverage,
      icon: TrendingUp,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      description: `${uniqueDays} active days`
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className={cn("absolute inset-0 opacity-50", stat.bgColor)} />
          <CardContent className="relative p-4">
            <div className="flex items-start justify-between mb-2">
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <Badge variant="secondary" className="text-xs">
                {stat.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className={cn("text-3xl font-bold", stat.color)}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
