/**
 * Virtualized list hook for large datasets
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';

interface VirtualizedOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualized<T>(items: T[], options: VirtualizedOptions) {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItemsArray = [];
    for (let i = startIndex; i < endIndex; i++) {
      visibleItemsArray.push({
        index: i,
        item: items[i],
        offsetTop: i * itemHeight,
      });
    }

    return {
      items: visibleItemsArray,
      startIndex,
      endIndex,
      totalHeight: items.length * itemHeight,
    };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // Intersection observer for better performance
  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Additional optimization logic can go here
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    visibleItems,
    totalHeight: visibleItems.totalHeight,
    handleScroll,
    scrollElementRef,
  };
}