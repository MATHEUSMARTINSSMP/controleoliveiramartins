/**
 * Componente principal de Tarefas do Dia para Loja Dashboard
 * Mostra tarefas agrupadas por turno com visual moderno
 */

import { useState } from "react";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskStatistics } from "@/hooks/useTaskStatistics";
import { TaskSection } from "./lista-da-vez/TaskSection";
import { TaskStatistics } from "./lista-da-vez/TaskStatistics";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckSquare } from "lucide-react";
import { DailyTask } from "@/hooks/useDailyTasks";

interface LojaTasksTabProps {
    storeId: string | null;
}

export function LojaTasksTab({ storeId }: LojaTasksTabProps) {
    const [selectedDate] = useState(new Date());
    
    const { tasks, loading, completeTask, uncompleteTask } = useDailyTasks({
        storeId,
        date: selectedDate,
        enabled: !!storeId
    });

    const { statistics, loading: statsLoading } = useTaskStatistics({
        storeId,
        date: selectedDate,
        enabled: !!storeId
    });

    const handleToggleComplete = async (taskId: string, completed: boolean) => {
        if (completed) {
            await completeTask(taskId);
        } else {
            await uncompleteTask(taskId);
        }
    };

    // Agrupar tarefas por turno
    const tasksByShift = tasks.reduce((acc, task) => {
        const shiftKey = task.shift_id || 'sem-turno';
        const shiftName = task.shift_name || 'Sem Turno';
        
        if (!acc[shiftKey]) {
            acc[shiftKey] = {
                shiftId: task.shift_id,
                shiftName,
                shiftStartTime: task.shift_start_time,
                shiftEndTime: task.shift_end_time,
                shiftColor: task.shift_color,
                tasks: []
            };
        }
        
        acc[shiftKey].tasks.push(task);
        return acc;
    }, {} as Record<string, {
        shiftId: string | null;
        shiftName: string;
        shiftStartTime: string | null;
        shiftEndTime: string | null;
        shiftColor: string | null;
        tasks: DailyTask[];
    }>);

    // Ordenar turnos por display_order (já vem ordenado do banco, mas garantir)
    const sortedShifts = Object.values(tasksByShift).sort((a, b) => {
        // Ordenar por horário de início se disponível
        if (a.shiftStartTime && b.shiftStartTime) {
            return a.shiftStartTime.localeCompare(b.shiftStartTime);
        }
        return 0;
    });

    if (loading && tasks.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <Card className="border-2 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-muted-foreground mb-2">
                        Nenhuma tarefa configurada
                    </p>
                    <p className="text-sm text-muted-foreground text-center">
                        O administrador ainda não configurou tarefas para hoje.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tarefas agrupadas por turno */}
            <div className="space-y-4">
                {sortedShifts.map((shift) => (
                    <TaskSection
                        key={shift.shiftId || 'sem-turno'}
                        shiftName={shift.shiftName}
                        shiftStartTime={shift.shiftStartTime}
                        shiftEndTime={shift.shiftEndTime}
                        shiftColor={shift.shiftColor}
                        tasks={shift.tasks}
                        onToggleComplete={handleToggleComplete}
                        loading={loading}
                    />
                ))}
            </div>

            {/* Estatísticas no final */}
            <TaskStatistics statistics={statistics} loading={statsLoading} />
        </div>
    );
}

