import { useState, useCallback, useRef } from 'react';

/**
 * Optimized state hook that prevents unnecessary re-renders
 * for array and object state updates
 */
export function useOptimizedState<T>(initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const stateRef = useRef<T>(initialValue);

  const setOptimizedState = useCallback((newValue: T | ((prev: T) => T)) => {
    const nextValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(stateRef.current)
      : newValue;

    // Only update if the value actually changed (shallow comparison for primitives)
    if (stateRef.current !== nextValue) {
      stateRef.current = nextValue;
      setState(nextValue);
    }
  }, []);

  const getCurrentState = useCallback(() => stateRef.current, []);

  return [state, setOptimizedState, getCurrentState] as const;
}

/**
 * Optimized array state hook with common array operations
 */
export function useOptimizedArray<T>(initialValue: T[] = []) {
  const [array, setArray, getCurrentArray] = useOptimizedState<T[]>(initialValue);

  const addItem = useCallback((item: T) => {
    setArray(prev => [...prev, item]);
  }, [setArray]);

  const removeItem = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index));
  }, [setArray]);

  const updateItem = useCallback((index: number, updater: T | ((prev: T) => T)) => {
    setArray(prev => prev.map((item, i) => 
      i === index 
        ? typeof updater === 'function' ? (updater as (prev: T) => T)(item) : updater
        : item
    ));
  }, [setArray]);

  const clearArray = useCallback(() => {
    setArray([]);
  }, [setArray]);

  const replaceArray = useCallback((newArray: T[]) => {
    setArray(newArray);
  }, [setArray]);

  return {
    array,
    setArray,
    getCurrentArray,
    addItem,
    removeItem,
    updateItem,
    clearArray,
    replaceArray
  };
}