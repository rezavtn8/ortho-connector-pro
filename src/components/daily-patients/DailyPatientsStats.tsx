import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, TrendingUp, Calendar, Activity, ArrowUp, ArrowDown, Database, AlertCircle } from 'lucide-react';
import { DailyPatientEntry, MonthlyPatientData, getWorkingDaysInMonth } from '@/hooks/useDailyPatients';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface DailyPatientsStatsProps {
  dailyPatients: DailyPatientEntry[];
  currentDate: Date;
  previousMonthPatients?: DailyPatientEntry[];
  // New: monthly data for fallback when no daily entries exist
  monthlyData?: MonthlyPatientData[];
  previousMonthlyData?: MonthlyPatientData[];
}

export function DailyPatientsStats({ 
  dailyPatients, 
  currentDate, 
  previousMonthPatients = [],
  monthlyData = [],
  previousMonthlyData = []
}: DailyPatientsStatsProps) {
  const yearMonth = format(currentDate, 'yyyy-MM');
  
  // Determine data source
  const hasDailyData = dailyPatients.length > 0;
  const hasMonthlyData = monthlyData.length > 0;
  
  // Calculate monthly totals from appropriate source
  const monthlyTotalFromDaily = dailyPatients.reduce((sum, e) => sum + e.patient_count, 0);
  const monthlyTotalFromMonthly = monthlyData.reduce((sum, e) => sum + e.patient_count, 0);
  const monthlyTotal = hasDailyData ? monthlyTotalFromDaily : monthlyTotalFromMonthly;
  
  // Previous month totals
  const previousMonthTotalFromDaily = previousMonthPatients.reduce((sum, e) => sum + e.patient_count, 0);
  const previousMonthTotalFromMonthly = previousMonthlyData.reduce((sum, e) => sum + e.patient_count, 0);
  const previousMonthTotal = previousMonthPatients.length > 0 
    ? previousMonthTotalFromDaily 
    : previousMonthTotalFromMonthly;
  
  // Week stats (only available with daily data)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weeklyPatients = dailyPatients.filter(e => {
    const date = parseISO(e.patient_date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });
  const weeklyTotal = weeklyPatients.reduce((sum, e) => sum + e.patient_count, 0);

  // Today's stats (only available with daily data)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayPatients = dailyPatients.filter(e => e.patient_date === todayStr);
  const todayTotal = todayPatients.reduce((sum, e) => sum + e.patient_count, 0);

  // Daily average calculation
  let dailyAverage: number;
  if (hasDailyData) {
    // Use actual unique days with entries
    const uniqueDays = new Set(dailyPatients.map(e => e.patient_date)).size;
    dailyAverage = uniqueDays > 0 ? Math.round(monthlyTotal / uniqueDays) : 0;
  } else if (hasMonthlyData) {
    // Estimate based on working days in month
    const workingDays = getWorkingDaysInMonth(yearMonth);
    dailyAverage = workingDays > 0 ? Math.round(monthlyTotal / workingDays) : 0;
  } else {
    dailyAverage = 0;
  }

  // Month-over-month change
  const monthChange = previousMonthTotal > 0 
    ? Math.round(((monthlyTotal - previousMonthTotal) / previousMonthTotal) * 100) 
    : monthlyTotal > 0 ? 100 : 0;
  const isPositiveChange = monthChange >= 0;

  // Data source indicator
  const dataSourceLabel = hasDailyData 
    ? 'Daily tracking' 
    : hasMonthlyData 
    ? 'Monthly totals' 
    : 'No data';

  const stats = [
    { 
      label: 'Today', 
      value: hasDailyData ? todayTotal : '—',
      icon: Activity, 
      color: 'text-primary', 
      bgColor: 'bg-primary/10',
      tooltip: hasDailyData 
        ? `${todayPatients.length} entries today` 
        : 'Add daily entries to track today\'s patients'
    },
    { 
      label: 'Week', 
      value: hasDailyData ? weeklyTotal : '—',
      icon: Calendar, 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-500/10',
      tooltip: hasDailyData 
        ? `${weeklyPatients.length} entries this week` 
        : 'Weekly stats require daily tracking'
    },
    { 
      label: 'Month', 
      value: monthlyTotal, 
      icon: Users, 
      color: 'text-green-500', 
      bgColor: 'bg-green-500/10', 
      change: monthChange,
      tooltip: `${hasDailyData ? 'From daily entries' : 'Monthly total'} - ${monthChange >= 0 ? '+' : ''}${monthChange}% vs last month`
    },
    { 
      label: 'Avg/Day', 
      value: dailyAverage, 
      icon: TrendingUp, 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-500/10',
      tooltip: hasDailyData 
        ? `Based on ${new Set(dailyPatients.map(e => e.patient_date)).size} active days` 
        : `Estimated from ${getWorkingDaysInMonth(yearMonth)} working days`,
      estimated: !hasDailyData && hasMonthlyData
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Data source indicator */}
        {!hasDailyData && hasMonthlyData && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="w-3 h-3" />
            <span>Showing monthly totals. Add daily entries for detailed tracking.</span>
          </div>
        )}
        
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {stats.map((stat) => (
            <Tooltip key={stat.label}>
              <TooltipTrigger asChild>
                <Card className="relative overflow-hidden cursor-help">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-md shrink-0", stat.bgColor)}>
                        <stat.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", stat.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-lg sm:text-xl font-bold leading-none",
                          stat.value === '—' ? "text-muted-foreground" : stat.color
                        )}>
                          {stat.value}
                          {stat.estimated && (
                            <span className="text-[10px] ml-1 text-muted-foreground">~</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                            {stat.label}
                          </p>
                          {stat.change !== undefined && typeof stat.value === 'number' && (
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
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{stat.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
