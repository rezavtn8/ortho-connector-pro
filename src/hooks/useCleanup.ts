import { useRef, useEffect, useCallback } from 'react';

interface CleanupManager {
  timeouts: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;
  abortControllers: Set<AbortController>;
  subscriptions: Set<{ unsubscribe: () => void }>;
  eventListeners: Set<{ element: EventTarget; event: string; handler: EventListener }>;
}

/**
 * Hook for managing cleanup of resources to prevent memory leaks
 */
export function useCleanup() {
  const cleanupRef = useRef<CleanupManager>({
    timeouts: new Set(),
    intervals: new Set(),
    abortControllers: new Set(),
    subscriptions: new Set(),
    eventListeners: new Set(),
  });

  // Cleanup all resources
  const cleanup = useCallback(() => {
    const manager = cleanupRef.current;

    // Clear timeouts
    manager.timeouts.forEach(timeout => clearTimeout(timeout));
    manager.timeouts.clear();

    // Clear intervals
    manager.intervals.forEach(interval => clearInterval(interval));
    manager.intervals.clear();

    // Abort pending requests
    manager.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    manager.abortControllers.clear();

    // Unsubscribe from subscriptions
    manager.subscriptions.forEach(subscription => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing:', error);
      }
    });
    manager.subscriptions.clear();

    // Remove event listeners
    manager.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.warn('Error removing event listener:', error);
      }
    });
    manager.eventListeners.clear();
  }, []);

  // Safe setTimeout with automatic cleanup
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      cleanupRef.current.timeouts.delete(timeout);
      callback();
    }, delay);
    
    cleanupRef.current.timeouts.add(timeout);
    return timeout;
  }, []);

  // Safe setInterval with automatic cleanup
  const safeSetInterval = useCallback((callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay);
    cleanupRef.current.intervals.add(interval);
    return interval;
  }, []);

  // Create abort controller for API requests
  const createAbortController = useCallback(() => {
    const controller = new AbortController();
    cleanupRef.current.abortControllers.add(controller);
    
    // Auto-remove when aborted
    controller.signal.addEventListener('abort', () => {
      cleanupRef.current.abortControllers.delete(controller);
    });
    
    return controller;
  }, []);

  // Add subscription for cleanup
  const addSubscription = useCallback((subscription: { unsubscribe: () => void }) => {
    cleanupRef.current.subscriptions.add(subscription);
    return subscription;
  }, []);

  // Add event listener for cleanup
  const addEventListener = useCallback((
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    element.addEventListener(event, handler, options);
    const listenerRecord = { element, event, handler };
    cleanupRef.current.eventListeners.add(listenerRecord);
    
    return () => {
      element.removeEventListener(event, handler);
      cleanupRef.current.eventListeners.delete(listenerRecord);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    cleanup,
    safeSetTimeout,
    safeSetInterval,
    createAbortController,
    addSubscription,
    addEventListener,
  };
}