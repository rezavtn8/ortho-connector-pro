import { useEffect, useRef, useCallback } from 'react';

export interface UseAccessibilityOptions {
  trapFocus?: boolean;
  announceChanges?: boolean;
  restoreFocus?: boolean;
  escapeCloses?: boolean;
}

export function useAccessibility(options: UseAccessibilityOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Announce messages to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    
    document.body.appendChild(announcer);
    
    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(announcer)) {
        document.body.removeChild(announcer);
      }
    }, 1000);
  }, []);

  // Trap focus within container
  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current || event.key !== 'Tab') return;

    const focusableElements = containerRef.current.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        event.preventDefault();
      }
    }
  }, []);

  // Handle escape key
  const handleEscape = useCallback((event: KeyboardEvent, onClose?: () => void) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }, []);

  // Set up focus management
  useEffect(() => {
    if (options.trapFocus && containerRef.current) {
      // Store previous focus
      if (options.restoreFocus) {
        previousFocusRef.current = document.activeElement;
      }

      // Focus first focusable element
      const firstFocusable = containerRef.current.querySelector(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      if (firstFocusable) {
        firstFocusable.focus();
      }

      // Add event listener for tab trapping
      document.addEventListener('keydown', trapFocus);

      return () => {
        document.removeEventListener('keydown', trapFocus);
        
        // Restore previous focus
        if (options.restoreFocus && previousFocusRef.current) {
          (previousFocusRef.current as HTMLElement).focus();
        }
      };
    }
  }, [options.trapFocus, options.restoreFocus, trapFocus]);

  return {
    containerRef,
    announce,
    handleEscape,
    trapFocus,
  };
}

// Generate unique IDs for form associations
export function useId(prefix: string = 'element'): string {
  const ref = useRef<string>();
  
  if (!ref.current) {
    ref.current = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  return ref.current;
}

// Skip to main content functionality
export function addSkipToMain() {
  useEffect(() => {
    // Add skip link if it doesn't exist
    if (!document.getElementById('skip-to-main')) {
      const skipLink = document.createElement('a');
      skipLink.id = 'skip-to-main';
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md';
      
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
  }, []);
}