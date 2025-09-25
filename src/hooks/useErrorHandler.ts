import { useCallback } from 'react';
import { useErrorReporting } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  reportToServer?: boolean;
  toastTitle?: string;
  toastDescription?: string;
}

export function useErrorHandler() {
  const { reportError } = useErrorReporting();
  const { toast } = useToast();

  const handleError = useCallback(async (
    error: Error,
    context?: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      reportToServer = true,
      toastTitle = 'Error',
      toastDescription = 'Something went wrong. Please try again.'
    } = options;

    // Log to console if requested
    if (logToConsole) {
      console.error(`Error in ${context || 'unknown context'}:`, error);
    }

    // Show toast notification if requested
    if (showToast) {
      toast({
        title: toastTitle,
        description: toastDescription,
        variant: 'destructive'
      });
    }

    // Report to server if requested
    if (reportToServer) {
      try {
        await reportError(error, {
          level: 'error',
          metadata: { context: context || 'unknown' }
        });
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }, [reportError, toast]);

  const handleAsyncError = useCallback(async (
    errorPromise: Promise<any>,
    context?: string,
    options?: ErrorHandlerOptions
  ) => {
    try {
      return await errorPromise;
    } catch (error) {
      await handleError(error as Error, context, options);
      throw error; // Re-throw so the caller can handle it appropriately
    }
  }, [handleError]);

  const wrapAsync = useCallback(<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: string,
    options?: ErrorHandlerOptions
  ): T => {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        await handleError(error as Error, context, options);
        throw error;
      }
    }) as T;
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    wrapAsync
  };
}