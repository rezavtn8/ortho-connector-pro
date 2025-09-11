/**
 * Date Helper Utilities 
 * Common date operations using the synchronized date/time manager
 */

import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { now, getCurrentYearMonth } from '@/lib/dateSync';

/**
 * Get an array of the last N months in YYYY-MM format
 */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const currentDate = now();
  
  for (let i = n - 1; i >= 0; i--) {
    const monthDate = subMonths(currentDate, i);
    const year = monthDate.getFullYear();
    const month = (monthDate.getMonth() + 1).toString().padStart(2, '0');
    months.push(`${year}-${month}`);
  }
  
  return months;
}

/**
 * Get month range for analytics (start and end dates)
 */
export function getMonthRange(monthsBack: number = 12) {
  const currentDate = now();
  const startDate = startOfMonth(subMonths(currentDate, monthsBack - 1));
  const endDate = endOfMonth(currentDate);
  
  return {
    start: startDate,
    end: endDate,
    startFormatted: format(startDate, 'yyyy-MM-dd'),
    endFormatted: format(endDate, 'yyyy-MM-dd')
  };
}

/**
 * Check if a date is within the last N days
 */
export function isWithinLastNDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date(now().getTime() - (days * 24 * 60 * 60 * 1000));
  return date >= cutoff;
}

/**
 * Get the next month in YYYY-MM format
 */
export function getNextMonth(): string {
  const nextMonth = addMonths(now(), 1);
  const year = nextMonth.getFullYear();
  const month = (nextMonth.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get the previous month in YYYY-MM format
 */
export function getPreviousMonth(): string {
  const prevMonth = subMonths(now(), 1);
  const year = prevMonth.getFullYear();
  const month = (prevMonth.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format a year-month string for display
 */
export function formatMonthDisplay(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMM yyyy');
}

/**
 * Get age in months between two dates
 */
export function getAgeInMonths(fromDate: Date, toDate?: Date): number {
  const to = toDate || now();
  const yearDiff = to.getFullYear() - fromDate.getFullYear();
  const monthDiff = to.getMonth() - fromDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

/**
 * Sync time across the app by refreshing date manager
 */
export function refreshTimeSync(): void {
  // Force a time sync check
  const currentTime = now();
  console.log('Time synced:', format(currentTime, 'PPpp'));
}