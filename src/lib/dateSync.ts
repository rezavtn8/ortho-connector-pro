/**
 * Centralized Date/Time Synchronization Utility
 * Ensures consistent date and time handling across the application
 */

import { format, startOfDay, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';

class DateTimeManager {
  private static instance: DateTimeManager;
  private baseTime: Date | null = null;
  private offsetMs: number = 0;

  private constructor() {}

  public static getInstance(): DateTimeManager {
    if (!DateTimeManager.instance) {
      DateTimeManager.instance = new DateTimeManager();
    }
    return DateTimeManager.instance;
  }

  /**
   * Get the current synchronized date/time
   */
  public now(): Date {
    if (this.baseTime) {
      return new Date(this.baseTime.getTime() + this.offsetMs + (Date.now() - this.baseTime.getTime()));
    }
    return new Date();
  }

  /**
   * Sync with server time (if needed)
   */
  public syncWithServer(serverTime?: string): void {
    if (serverTime) {
      const serverDate = new Date(serverTime);
      const localDate = new Date();
      this.offsetMs = serverDate.getTime() - localDate.getTime();
      this.baseTime = localDate;
      console.log(`Time synced with server. Offset: ${this.offsetMs}ms`);
    }
  }

  /**
   * Get current date at start of day (00:00:00)
   */
  public today(): Date {
    return startOfDay(this.now());
  }

  /**
   * Get current year-month in YYYY-MM format
   */
  public getCurrentYearMonth(): string {
    const now = this.now();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get current date in ISO format for database storage
   */
  public nowISO(): string {
    return this.now().toISOString();
  }

  /**
   * Get current date in PostgreSQL format (YYYY-MM-DD)
   */
  public nowPostgres(): string {
    return format(this.now(), 'yyyy-MM-dd');
  }

  /**
   * Get start of current month
   */
  public startOfCurrentMonth(): Date {
    return startOfMonth(this.now());
  }

  /**
   * Get end of current month
   */
  public endOfCurrentMonth(): Date {
    return endOfMonth(this.now());
  }

  /**
   * Get a date N days from now
   */
  public daysFromNow(days: number): Date {
    return addDays(this.now(), days);
  }

  /**
   * Get date N months ago
   */
  public monthsAgo(months: number): Date {
    return subMonths(this.now(), months);
  }

  /**
   * Format current time for display
   */
  public formatNow(formatString: string = 'PPP'): string {
    return format(this.now(), formatString);
  }

  /**
   * Get timestamp for logging
   */
  public timestamp(): number {
    return this.now().getTime();
  }

  /**
   * Check if we're in a new day since last check
   */
  private lastDayCheck: string | null = null;
  public isNewDay(): boolean {
    const currentDay = format(this.now(), 'yyyy-MM-dd');
    if (this.lastDayCheck !== currentDay) {
      this.lastDayCheck = currentDay;
      return true;
    }
    return false;
  }

  /**
   * Get timezone info
   */
  public getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Create a date relative to current synchronized time
   */
  public createDate(year?: number, month?: number, day?: number, hours?: number, minutes?: number, seconds?: number): Date {
    const now = this.now();
    return new Date(
      year ?? now.getFullYear(),
      month ?? now.getMonth(),
      day ?? now.getDate(),
      hours ?? now.getHours(),
      minutes ?? now.getMinutes(),
      seconds ?? now.getSeconds()
    );
  }
}

// Export singleton instance
export const dateTime = DateTimeManager.getInstance();

// Convenience exports for common operations
export const now = () => dateTime.now();
export const today = () => dateTime.today();
export const getCurrentYearMonth = () => dateTime.getCurrentYearMonth();
export const nowISO = () => dateTime.nowISO();
export const nowPostgres = () => dateTime.nowPostgres();
export const timestamp = () => dateTime.timestamp();

// Auto-sync with server on load (optional)
export const initializeTimeSync = async () => {
  try {
    // You could fetch server time from an API endpoint if needed
    // For now, we'll rely on local time
    dateTime.syncWithServer();
    console.log('Date/Time manager initialized');
  } catch (error) {
    console.warn('Could not sync with server time, using local time:', error);
  }
};

export default dateTime;