import { useCallback, useRef, useState } from 'react';

// Optimized state hook that batches updates and prevents unnecessary renders
export function useOptimizedState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Array<(prev: T) => T>>([]);

  const setOptimizedState = useCallback((updater: (prev: T) => T) => {
    // Batch updates to prevent excessive re-renders
    pendingUpdatesRef.current.push(updater);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        let result = prev;
        for (const update of pendingUpdatesRef.current) {
          result = update(result);
        }
        pendingUpdatesRef.current = [];
        return result;
      });
      updateTimeoutRef.current = null;
    }, 0); // Batch in next tick
  }, []);

  const setImmediateState = useCallback((updater: (prev: T) => T) => {
    setState(updater);
  }, []);

  return {
    state,
    setState: setOptimizedState,
    setImmediateState
  };
}

// Optimized array hook for handling arrays with deduplication
export function useOptimizedArray<T>(initialArray: T[] = []) {
  const { state: array, setState, setImmediateState } = useOptimizedState<T[]>(initialArray);

  const addItem = useCallback((item: T) => {
    setState(prev => [...prev, item]);
  }, [setState]);

  const removeItem = useCallback((index: number) => {
    setState(prev => prev.filter((_, i) => i !== index));
  }, [setState]);

  const updateItem = useCallback((index: number, item: T) => {
    setState(prev => prev.map((current, i) => i === index ? item : current));
  }, [setState]);

  const clearArray = useCallback(() => {
    setImmediateState(() => []);
  }, [setImmediateState]);

  const replaceArray = useCallback((newArray: T[]) => {
    setImmediateState(() => newArray);
  }, [setImmediateState]);

  return {
    array,
    addItem,
    removeItem,
    updateItem,
    clearArray,
    replaceArray,
    setArray: setState
  };
}