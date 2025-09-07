import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaginationState {
  data: any[];
  loading: boolean;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
  error: string | null;
}

export interface PaginationHookOptions {
  tableName: string;
  pageSize?: number;
  selectFields?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, any>;
}

export function usePagination({
  tableName,
  pageSize = 20,
  selectFields = '*',
  orderBy,
  filters = {}
}: PaginationHookOptions) {
  const [state, setState] = useState<PaginationState>({
    data: [],
    loading: false,
    hasMore: true,
    currentPage: 0,
    totalCount: 0,
    error: null
  });

  const loadPage = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (state.loading) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let query = supabase
        .from(tableName as any)
        .select(selectFields, { count: 'exact' })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setState(prev => ({
        ...prev,
        data: reset ? (data || []) : [...prev.data, ...(data || [])],
        loading: false,
        hasMore: (data?.length || 0) === pageSize,
        currentPage: page,
        totalCount: count || 0,
        error: null
      }));

      return data;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        hasMore: false
      }));
      return null;
    }
  }, [tableName, pageSize, selectFields, orderBy, JSON.stringify(filters), state.loading]);

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loading) {
      loadPage(state.currentPage + 1, false);
    }
  }, [loadPage, state.hasMore, state.loading, state.currentPage]);

  const reset = useCallback(() => {
    setState({
      data: [],
      loading: false,
      hasMore: true,
      currentPage: 0,
      totalCount: 0,
      error: null
    });
    loadPage(0, true);
  }, [loadPage]);

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, data: [], currentPage: 0, hasMore: true }));
    loadPage(0, true);
  }, [loadPage]);

  return {
    ...state,
    loadPage,
    loadMore,
    reset,
    refresh
  };
}