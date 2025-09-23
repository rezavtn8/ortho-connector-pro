import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface ErrorToastOptions {
  title?: string;
  description: string;
  retryFn?: () => void | Promise<void>;
  retryLabel?: string;
}

export function useErrorToast() {
  const showErrorToast = useCallback(({
    title = "Error",
    description,
    retryFn,
    retryLabel = "Retry"
  }: ErrorToastOptions) => {
    // For now, show simple toast without retry action
    // The retry functionality can be added at component level
    toast({
      title,
      description,
      variant: "destructive",
    });

    // If retry function is provided, log it for now
    if (retryFn) {
      console.log('Retry function available:', retryLabel);
    }
  }, []);

  const showSuccessToast = useCallback((description: string, title = "Success") => {
    toast({
      title,
      description,
    });
  }, []);

  const showRetryableErrorToast = useCallback((description: string, onRetry: () => void, title = "Error") => {
    // This function returns the retry callback to be used by components
    toast({
      title,
      description,
      variant: "destructive",
    });
    
    return onRetry;
  }, []);

  return { showErrorToast, showSuccessToast, showRetryableErrorToast };
}