/**
 * Performance monitoring component for debugging and optimization
 */
import { useEffect, useRef } from 'react';

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  type: string;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private entries: PerformanceEntry[] = [];
  private timers: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.entries.push({
      name,
      startTime,
      duration,
      type: 'custom'
    });

    this.timers.delete(name);

    // Log slow operations
    if (duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  clearEntries(): void {
    this.entries = [];
  }

  logPerformanceSummary(): void {
    const slowOperations = this.entries.filter(entry => entry.duration > 100);
    if (slowOperations.length > 0) {
      console.group('🐌 Slow Operations (>100ms)');
      slowOperations.forEach(entry => {
        console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }

    // Web Vitals monitoring
    if ('web-vitals' in window) {
      const vitals = (window as any)['web-vitals'];
      console.group('📊 Web Vitals');
      console.log('FCP:', vitals?.fcp || 'Not measured');
      console.log('LCP:', vitals?.lcp || 'Not measured');
      console.log('FID:', vitals?.fid || 'Not measured');
      console.log('CLS:', vitals?.cls || 'Not measured');
      console.groupEnd();
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

interface ComponentPerformanceProps {
  name: string;
  children: React.ReactNode;
  threshold?: number; // ms
}

export function ComponentPerformance({ name, children, threshold = 50 }: ComponentPerformanceProps) {
  const renderCount = useRef(0);
  const startTime = useRef<number>();

  useEffect(() => {
    startTime.current = performance.now();
    renderCount.current++;
  });

  useEffect(() => {
    if (startTime.current) {
      const duration = performance.now() - startTime.current;
      if (duration > threshold) {
        console.warn(`${name} render took ${duration.toFixed(2)}ms (render #${renderCount.current})`);
      }
    }
  });

  return <>{children}</>;
}

// React DevTools Profiler integration
export function usePerformanceProfiler(name: string) {
  useEffect(() => {
    performanceMonitor.startTimer(`${name}-mount`);
    return () => {
      performanceMonitor.endTimer(`${name}-mount`);
    };
  }, [name]);

  const onRender = (id: string, phase: 'mount' | 'update', actualDuration: number) => {
    if (actualDuration > 16) { // One frame at 60fps
      console.log(`${id} ${phase}: ${actualDuration.toFixed(2)}ms`);
    }
  };

  return { onRender };
}