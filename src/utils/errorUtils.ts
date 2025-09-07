// Error utility functions for consistent error handling across the app
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userMessage?: string;
}

export class CustomError extends Error implements AppError {
  public code?: string;
  public statusCode?: number;
  public context?: Record<string, unknown>;
  public severity?: 'low' | 'medium' | 'high' | 'critical';
  public userMessage?: string;

  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    context?: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userMessage?: string
  ) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.severity = severity;
    this.userMessage = userMessage;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

// Common error types
export class NetworkError extends CustomError {
  constructor(message: string = 'Network request failed', context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 0, context, 'medium', 'Connection failed. Please check your internet and try again.');
    this.name = 'NetworkError';
  }
}

export class ValidationError extends CustomError {
  constructor(message: string = 'Validation failed', context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context, 'low', 'Please check your input and try again.');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, context, 'high', 'Please sign in to continue.');
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends CustomError {
  constructor(message: string = 'Permission denied', context?: Record<string, unknown>) {
    super(message, 'PERMISSION_ERROR', 403, context, 'medium', 'You do not have permission to perform this action.');
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, context, 'low', 'The requested item could not be found.');
    this.name = 'NotFoundError';
  }
}

export class SupabaseError extends CustomError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    const userMessage = getUserFriendlySupabaseMessage(code, message);
    super(message, code || 'SUPABASE_ERROR', 500, context, 'medium', userMessage);
    this.name = 'SupabaseError';
  }
}

// Error handling utilities
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || 
         (error instanceof Error && error.message.includes('fetch'));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof CustomError) {
    return error.code;
  }
  return undefined;
}

// Async error wrapper
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context || 'operation'}:`, error);
    throw error;
  }
}

// Retry logic with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on client errors (4xx)
      if (error instanceof CustomError && error.statusCode && 
          error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Safe JSON parsing
export function safeJsonParse<T>(jsonString: string, fallback?: T): T | null {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback ?? null;
  }
}

// Central error handler with logging and user feedback
export class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  async handleError(error: unknown, context?: string, showToast = true): Promise<void> {
    const processedError = this.processError(error, context);
    
    // Log to console for development
    console.error(`[${context || 'Unknown'}] Error:`, processedError);
    
    // Log to Supabase for tracking
    await this.logErrorToSupabase(processedError, context);
    
    // Show user-friendly toast if requested
    if (showToast && processedError.userMessage) {
      toast({
        title: 'Error',
        description: processedError.userMessage,
        variant: 'destructive',
        duration: processedError.severity === 'critical' ? 10000 : 5000,
      });
    }
  }

  private processError(error: unknown, context?: string): AppError {
    if (error instanceof CustomError) {
      return error;
    }

    if (error instanceof Error) {
      // Check if it's a Supabase error
      if (error.message.includes('PostgreSQL') || error.message.includes('supabase')) {
        return new SupabaseError(error.message, undefined, { context, originalError: error.name });
      }

      // Check if it's a network error
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new NetworkError(error.message, { context, originalError: error.name });
      }

      // Generic error
      return new CustomError(
        error.message,
        'GENERIC_ERROR',
        500,
        { context, originalError: error.name },
        'medium',
        'An unexpected error occurred. Please try again.'
      );
    }

    // Unknown error type
    return new CustomError(
      'Unknown error occurred',
      'UNKNOWN_ERROR',
      500,
      { context, error: String(error) },
      'medium',
      'An unexpected error occurred. Please try again.'
    );
  }

  private async logErrorToSupabase(error: AppError, context?: string): Promise<void> {
    try {
      await supabase.rpc('log_application_error', {
        p_error_message: error.message,
        p_error_stack: error.stack || '',
        p_component_stack: context || '',
        p_url: window.location.href,
        p_user_agent: navigator.userAgent,
        p_severity: error.severity || 'medium',
        p_metadata: {
          code: error.code || null,
          statusCode: error.statusCode || null,
          context: JSON.stringify(error.context || {}),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.warn('Failed to log error to Supabase:', logError);
    }
  }
}

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance();

// Convenient wrapper for async operations
export async function handleAsync<T>(
  operation: () => Promise<T>,
  context?: string,
  showToast = true
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    await errorHandler.handleError(error, context, showToast);
    return null;
  }
}

// Supabase-specific error wrapper
export async function handleSupabaseOperation<T>(
  operation: () => Promise<{ data: T; error: any }>,
  context?: string,
  showToast = true
): Promise<T | null> {
  try {
    const { data, error } = await operation();
    if (error) {
      throw new SupabaseError(error.message, error.code, { context, error });
    }
    return data;
  } catch (error) {
    await errorHandler.handleError(error, context, showToast);
    return null;
  }
}

// User-friendly Supabase error messages
function getUserFriendlySupabaseMessage(code?: string, message?: string): string {
  if (!code) return 'A database error occurred. Please try again.';

  switch (code) {
    case 'PGRST301':
      return 'You do not have permission to access this data.';
    case 'PGRST204':
      return 'The requested item was not found.';
    case 'PGRST116':
      return 'Invalid data format provided.';
    case '23505':
      return 'This item already exists.';
    case '23503':
      return 'Cannot delete this item as it is being used elsewhere.';
    case '42501':
      return 'You do not have permission to perform this action.';
    case 'auth/invalid-email':
      return 'Please provide a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password provided.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    default:
      if (message?.includes('network')) {
        return 'Connection failed. Please check your internet and try again.';
      }
      if (message?.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      return 'A database error occurred. Please try again.';
  }
}