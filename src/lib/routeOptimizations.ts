/**
 * Route-level optimizations and code splitting
 */
import { lazy, ComponentType } from 'react';

// Route-level code splitting with proper error boundaries
export const createLazyRoute = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) => {
  return lazy(importFunc);
};

// Preload routes on hover/focus for better UX
export const preloadRoute = (routeImport: () => Promise<any>) => {
  // Preload on mouseover/focus with debouncing
  let preloadTimeout: NodeJS.Timeout;
  
  return {
    onMouseEnter: () => {
      preloadTimeout = setTimeout(() => {
        routeImport().catch(console.error);
      }, 100);
    },
    onMouseLeave: () => {
      clearTimeout(preloadTimeout);
    },
    onFocus: () => {
      routeImport().catch(console.error);
    }
  };
};

// Resource hints for critical routes
export const addResourceHints = () => {
  const addLink = (rel: string, href: string, as?: string) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (as) link.as = as;
    document.head.appendChild(link);
  };

  // Preconnect to critical domains
  addLink('preconnect', 'https://fonts.googleapis.com');
  addLink('preconnect', 'https://fonts.gstatic.com');
  
  // DNS prefetch for external APIs
  addLink('dns-prefetch', 'https://api.openai.com');
  addLink('dns-prefetch', 'https://maps.googleapis.com');
};

// Bundle optimization tracking
export const trackBundleSize = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const totalSize = navigation.transferSize || 0;
      
      console.log('📦 Bundle Performance:', {
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
        loadTime: `${navigation.loadEventEnd - navigation.fetchStart}ms`,
        domContentLoaded: `${navigation.domContentLoadedEventEnd - navigation.fetchStart}ms`
      });

      // Track large bundles
      if (totalSize > 1024 * 1024) { // > 1MB
        console.warn('⚠️ Large bundle detected:', `${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      }
    });
  }
};

// Service Worker for aggressive caching
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', registration);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  }
};