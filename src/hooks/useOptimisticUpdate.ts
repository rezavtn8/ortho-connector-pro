import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface OptimisticUpdateOptions<T> {
  queryKey: string[];
  updateFn: (oldData: T) => T;
  mutationFn: () => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useOptimisticUpdate<T>({
  queryKey,
  updateFn,
  mutationFn,
  successMessage,
  errorMessage = 'Operation failed',
  onSuccess,
  onError,
}: OptimisticUpdateOptions<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const execute = useCallback(async () => {
    setIsLoading(true);

    // Get current data
    const previousData = queryClient.getQueryData<T>(queryKey);
    
    // Optimistically update
    if (previousData) {
      queryClient.setQueryData(queryKey, updateFn(previousData));
    }

    try {
      // Execute mutation
      await mutationFn();
      
      // Invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey });
      
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
      
      onSuccess?.();
    } catch (error) {
      // Rollback optimistic update
      if (previousData) {
        queryClient.setQueryData(queryKey, previousData);
      }
      
      const errorMsg = error instanceof Error ? error.message : errorMessage;
      
      // Show error toast - retry functionality should be implemented at component level
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      
      onError?.(error instanceof Error ? error : new Error(errorMsg));
    } finally {
      setIsLoading(false);
    }
  }, [queryKey, updateFn, mutationFn, successMessage, errorMessage, onSuccess, onError, queryClient]);

  return { execute, isLoading };
}