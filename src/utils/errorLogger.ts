import { supabase } from '@/integrations/supabase/client';

interface ErrorLogData {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  severity: 'error' | 'warning' | 'info' | 'critical';
  metadata?: Record<string, any>;
  userId?: string;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private queue: ErrorLogData[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  async logError(data: ErrorLogData): Promise<string | null> {
    // Add to queue for batch processing
    this.queue.push(data);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    return null; // Return immediately, actual logging is async
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 10); // Process in batches of 10
      
      for (const errorData of batch) {
        await this.logSingleError(errorData);
      }
      
      // Small delay between batches to avoid overwhelming the server
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
  }

  private async logSingleError(data: ErrorLogData, attempt: number = 1): Promise<string | null> {
    try {
      const { data: result, error } = await supabase.rpc('log_application_error', {
        p_error_message: data.message,
        p_error_stack: data.stack || null,
        p_component_stack: data.componentStack || null,
        p_url: data.url,
        p_user_agent: data.userAgent,
        p_severity: data.severity,
        p_metadata: data.metadata || {},
      });

      if (error) {
        throw error;
      }

      return result;
    } catch (error) {
      console.error(`Failed to log error (attempt ${attempt}):`, error);
      
      // Retry logic
      if (attempt < this.maxRetries) {
        await new Promise(resolve => 
          setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
        );
        return this.logSingleError(data, attempt + 1);
      }
      
      // If all retries failed, log to console and give up
      console.error(`Failed to log error after ${this.maxRetries} attempts:`, data);
      return null;
    }
  }

  // Method to log client-side errors globally
  static setupGlobalErrorHandling(): void {
    const logger = ErrorLogger.getInstance();

    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      logger.logError({
        message: event.error?.message || event.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'unhandled_error'
        }
      });
    });

    // Catch unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      logger.logError({
        message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'error',
        metadata: {
          type: 'unhandled_promise_rejection',
          reason: String(event.reason)
        }
      });
    });

    // Catch React errors (if React DevTools is available)
    if (typeof window !== 'undefined') {
      const devTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (devTools && devTools.onCommitFiberRoot) {
        const originalOnCommitFiberRoot = devTools.onCommitFiberRoot;
        devTools.onCommitFiberRoot = function(...args: any[]) {
          try {
            return originalOnCommitFiberRoot.apply(this, args);
          } catch (error: any) {
            logger.logError({
              message: error.message || 'React DevTools error',
              stack: error.stack,
              url: window.location.href,
              userAgent: navigator.userAgent,
              severity: 'warning',
              metadata: {
                type: 'react_devtools_error'
              }
            });
            throw error;
          }
        };
      }
    }
  }
}

// Initialize global error handling
if (typeof window !== 'undefined') {
  ErrorLogger.setupGlobalErrorHandling();
}

export const errorLogger = ErrorLogger.getInstance();