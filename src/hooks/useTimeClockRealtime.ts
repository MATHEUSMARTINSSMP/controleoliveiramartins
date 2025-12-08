/**
 * Hook para atualizacoes em tempo real do sistema de ponto
 * Utiliza Supabase Realtime para notificar mudancas
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTimeClockRealtimeOptions {
  storeId: string | null;
  colaboradoraId?: string | null;
  onRecordChange?: () => void;
  onBalanceChange?: () => void;
  onRequestChange?: () => void;
  enabled?: boolean;
}

export function useTimeClockRealtime({
  storeId,
  colaboradoraId,
  onRecordChange,
  onBalanceChange,
  onRequestChange,
  enabled = true,
}: UseTimeClockRealtimeOptions) {
  const queryClient = useQueryClient();

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['time-clock-records'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-balance'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-requests'] });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !storeId) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        const channelName = colaboradoraId 
          ? `time-clock-${storeId}-${colaboradoraId}`
          : `time-clock-store-${storeId}`;

        channel = supabase.channel(channelName);

        channel
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'sistemaretiradas',
              table: 'time_clock_records',
              filter: colaboradoraId 
                ? `colaboradora_id=eq.${colaboradoraId}`
                : `store_id=eq.${storeId}`,
            },
            (payload) => {
              console.log('[TimeClockRealtime] Record change:', payload.eventType);
              invalidateQueries();
              onRecordChange?.();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'sistemaretiradas',
              table: 'time_clock_hours_balance',
              filter: colaboradoraId 
                ? `colaboradora_id=eq.${colaboradoraId}`
                : `store_id=eq.${storeId}`,
            },
            (payload) => {
              console.log('[TimeClockRealtime] Balance change:', payload.eventType);
              invalidateQueries();
              onBalanceChange?.();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'sistemaretiradas',
              table: 'time_clock_change_requests',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              console.log('[TimeClockRealtime] Request change:', payload.eventType);
              invalidateQueries();
              onRequestChange?.();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[TimeClockRealtime] Subscribed to channel:', channelName);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[TimeClockRealtime] Channel error');
            }
          });
      } catch (error) {
        console.error('[TimeClockRealtime] Setup error:', error);
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        console.log('[TimeClockRealtime] Unsubscribing from channel');
        supabase.removeChannel(channel);
      }
    };
  }, [storeId, colaboradoraId, enabled, invalidateQueries, onRecordChange, onBalanceChange, onRequestChange]);

  return {
    invalidateQueries,
  };
}
