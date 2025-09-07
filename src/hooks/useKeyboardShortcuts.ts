import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === event.ctrlKey;
      const altMatch = !!shortcut.alt === event.altKey;
      const shiftMatch = !!shortcut.shift === event.shiftKey;
      const metaMatch = !!shortcut.meta === event.metaKey;
      
      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
    });

    if (matchingShortcut) {
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();
      
      // Execute the action
      matchingShortcut.action();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
}

// Global keyboard shortcuts
export function useGlobalShortcuts(navigate: (path: string) => void) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '1',
      alt: true,
      action: () => navigate('/'),
      description: 'Go to Dashboard'
    },
    {
      key: '2',
      alt: true,
      action: () => navigate('/offices'),
      description: 'Go to Offices'
    },
    {
      key: '3',
      alt: true,
      action: () => navigate('/sources'),
      description: 'Go to Sources'
    },
    {
      key: '4',
      alt: true,
      action: () => navigate('/analytics'),
      description: 'Go to Analytics'
    },
    {
      key: '/',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: 'Focus search'
    },
    {
      key: '?',
      shift: true,
      action: () => {
        // Show keyboard shortcuts help
        const helpDialog = document.getElementById('keyboard-shortcuts-help');
        if (helpDialog) {
          (helpDialog as any).showModal?.();
        }
      },
      description: 'Show keyboard shortcuts help'
    }
  ];

  return useKeyboardShortcuts(shortcuts);
}