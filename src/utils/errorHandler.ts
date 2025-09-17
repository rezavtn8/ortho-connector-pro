import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// Error classes inline
class CustomError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CustomError';
  }
}

class NetworkError extends CustomError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends CustomError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
};

const getErrorCode = (error: unknown): string => {
  if (error instanceof CustomError && error.code) return error.code;
  return 'UNKNOWN_ERROR';
};

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;

  private constructor() {}

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Handle errors with user feedback and logging
   */
  async handleError(error: unknown, context?: ErrorContext): Promise<void> {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);
    
    console.error(`Error in ${context?.component || 'unknown'}:`, error);

    // Log to Supabase
    await this.logError(error, context);

    // Show user-friendly toast
    this.showErrorToast(error, errorMessage);
  }

  /**
   * Handle async operations with error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: {
      showToast?: boolean;
      fallback?: T;
    }
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error, context);
      
      if (options?.fallback !== undefined) {
        return options.fallback;
      }
      
      return null;
    }
  }

  /**
   * Handle optimistic updates
   */
  async withOptimisticUpdate<T>(
    queryKey: string,
    optimisticData: T,
    mutation: () => Promise<T>,
    queryClient: any,
    context: ErrorContext
  ): Promise<T | null> {
    // Set optimistic data
    queryClient.setQueryData(queryKey, optimisticData);

    try {
      const result = await mutation();
      // Update with real data
      queryClient.setQueryData(queryKey, result);
      return result;
    } catch (error) {
      // Revert optimistic update
      queryClient.invalidateQueries(queryKey);
      await this.handleError(error, context);
      return null;
    }
  }

  /**
   * Log error to Supabase
   */
  private async logError(error: unknown, context?: ErrorContext): Promise<void> {
    try {
      const errorData = {
        p_error_message: getErrorMessage(error),
        p_error_stack: error instanceof Error ? error.stack : undefined,
        p_component_stack: context?.component,
        p_url: window.location.href,
        p_user_agent: navigator.userAgent,
        p_severity: this.getErrorSeverity(error),
        p_metadata: {
          ...context?.metadata,
          errorCode: getErrorCode(error),
          timestamp: new Date().toISOString(),
        }
      };

      await supabase.rpc('log_application_error', errorData);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Show appropriate toast based on error type
   */
  private showErrorToast(error: unknown, message: string): void {
    if (error instanceof AuthenticationError) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive",
      });
      return;
    }

    if (error instanceof ValidationError) {
      toast({
        title: "Validation Error",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (error instanceof NetworkError) {
      toast({
        title: "Connection Error",
        description: "Please check your internet connection and try again",
        variant: "destructive",
      });
      return;
    }

    // Default error toast
    toast({
      title: "Something went wrong",
      description: this.sanitizeErrorMessage(message),
      variant: "destructive",
    });
  }

  /**
   * Get error severity level
   */
  private getErrorSeverity(error: unknown): string {
    if (error instanceof AuthenticationError) return 'warning';
    if (error instanceof ValidationError) return 'info';
    if (error instanceof NetworkError) return 'warning';
    return 'error';
  }

  /**
   * Sanitize error message for user display
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove technical details that users don't need to see
    const sanitized = message
      .replace(/supabase/gi, 'database')
      .replace(/postgres/gi, 'database')
      .replace(/rpc/gi, 'operation')
      .replace(/uuid/gi, 'ID');

    // Limit message length
    return sanitized.length > 100 ? sanitized.substring(0, 100) + '...' : sanitized;
  }
}

// Export singleton instance
export const errorHandler = GlobalErrorHandler.getInstance();

// Convenience function for quick error handling
export const handleError = (error: unknown, context?: ErrorContext) => 
  errorHandler.handleError(error, context);

// Convenience function for async operations
export const withErrorHandling = <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options?: { showToast?: boolean; fallback?: T }
) => errorHandler.withErrorHandling(operation, context, options);