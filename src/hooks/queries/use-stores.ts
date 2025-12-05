/**
 * Store Queries Hook
 * Enterprise-grade hooks for store data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, type Store } from './types';

export function useStores(options?: { activeOnly?: boolean }) {
  const { activeOnly = true } = options ?? {};

  return useQuery({
    queryKey: [QUERY_KEYS.stores, { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, active, subscription_plan');

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as Store[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useStore(storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.stores, storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error) throw error;
      return data as Store;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useStoreSettings(storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.stores, 'settings', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select(`
          id,
          name,
          tiny_api_token,
          tiny_ultimo_sync,
          subscription_plan,
          active
        `)
        .eq('id', storeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}
