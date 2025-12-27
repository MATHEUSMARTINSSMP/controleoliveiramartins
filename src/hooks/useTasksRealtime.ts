/**
 * Hook para atualizações em tempo real do sistema de tarefas
 * Utiliza Supabase Realtime para notificar mudanças
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTasksRealtimeOptions {
  storeId: string | null;
  date?: Date;
  onTaskCompleted?: (taskId: string, completed: boolean, profileId?: string, completedAt?: string) => void;
  onTaskOverdue?: (notification: any) => void;
  onTaskUpdated?: (task: any) => void;
  enabled?: boolean;
}

interface UseTasksRealtimeReturn {
  channel: RealtimeChannel | null;
}

export function useTasksRealtime({
  storeId,
  date = new Date(),
  onTaskCompleted,
  onTaskOverdue,
  onTaskUpdated,
  enabled = true,
}: UseTasksRealtimeOptions): UseTasksRealtimeReturn {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId || !enabled) {
      // Limpar canal se desabilitado
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const dateStr = date.toISOString().split('T')[0];
    const channelName = `tasks:store:${storeId}:date:${dateStr}`;

    console.log('[useTasksRealtime] Configurando subscriptions para:', channelName);

    // Canal para daily_task_executions (mudanças de conclusão)
    const completionsChannel = supabase
      .channel(`${channelName}:executions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sistemaretiradas',
          table: 'daily_task_executions',
          filter: `execution_date=eq.${dateStr}`,
        },
        (payload) => {
          console.log('[useTasksRealtime] Mudança em daily_task_executions:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const isCompleted = payload.new.is_completed === true;
            onTaskCompleted?.(
              payload.new.task_id,
              isCompleted,
              payload.new.completed_by,
              payload.new.completed_at
            );
          } else if (payload.eventType === 'DELETE') {
            onTaskCompleted?.(
              payload.old.task_id,
              false
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useTasksRealtime] Subscribed to daily_task_executions');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useTasksRealtime] Channel error on daily_task_executions');
        }
      });

    // Canal para task_overdue_notifications (novas notificações)
    const notificationsChannel = supabase
      .channel(`${channelName}:notifications`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'sistemaretiradas',
          table: 'task_overdue_notifications',
          filter: `store_id=eq.${storeId},status=eq.PENDING`,
        },
        (payload) => {
          console.log('[useTasksRealtime] Nova notificação de tarefa atrasada:', payload);
          onTaskOverdue?.(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useTasksRealtime] Subscribed to task_overdue_notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useTasksRealtime] Channel error on task_overdue_notifications');
        }
      });

    // Canal para daily_tasks (atualizações nas tarefas - título, horário, etc)
    const tasksChannel = supabase
      .channel(`${channelName}:tasks`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sistemaretiradas',
          table: 'daily_tasks',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('[useTasksRealtime] Mudança em daily_tasks:', payload.eventType, payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            onTaskUpdated?.(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useTasksRealtime] Subscribed to daily_tasks');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useTasksRealtime] Channel error on daily_tasks');
        }
      });

    channelRef.current = completionsChannel;

    return () => {
      console.log('[useTasksRealtime] Limpando subscriptions');
      supabase.removeChannel(completionsChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(tasksChannel);
      channelRef.current = null;
    };
  }, [storeId, date, enabled, onTaskCompleted, onTaskOverdue, onTaskUpdated]);

  return { channel: channelRef.current };
}

