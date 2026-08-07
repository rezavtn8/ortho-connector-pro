import { useEffect, useState } from 'react';

/**
 * Whether the `dark` class is currently on `<html>`.
 *
 * Tailwind is configured with `darkMode: ["class"]` but no theme provider is mounted
 * today, so this reports `light` in practice. Watching the class directly (rather
 * than depending on a provider that doesn't exist) means the map picks up dark mode
 * automatically if a toggle is added later, with no change here.
 */
export function useMapTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light',
  );

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    read();

    return () => observer.disconnect();
  }, []);

  return theme;
}
