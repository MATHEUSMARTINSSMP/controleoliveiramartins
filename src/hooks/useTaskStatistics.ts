/**
 * Hook para estatísticas de tarefas
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskStatistics {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    completion_rate: number;
    top_performers: Array<{
        profile_id: string;
        profile_name: string;
        tasks_completed: number;
    }>;
}

interface UseTaskStatisticsOptions {
    storeId: string | null;
    date?: Date;
    enabled?: boolean;
}

interface UseTaskStatisticsReturn {
    statistics: TaskStatistics | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useTaskStatistics({
    storeId,
    date = new Date(),
    enabled = true
}: UseTaskStatisticsOptions): UseTaskStatisticsReturn {
    const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = useCallback(async () => {
        if (!storeId || !enabled) {
            setStatistics(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const dateStr = date.toISOString().split('T')[0];

            const { data, error: fetchError } = await supabase.rpc('get_task_statistics', {
                p_store_id: storeId,
                p_date: dateStr
            });

            if (fetchError) throw fetchError;

            setStatistics(data as TaskStatistics);
        } catch (err: any) {
            console.error('[useTaskStatistics] Erro ao buscar estatísticas:', err);
            setError(err.message || 'Erro ao buscar estatísticas');
        } finally {
            setLoading(false);
        }
    }, [storeId, date, enabled]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    // ✅ ATUALIZAÇÃO EM TEMPO REAL
    useEffect(() => {
        if (!storeId || !enabled) return;

        const channel = supabase
            .channel(`task-statistics-${storeId}-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'task_completions',
                },
                (payload) => {
                    console.log('[useTaskStatistics] 📥 Mudança detectada, atualizando estatísticas');
                    fetchStatistics();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[useTaskStatistics] ✅ Conectado ao realtime');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId, enabled, fetchStatistics]);

    return {
        statistics,
        loading,
        error,
        refresh: fetchStatistics
    };
}

