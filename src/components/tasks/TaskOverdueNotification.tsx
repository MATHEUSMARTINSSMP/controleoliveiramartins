/**
 * Componente para exibir notificações de tarefas atrasadas
 * Integra com Realtime para atualizações em tempo real
 * Nota: O envio de WhatsApp automático deve ser feito via backend (Supabase Edge Function)
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, X, CheckCircle2, Clock, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OverdueTask {
    id: string;
    title: string;
    description?: string | null;
    due_time: string;
    priority?: string | null;
}

interface TaskOverdueNotificationProps {
    storeId: string | null;
    onMarkAsRead?: (taskId: string) => void;
    onDismiss?: (taskId: string) => void;
}

export function TaskOverdueNotification({
    storeId,
    onMarkAsRead,
    onDismiss
}: TaskOverdueNotificationProps) {
    const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());

    const fetchOverdueTasks = useCallback(async () => {
        if (!storeId) {
            setOverdueTasks([]);
            return;
        }

        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const { data: tasks, error } = await supabase
                .schema('sistemaretiradas')
                .from('daily_tasks')
                .select('id, title, description, due_time, priority')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .not('due_time', 'is', null)
                .lt('due_time', currentTime);

            if (error) throw error;

            const pendingOverdue: OverdueTask[] = [];

            for (const task of tasks || []) {
                const { data: execution } = await supabase
                    .schema('sistemaretiradas')
                    .from('task_executions')
                    .select('id')
                    .eq('task_id', task.id)
                    .eq('execution_date', today)
                    .not('completed_at', 'is', null)
                    .limit(1);

                if (!execution || execution.length === 0) {
                    if (!dismissedTasks.has(task.id)) {
                        pendingOverdue.push({
                            id: task.id,
                            title: task.title,
                            description: task.description,
                            due_time: task.due_time!,
                            priority: task.priority
                        });
                    }
                }
            }

            setOverdueTasks(pendingOverdue);
        } catch (error) {
            console.error('[TaskOverdueNotification] Erro ao buscar tarefas atrasadas:', error);
        } finally {
            setLoading(false);
        }
    }, [storeId, dismissedTasks]);

    useEffect(() => {
        fetchOverdueTasks();

        const interval = setInterval(fetchOverdueTasks, 60000);

        return () => clearInterval(interval);
    }, [fetchOverdueTasks]);

    useEffect(() => {
        if (!storeId) return;

        const channel = supabase
            .channel(`task_executions:store:${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'task_executions'
                },
                () => {
                    console.log('[TaskOverdueNotification] Execução de tarefa atualizada, recarregando...');
                    fetchOverdueTasks();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [storeId, fetchOverdueTasks]);

    const handleDismiss = (taskId: string) => {
        setDismissedTasks(prev => new Set([...prev, taskId]));
        setOverdueTasks(prev => prev.filter(t => t.id !== taskId));
        onDismiss?.(taskId);
    };

    const handleMarkAsRead = (taskId: string) => {
        handleDismiss(taskId);
        onMarkAsRead?.(taskId);
    };

    if (loading && overdueTasks.length === 0) {
        return null;
    }

    if (overdueTasks.length === 0) {
        return null;
    }

    const getPriorityColor = (priority: string | null | undefined) => {
        switch (priority) {
            case 'ALTA':
                return 'border-red-500/50 bg-red-500/10';
            case 'MÉDIA':
                return 'border-amber-500/50 bg-amber-500/10';
            case 'BAIXA':
                return 'border-emerald-500/50 bg-emerald-500/10';
            default:
                return 'border-orange-500/50 bg-orange-500/10';
        }
    };

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-full bg-orange-500/20">
                    <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {overdueTasks.length} tarefa{overdueTasks.length > 1 ? 's' : ''} atrasada{overdueTasks.length > 1 ? 's' : ''}
                </span>
            </div>

            {overdueTasks.map((task) => (
                <div
                    key={task.id}
                    className={cn(
                        "p-3 rounded-lg border-2 transition-all duration-200",
                        getPriorityColor(task.priority)
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-orange-900 dark:text-orange-100 truncate">
                                    {task.title}
                                </p>
                                {task.description && (
                                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5 line-clamp-1">
                                        {task.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-orange-500/30">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Prazo: {task.due_time}
                                    </Badge>
                                    {task.priority && (
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "text-xs px-1.5 py-0 h-5",
                                                task.priority === 'ALTA' && "border-red-500/50 text-red-700 dark:text-red-400",
                                                task.priority === 'MÉDIA' && "border-amber-500/50 text-amber-700 dark:text-amber-400",
                                                task.priority === 'BAIXA' && "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                                            )}
                                        >
                                            {task.priority}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-orange-700 hover:text-orange-900 hover:bg-orange-200/50 dark:text-orange-300 dark:hover:text-orange-100 dark:hover:bg-orange-800/50"
                                onClick={() => handleMarkAsRead(task.id)}
                                title="Marcar como vista"
                                data-testid={`button-mark-read-${task.id}`}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-orange-700 hover:text-orange-900 hover:bg-orange-200/50 dark:text-orange-300 dark:hover:text-orange-100 dark:hover:bg-orange-800/50"
                                onClick={() => handleDismiss(task.id)}
                                title="Dispensar"
                                data-testid={`button-dismiss-${task.id}`}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
