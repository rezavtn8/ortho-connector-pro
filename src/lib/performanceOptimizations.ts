/**
 * Global performance optimizations and monitoring
 */

// Initialize performance monitoring
export const initializePerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;

  // Web Vitals monitoring
  const observePerformance = () => {
    // LCP (Largest Contentful Paint)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('LCP:', entry.startTime);
        }
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FID (First Input Delay)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          const firstInputEntry = entry as any;
          console.log('FID:', firstInputEntry.processingStart - firstInputEntry.startTime);
        }
      }
    }).observe({ entryTypes: ['first-input'] });

    // CLS (Cumulative Layout Shift)
    let clsScore = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsScore += (entry as any).value;
        }
      }
      console.log('CLS:', clsScore);
    }).observe({ entryTypes: ['layout-shift'] });
  };

  // Resource monitoring
  const observeResources = () => {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        // Log slow resources (>1s)
        if (resource.duration > 1000) {
          console.warn(`Slow resource: ${resource.name} (${resource.duration.toFixed(2)}ms)`);
        }
      }
    }).observe({ entryTypes: ['resource'] });
  };

  // Long task monitoring
  const observeLongTasks = () => {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn(`Long task detected: ${entry.duration}ms`);
      }
    }).observe({ entryTypes: ['longtask'] });
  };

  observePerformance();
  observeResources();
  observeLongTasks();
};

// React performance optimizations
export const optimizeReactPerformance = () => {
  // Disable React DevTools in production
  if (process.env.NODE_ENV === 'production') {
    if (typeof window !== 'undefined') {
      const globalHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (globalHook) {
        globalHook.onCommitFiberRoot = undefined;
        globalHook.onCommitFiberUnmount = undefined;
      }
    }
  }
};

// Memory leak prevention
export const preventMemoryLeaks = () => {
  if (typeof window === 'undefined') return;

  // Cleanup observers on page unload
  window.addEventListener('beforeunload', () => {
    // Clear all timeouts and intervals
    let id = window.setTimeout(() => {}, 0);
    while (id--) {
      window.clearTimeout(id);
    }
    
    id = window.setInterval(() => {}, 0);
    while (id--) {
      window.clearInterval(id);
    }
  });

  // Monitor memory usage
  const checkMemoryUsage = () => {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      
      if (usedPercent > 80) {
        console.warn(`High memory usage: ${usedPercent.toFixed(2)}%`);
      }
    }
  };

  // Check memory every 30 seconds
  setInterval(checkMemoryUsage, 30000);
};

// Bundle size optimization
export const trackBundlePerformance = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    console.group('📊 Performance Metrics');
    console.log('Total Load Time:', `${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`);
    console.log('DOM Content Loaded:', `${(navigation.domContentLoadedEventEnd - navigation.fetchStart).toFixed(2)}ms`);
    console.log('First Paint:', `${(navigation.responseEnd - navigation.fetchStart).toFixed(2)}ms`);
    
    if (navigation.transferSize) {
      console.log('Total Transfer Size:', `${(navigation.transferSize / 1024).toFixed(2)}KB`);
    }
    console.groupEnd();
  });
};

// Initialize all optimizations
export const initializeAllOptimizations = () => {
  initializePerformanceMonitoring();
  optimizeReactPerformance();
  preventMemoryLeaks();
  trackBundlePerformance();
};