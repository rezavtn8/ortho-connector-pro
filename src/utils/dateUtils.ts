import { startOfDay, format, isToday as dateFnsIsToday, isYesterday as dateFnsIsYesterday, isSameDay as dateFnsIsSameDay } from 'date-fns';

/**
 * Get today's date normalized to midnight local time
 * This avoids timezone issues when comparing dates
 */
export function getToday(): Date {
  return startOfDay(new Date());
}

/**
 * Normalize any date to midnight local time
 * This ensures consistent date comparisons regardless of time component
 */
export function normalizeDate(date: Date): Date {
  return startOfDay(date);
}

/**
 * Check if a date is today (timezone-safe)
 */
export function isToday(date: Date): boolean {
  return dateFnsIsToday(startOfDay(date));
}

/**
 * Check if a date is yesterday (timezone-safe)
 */
export function isYesterday(date: Date): boolean {
  return dateFnsIsYesterday(startOfDay(date));
}

/**
 * Check if two dates are the same day (timezone-safe)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return dateFnsIsSameDay(startOfDay(date1), startOfDay(date2));
}

/**
 * Format a date for database storage (YYYY-MM-DD)
 * Always uses the local date, avoiding timezone shifts
 */
export function formatDateForDB(date: Date): string {
  return format(startOfDay(date), 'yyyy-MM-dd');
}

/**
 * Format a date for display
 */
export function formatDateDisplay(date: Date, formatStr: string = 'MMM d, yyyy'): string {
  return format(date, formatStr);
}

/**
 * Parse a date string from DB and return normalized local date
 */
export function parseDateFromDB(dateStr: string): Date {
  // Parse as local date by splitting the string
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
