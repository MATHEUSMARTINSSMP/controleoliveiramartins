/**
 * Hook para gerenciar tarefas do dia
 * Busca tarefas com realtime e permite marcar como completas
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTasksRealtime } from './useTasksRealtime';

export interface DailyTask {
    id: string;
    store_id: string;
    title: string;
    description: string | null;
    shift_id: string | null;
    shift_name: string | null;
    shift_start_time: string | null;
    shift_end_time: string | null;
    shift_color: string | null;
    due_time: string | null;
    is_active: boolean;
    is_recurring: boolean;
    display_order: number;
    created_at: string;
    completed_by: string | null;
    completed_at: string | null;
    completion_notes: string | null;
}

interface UseDailyTasksOptions {
    storeId: string | null;
    date?: Date;
    enabled?: boolean;
}

interface UseDailyTasksReturn {
    tasks: DailyTask[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    completeTask: (taskId: string, notes?: string) => Promise<boolean>;
    uncompleteTask: (taskId: string) => Promise<boolean>;
}

export function useDailyTasks({
    storeId,
    date = new Date(),
    enabled = true
}: UseDailyTasksOptions): UseDailyTasksReturn {
    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        if (!storeId || !enabled) {
            setTasks([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const dateStr = date.toISOString().split('T')[0];

            const { data, error: fetchError } = await supabase.rpc('get_daily_tasks', {
                p_store_id: storeId,
                p_date: dateStr
            });

            if (fetchError) throw fetchError;

            setTasks((data as DailyTask[]) || []);
        } catch (err: any) {
            console.error('[useDailyTasks] Erro ao buscar tarefas:', err);
            setError(err.message || 'Erro ao buscar tarefas');
            toast.error('Erro ao carregar tarefas');
        } finally {
            setLoading(false);
        }
    }, [storeId, date, enabled]);

    const completeTask = useCallback(async (taskId: string, notes?: string): Promise<boolean> => {
        if (!storeId) return false;

        try {
            const { data, error: completeError } = await supabase.rpc('complete_task', {
                p_task_id: taskId,
                p_profile_id: (await supabase.auth.getUser()).data.user?.id,
                p_notes: notes || null,
                p_completion_date: date.toISOString().split('T')[0]
            });

            if (completeError) throw completeError;

            // Atualizar lista localmente
            const user = (await supabase.auth.getUser()).data.user;
            setTasks(prev => prev.map(task => 
                task.id === taskId 
                    ? { ...task, completed_by: user?.id || null, completed_at: new Date().toISOString(), completion_notes: notes || null }
                    : task
            ));

            toast.success('Tarefa marcada como completa!');
            return true;
        } catch (err: any) {
            console.error('[useDailyTasks] Erro ao completar tarefa:', err);
            toast.error('Erro ao marcar tarefa: ' + (err.message || 'Erro desconhecido'));
            return false;
        }
    }, [storeId, date]);

    const uncompleteTask = useCallback(async (taskId: string): Promise<boolean> => {
        if (!storeId) return false;

        try {
            const { error: uncompleteError } = await supabase.rpc('uncomplete_task', {
                p_task_id: taskId,
                p_profile_id: (await supabase.auth.getUser()).data.user?.id,
                p_completion_date: date.toISOString().split('T')[0]
            });

            if (uncompleteError) throw uncompleteError;

            // Atualizar lista localmente
            setTasks(prev => prev.map(task => 
                task.id === taskId 
                    ? { ...task, completed_by: null, completed_at: null, completion_notes: null }
                    : task
            ));

            toast.success('Tarefa desmarcada!');
            return true;
        } catch (err: any) {
            console.error('[useDailyTasks] Erro ao desmarcar tarefa:', err);
            toast.error('Erro ao desmarcar tarefa: ' + (err.message || 'Erro desconhecido'));
            return false;
        }
    }, [storeId, date]);

    // Buscar tarefas inicialmente
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // ✅ ATUALIZAÇÃO EM TEMPO REAL
    useEffect(() => {
        if (!storeId || !enabled) return;

        const channel = supabase
            .channel(`daily-tasks-${storeId}-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'task_completions',
                },
                (payload) => {
                    console.log('[useDailyTasks] 📥 Mudança em execuções detectada:', payload.eventType);
                    // Recarregar tarefas quando houver mudança
                    fetchTasks();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'daily_tasks',
                    filter: `store_id=eq.${storeId}`,
                },
                (payload) => {
                    console.log('[useDailyTasks] 📥 Mudança em tarefas detectada:', payload.eventType);
                    // Recarregar tarefas quando houver mudança
                    fetchTasks();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[useDailyTasks] ✅ Conectado ao realtime');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId, enabled, fetchTasks]);

    return {
        tasks,
        loading,
        error,
        refresh: fetchTasks,
        completeTask,
        uncompleteTask
    };
}

