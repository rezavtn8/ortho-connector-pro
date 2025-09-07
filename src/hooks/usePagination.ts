import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaginationOptions {
  pageSize?: number;
  initialPage?: number;
}

interface PaginationState<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
  error: string | null;
}

interface PaginationActions {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export function usePagination<T>(
  queryFn: (startIndex: number, endIndex: number) => Promise<{ data: T[] | null; error: any; count?: number | null }>,
  options: PaginationOptions = {}
): PaginationState<T> & PaginationActions {
  const { pageSize = 20, initialPage = 0 } = options;
  
  const [state, setState] = useState<PaginationState<T>>({
    data: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    currentPage: initialPage,
    totalCount: 0,
    error: null,
  });

  const loadData = useCallback(async (page: number, append: boolean = false) => {
    try {
      setState(prev => ({
        ...prev,
        loading: !append,
        loadingMore: append,
        error: null,
      }));

      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize - 1;

      const result = await queryFn(startIndex, endIndex);

      if (result.error) throw result.error;

      const data = result.data || [];
      const totalCount = result.count || 0;
      const hasMore = endIndex < totalCount - 1;

      setState(prev => ({
        ...prev,
        data: append ? [...prev.data, ...data] : data,
        loading: false,
        loadingMore: false,
        hasMore,
        currentPage: page,
        totalCount,
        error: null,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: error.message || 'An error occurred',
      }));
    }
  }, [pageSize, queryFn]);

  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    await loadData(state.currentPage + 1, true);
  }, [state.loadingMore, state.hasMore, state.currentPage, loadData]);

  const refresh = useCallback(async () => {
    await loadData(0, false);
  }, [loadData]);

  const reset = useCallback(() => {
    setState({
      data: [],
      loading: true,
      loadingMore: false,
      hasMore: true,
      currentPage: initialPage,
      totalCount: 0,
      error: null,
    });
  }, [initialPage]);

  // Load initial data
  useEffect(() => {
    loadData(initialPage, false);
  }, [loadData, initialPage]);

  return {
    ...state,
    loadMore,
    refresh,
    reset,
  };
}

// Helper hook for infinite scroll
export function useInfiniteScroll(callback: () => void, hasMore: boolean, loading: boolean) {
  useEffect(() => {
    if (!hasMore || loading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const threshold = 100; // px from bottom
      
      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        callback();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [callback, hasMore, loading]);
}