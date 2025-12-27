/**
 * Componente principal de Tarefas do Dia para Loja Dashboard
 * Mostra tarefas agrupadas por turno com visual moderno
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskStatistics } from "@/hooks/useTaskStatistics";
import { TaskSection } from "./lista-da-vez/TaskSection";
import { TaskStatistics } from "./lista-da-vez/TaskStatistics";
import { TaskHistory } from "./lista-da-vez/TaskHistory";
import { TaskCompletionDialog } from "./lista-da-vez/TaskCompletionDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckSquare2, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { DailyTask } from "@/hooks/useDailyTasks";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LojaTasksTabProps {
    storeId: string | null;
}

export function LojaTasksTab({ storeId }: LojaTasksTabProps) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
    const [selectedTaskForCompletion, setSelectedTaskForCompletion] = useState<DailyTask | null>(null);
    const [completedByNames, setCompletedByNames] = useState<Map<string, string>>(new Map());
    
    const { tasks, loading, completeTask, uncompleteTask } = useDailyTasks({
        storeId,
        date: selectedDate,
        enabled: !!storeId
    });

    // Buscar nomes das pessoas que completaram as tarefas
    useEffect(() => {
        const fetchCompletedByNames = async () => {
            const completedByIds = tasks
                .filter(t => t.completed_by)
                .map(t => t.completed_by)
                .filter(Boolean) as string[];

            if (completedByIds.length === 0) {
                setCompletedByNames(new Map());
                return;
            }

            const uniqueIds = [...new Set(completedByIds)];
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .in('id', uniqueIds);

            if (error) {
                console.error('[LojaTasksTab] Erro ao buscar nomes:', error);
                return;
            }

            const namesMap = new Map<string, string>();
            data?.forEach(profile => {
                if (profile.id && profile.name) {
                    namesMap.set(profile.id, profile.name);
                }
            });
            setCompletedByNames(namesMap);
        };

        if (tasks.length > 0) {
            fetchCompletedByNames();
        }
    }, [tasks]);

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

    const handleCompleteClick = (task: DailyTask) => {
        setSelectedTaskForCompletion(task);
        setCompletionDialogOpen(true);
    };

    const handleConfirmCompletion = async (notes?: string) => {
        if (!selectedTaskForCompletion) return;
        await completeTask(selectedTaskForCompletion.id, notes);
        setCompletionDialogOpen(false);
        setSelectedTaskForCompletion(null);
    };

    // Verificar tarefas próximas do horário limite e notificar
    useEffect(() => {
        if (!storeId || tasks.length === 0) return;

        const checkDeadlines = () => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            tasks.forEach(task => {
                if (task.completed_by || !task.due_time) return;
                
                const [dueHours, dueMinutes] = task.due_time.split(':').map(Number);
                const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
                
                const dueDate = new Date(2000, 0, 1, dueHours, dueMinutes);
                const currentDate = new Date(2000, 0, 1, currentHours, currentMinutes);
                
                const diffMinutes = (dueDate.getTime() - currentDate.getTime()) / (1000 * 60);
                
                // Notificar se está entre 10 e 15 minutos antes do prazo
                if (diffMinutes >= 10 && diffMinutes <= 15) {
                    toast.warning(`⏰ Tarefa próxima do prazo: ${task.title}`, {
                        description: `Prazo: ${task.due_time}`,
                        duration: 5000,
                    });
                }
            });
        };

        // Verificar a cada minuto
        const interval = setInterval(checkDeadlines, 60000);
        checkDeadlines(); // Verificar imediatamente

        return () => clearInterval(interval);
    }, [tasks, storeId]);

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
                    <CheckSquare2 className="h-12 w-12 text-muted-foreground mb-4" />
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

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate.getTime())) {
            setSelectedDate(newDate);
        }
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    const goToPreviousDay = () => {
        setSelectedDate(prev => subDays(prev, 1));
    };

    const goToNextDay = () => {
        setSelectedDate(prev => addDays(prev, 1));
    };

    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="space-y-6">
            {/* Navegação e Filtro de Data */}
            <Card className="border-2 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Tarefas do Dia
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Navegação entre dias */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousDay}
                            className="flex items-center gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Dia Anterior
                        </Button>
                        
                        <div className="flex-1 text-center">
                            <h3 className="text-lg font-semibold">
                                {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </h3>
                        </div>
                        
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextDay}
                            className="flex items-center gap-2"
                        >
                            Próximo Dia
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Seletor de data alternativa */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <Label htmlFor="task-date">Ou selecione uma data</Label>
                            <Input
                                id="task-date"
                                type="date"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={handleDateChange}
                                className="mt-1"
                            />
                        </div>
                        {!isToday && (
                            <Button
                                variant="outline"
                                onClick={goToToday}
                                className="mb-0"
                            >
                                Hoje
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

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
                        onCompleteClick={handleCompleteClick}
                        loading={loading}
                    />
                ))}
            </div>

            {/* Estatísticas */}
            <TaskStatistics 
                statistics={statistics} 
                loading={statsLoading}
                storeId={storeId}
                date={selectedDate}
            />

            {/* Histórico de Tarefas Completas */}
            <TaskHistory 
                storeId={storeId} 
                date={selectedDate}
                enabled={!!storeId}
            />
        </div>
    );
}

