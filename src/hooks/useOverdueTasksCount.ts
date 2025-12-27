import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOverdueTasksCount(storeId: string | null) {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        if (!storeId) {
            setCount(0);
            return;
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const { data: tasks, error } = await supabase
                .schema('sistemaretiradas')
                .from('daily_tasks')
                .select('id')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .not('due_time', 'is', null)
                .lt('due_time', currentTime);

            if (error) throw error;

            let overdueCount = 0;

            for (const task of tasks || []) {
                const { data: execution } = await supabase
                    .schema('sistemaretiradas')
                    .from('daily_task_executions')
                    .select('id')
                    .eq('task_id', task.id)
                    .eq('execution_date', today)
                    .not('completed_at', 'is', null)
                    .limit(1);

                if (!execution || execution.length === 0) {
                    overdueCount++;
                }
            }

            setCount(overdueCount);
        } catch (error) {
            console.error('[useOverdueTasksCount] Erro:', error);
        }
    }, [storeId]);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 60000);
        return () => clearInterval(interval);
    }, [fetchCount]);

    useEffect(() => {
        if (!storeId) return;

        const channel = supabase
            .channel(`overdue_count:${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'daily_task_executions'
                },
                () => fetchCount()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId, fetchCount]);

    return count;
}
