/**
 * Base Supabase Query Utilities
 * Enterprise-grade query infrastructure with React Query
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SCHEMA = 'sistemaretiradas';

export function getSupabaseClient() {
  return supabase.schema(SCHEMA);
}

export function createQuery(table: string) {
  return supabase.schema(SCHEMA).from(table);
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidate: (keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries();
    },
    prefetch: async <T>(key: string, queryFn: () => Promise<T>) => {
      await queryClient.prefetchQuery({ queryKey: [key], queryFn });
    },
    setQueryData: <T>(key: string[], data: T) => {
      queryClient.setQueryData(key, data);
    },
    getQueryData: <T>(key: string[]): T | undefined => {
      return queryClient.getQueryData<T>(key);
    },
  };
}

export function formatDateRange(start?: string, end?: string, column = 'created_at') {
  const filters: { column: string; operator: string; value: string }[] = [];
  
  if (start) {
    filters.push({ column, operator: 'gte', value: `${start}T00:00:00` });
  }
  if (end) {
    filters.push({ column, operator: 'lte', value: `${end}T23:59:59` });
  }
  
  return filters;
}

export function getTodayRange() {
  const today = new Date().toISOString().split('T')[0];
  return { start: today, end: today };
}

export function getWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0],
  };
}

export function getMonthRange(year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}
