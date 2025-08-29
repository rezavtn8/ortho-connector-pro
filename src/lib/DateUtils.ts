// src/utils/dateUtils.ts

import { format, parse, isValid, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';

/**
 * Parse various date formats into a standardized Date object
 */
export const parseFlexibleDate = (dateStr: string | number | Date): Date | null => {
  // If already a Date object
  if (dateStr instanceof Date) {
    return isValid(dateStr) ? dateStr : null;
  }

  // If it's a number, might be Excel serial
  if (typeof dateStr === 'number') {
    // Excel date serial number (days since 1900-01-01)
    if (dateStr > 25569 && dateStr < 50000) {
      const date = new Date((dateStr - 25569) * 86400 * 1000);
      return isValid(date) ? date : null;
    }
    // Unix timestamp
    const date = new Date(dateStr);
    return isValid(date) ? date : null;
  }

  // Convert to string for parsing
  const dateString = String(dateStr).trim();
  if (!dateString) return null;

  // Common date formats to try
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM/dd/yy',
    'M/d/yy',
    'dd/MM/yyyy',
    'd/M/yyyy',
    'dd-MM-yyyy',
    'd-M-yyyy',
    'yyyy/MM/dd',
    'MMM dd, yyyy',
    'MMMM dd, yyyy',
    'dd MMM yyyy',
    'dd MMMM yyyy',
    'yyyy-MM-dd\'T\'HH:mm:ss',
    'yyyy-MM-dd HH:mm:ss'
  ];

  // Try each format
  for (const formatStr of formats) {
    try {
      const parsedDate = parse(dateString, formatStr, new Date());
      if (isValid(parsedDate)) {
        // Handle 2-digit years
        if (formatStr.includes('yy') && !formatStr.includes('yyyy')) {
          const year = parsedDate.getFullYear();
          // Assume 00-29 means 2000-2029, 30-99 means 1930-1999
          if (year < 100) {
            parsedDate.setFullYear(year < 30 ? 2000 + year : 1900 + year);
          }
        }
        return parsedDate;
      }
    } catch {
      // Continue to next format
    }
  }

  // Try native Date parsing as last resort
  const nativeDate = new Date(dateString);
  if (isValid(nativeDate)) {
    return nativeDate;
  }

  return null;
};

/**
 * Format date for PostgreSQL (YYYY-MM-DD)
 */
export const formatForPostgres = (date: Date | string | number): string | null => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return null;
  return format(parsedDate, 'yyyy-MM-dd');
};

/**
 * Format date for month_year field (first day of month)
 */
export const formatMonthYear = (date: Date | string | number): string | null => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return null;
  return format(startOfMonth(parsedDate), 'yyyy-MM-dd');
};

/**
 * Format date for display (MMM dd, yyyy)
 */
export const formatForDisplay = (date: Date | string | number): string => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return 'N/A';
  return format(parsedDate, 'MMM dd, yyyy');
};

/**
 * Format date for charts (MMM dd)
 */
export const formatForChart = (date: Date | string | number): string => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return '';
  return format(parsedDate, 'MMM dd');
};

/**
 * Get date range for analytics
 */
export const getDateRange = (days: number) => {
  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(endDate, Math.ceil(days / 30)));
  
  return {
    startDate,
    endDate,
    startDateStr: format(startDate, 'yyyy-MM-dd'),
    endDateStr: format(endDate, 'yyyy-MM-dd')
  };
};

/**
 * Generate month labels for charts
 */
export const generateMonthLabels = (months: number): string[] => {
  const labels: string[] = [];
  const currentDate = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(currentDate, i);
    labels.push(format(date, 'MMM yyyy'));
  }
  
  return labels;
};

/**
 * Check if date is in current year
 */
export const isCurrentYear = (date: Date | string | number): boolean => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return false;
  return parsedDate.getFullYear() === new Date().getFullYear();
};

/**
 * Get month and year from date
 */
export const getMonthYear = (date: Date | string | number): { month: number; year: number } | null => {
  const parsedDate = typeof date === 'object' && date instanceof Date 
    ? date 
    : parseFlexibleDate(date);
  
  if (!parsedDate) return null;
  
  return {
    month: parsedDate.getMonth() + 1, // JavaScript months are 0-indexed
    year: parsedDate.getFullYear()
  };
};

/**
 * Validate if a string represents a valid date
 */
export const isValidDateString = (dateStr: string): boolean => {
  return parseFlexibleDate(dateStr) !== null;
};

/**
 * Get the number of days between two dates
 */
export const daysBetween = (date1: Date | string | number, date2: Date | string | number): number | null => {
  const parsedDate1 = typeof date1 === 'object' && date1 instanceof Date 
    ? date1 
    : parseFlexibleDate(date1);
  const parsedDate2 = typeof date2 === 'object' && date2 instanceof Date 
    ? date2 
    : parseFlexibleDate(date2);
  
  if (!parsedDate1 || !parsedDate2) return null;
  
  const diffTime = Math.abs(parsedDate2.getTime() - parsedDate1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};