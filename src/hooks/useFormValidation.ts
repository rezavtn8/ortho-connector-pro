import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ApiRequest {
  cancel: () => void;
  promise: Promise<any>;
}

export function useFormValidation() {
  const { toast } = useToast();
  const pendingRequests = useRef<Set<ApiRequest>>(new Set());

  // Cancel all pending requests
  const cancelPendingRequests = useCallback(() => {
    pendingRequests.current.forEach(request => {
      request.cancel();
    });
    pendingRequests.current.clear();
  }, []);

  // Create a cancellable request
  const createCancellableRequest = useCallback(<T>(
    requestFn: () => Promise<T>
  ): Promise<T> => {
    let isCancelled = false;
    
    const cancel = () => {
      isCancelled = true;
    };

    const promise = requestFn().then((result) => {
      if (isCancelled) {
        throw new Error('Request cancelled');
      }
      return result;
    }).catch((error) => {
      if (isCancelled) {
        throw new Error('Request cancelled');
      }
      throw error;
    });

    const request: ApiRequest = { cancel, promise };
    pendingRequests.current.add(request);

    promise.finally(() => {
      pendingRequests.current.delete(request);
    });

    return promise;
  }, []);

  // Show validation error toast
  const showValidationError = useCallback((message: string, field?: string) => {
    toast({
      title: "Validation Error",
      description: field ? `${field}: ${message}` : message,
      variant: "destructive",
    });
  }, [toast]);

  // Show success toast
  const showSuccess = useCallback((message: string, title = "Success") => {
    toast({
      title,
      description: message,
      variant: "default",
    });
  }, [toast]);

  // Show error toast
  const showError = useCallback((message: string, title = "Error") => {
    toast({
      title,
      description: message,
      variant: "destructive",
    });
  }, [toast]);

  return {
    cancelPendingRequests,
    createCancellableRequest,
    showValidationError,
    showSuccess,
    showError,
  };
}