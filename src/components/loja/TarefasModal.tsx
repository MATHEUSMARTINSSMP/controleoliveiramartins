/**
 * Modal de Tarefas do Dia - Abre como popup sobre o dashboard
 * Similar ao ListaDaVez, clicando na aba abre esse modal
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Loader2, CheckSquare2, Calendar, ChevronLeft, ChevronRight,
    Clock, AlertTriangle, Flag, Zap, User, CheckCircle2,
    CircleDashed, Timer
} from "lucide-react";
import { useDailyTasks, DailyTask } from "@/hooks/useDailyTasks";
import { useTaskStatistics } from "@/hooks/useTaskStatistics";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TarefasModalProps {
    storeId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PRIORITIES = [
    { value: 'ALTA', label: 'Alta', color: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30', icon: AlertTriangle },
    { value: 'MÉDIA', label: 'Média', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: Flag },
    { value: 'BAIXA', label: 'Baixa', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: Zap },
];

export function TarefasModal({ storeId, open, onOpenChange }: TarefasModalProps) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [completedByNames, setCompletedByNames] = useState<Map<string, string>>(new Map());
    const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
    
    const { tasks, loading, completeTask, uncompleteTask } = useDailyTasks({
        storeId,
        date: selectedDate,
        enabled: !!storeId && open
    });

    const { statistics, loading: statsLoading } = useTaskStatistics({
        storeId,
        date: selectedDate,
        enabled: !!storeId && open
    });

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
                console.error('[TarefasModal] Erro ao buscar nomes:', error);
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

    const handleToggleComplete = async (task: DailyTask) => {
        setCompletingTaskId(task.id);
        try {
            if (task.completed_by) {
                await uncompleteTask(task.id);
            } else {
                await completeTask(task.id);
            }
        } finally {
            setCompletingTaskId(null);
        }
    };

    const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
    const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
    const goToToday = () => setSelectedDate(new Date());

    const isTodaySelected = isToday(selectedDate);
    const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

    const getPriorityData = (priority: string | null) => {
        return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
    };

    const isTaskOverdue = (task: DailyTask) => {
        if (!task.due_time || task.completed_by) return false;
        if (!isTodaySelected) return false;
        
        const now = new Date();
        const [dueHours, dueMinutes] = task.due_time.split(':').map(Number);
        const dueTime = new Date();
        dueTime.setHours(dueHours, dueMinutes, 0, 0);
        
        return now > dueTime;
    };

    const tasksByShift = tasks.reduce((acc, task) => {
        const shiftKey = task.shift_id || 'sem-turno';
        const shiftName = task.shift_name || 'Tarefas Gerais';
        
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

    const sortedShifts = Object.values(tasksByShift).sort((a, b) => {
        if (a.shiftStartTime && b.shiftStartTime) {
            return a.shiftStartTime.localeCompare(b.shiftStartTime);
        }
        return 0;
    });

    const completedCount = tasks.filter(t => t.completed_by).length;
    const totalCount = tasks.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-primary/5 to-primary/10">
                    <div className="flex items-center justify-between gap-2">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <CheckSquare2 className="h-5 w-5 text-primary" />
                            </div>
                            Tarefas do Dia
                        </DialogTitle>
                        {!isTodaySelected && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToToday}
                                data-testid="button-go-today"
                            >
                                Ir para Hoje
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg p-2 mt-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goToPreviousDay}
                            data-testid="button-prev-day"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        
                        <div className="flex-1 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className={cn(
                                    "font-semibold",
                                    isTodaySelected && "text-primary"
                                )}>
                                    {format(selectedDate, "EEEE", { locale: ptBR })}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                        </div>
                        
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goToNextDay}
                            data-testid="button-next-day"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-4">
                    {loading && tasks.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {totalCount > 0 && (
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Progresso do Dia</span>
                                        <span className="text-sm text-muted-foreground">
                                            {completedCount} de {totalCount} concluídas
                                        </span>
                                    </div>
                                    <Progress value={progressPercent} className="h-2" />
                                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <CircleDashed className="h-3 w-3" />
                                            {totalCount - completedCount} pendentes
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            {Math.round(progressPercent)}% completo
                                        </span>
                                    </div>
                                </div>
                            )}

                            {tasks.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <div className="p-4 rounded-full bg-muted/50 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                        <CheckSquare2 className="h-10 w-10 opacity-50" />
                                    </div>
                                    <p className="text-lg font-medium">Nenhuma tarefa para hoje</p>
                                    <p className="text-sm mt-2">O administrador ainda não configurou tarefas.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {sortedShifts.map((shift, shiftIndex) => (
                                        <div key={shift.shiftId || 'sem-turno'}>
                                            {shiftIndex > 0 && (
                                                <div className="my-4 border-t border-dashed" />
                                            )}

                                            <div className="flex items-center gap-2 mb-3">
                                                <div 
                                                    className="w-1 h-6 rounded-full"
                                                    style={{ backgroundColor: shift.shiftColor || 'hsl(var(--primary))' }}
                                                />
                                                <h3 className="font-semibold text-sm">{shift.shiftName}</h3>
                                                {shift.shiftStartTime && shift.shiftEndTime && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {shift.shiftStartTime} - {shift.shiftEndTime}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="relative pl-4 border-l-2 border-muted space-y-3">
                                                {shift.tasks.map((task) => {
                                                    const priorityData = getPriorityData(task.priority);
                                                    const PriorityIcon = priorityData.icon;
                                                    const isCompleted = !!task.completed_by;
                                                    const isOverdue = isTaskOverdue(task);
                                                    const isCompleting = completingTaskId === task.id;
                                                    const completedByName = task.completed_by 
                                                        ? completedByNames.get(task.completed_by) || 'Usuário'
                                                        : null;

                                                    return (
                                                        <div key={task.id} className="relative">
                                                            <div 
                                                                className={cn(
                                                                    "absolute -left-[21px] top-3 w-3 h-3 rounded-full border-2 bg-background",
                                                                    isCompleted 
                                                                        ? "border-emerald-500 bg-emerald-500" 
                                                                        : isOverdue 
                                                                            ? "border-red-500 animate-pulse"
                                                                            : "border-muted-foreground/50"
                                                                )}
                                                            />

                                                            <div 
                                                                className={cn(
                                                                    "p-3 rounded-lg border-2 transition-all duration-200",
                                                                    isCompleted 
                                                                        ? "bg-emerald-500/10 border-emerald-500/30" 
                                                                        : isOverdue
                                                                            ? "bg-red-500/10 border-red-500/30"
                                                                            : "bg-card border-border hover:border-primary/50"
                                                                )}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className="pt-0.5">
                                                                        {isCompleting ? (
                                                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                        ) : (
                                                                            <Checkbox
                                                                                checked={isCompleted}
                                                                                onCheckedChange={() => handleToggleComplete(task)}
                                                                                disabled={isPastDate && !isCompleted}
                                                                                className="h-5 w-5"
                                                                                data-testid={`checkbox-task-${task.id}`}
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={cn(
                                                                                "font-medium",
                                                                                isCompleted && "line-through text-muted-foreground"
                                                                            )}>
                                                                                {task.title}
                                                                            </span>
                                                                            
                                                                            <Badge 
                                                                                variant="outline" 
                                                                                className={cn("text-xs", priorityData.color)}
                                                                            >
                                                                                <PriorityIcon className="h-3 w-3 mr-1" />
                                                                                {priorityData.label}
                                                                            </Badge>

                                                                            {isOverdue && (
                                                                                <Badge variant="destructive" className="text-xs">
                                                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                                                    Atrasada
                                                                                </Badge>
                                                                            )}
                                                                        </div>

                                                                        {task.description && (
                                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                                {task.description}
                                                                            </p>
                                                                        )}

                                                                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                                            {task.due_time && (
                                                                                <span className={cn(
                                                                                    "flex items-center gap-1",
                                                                                    isOverdue && "text-red-500"
                                                                                )}>
                                                                                    <Timer className="h-3 w-3" />
                                                                                    Prazo: {task.due_time}
                                                                                </span>
                                                                            )}
                                                                            
                                                                            {isCompleted && completedByName && (
                                                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                                    <User className="h-3 w-3" />
                                                                                    {completedByName}
                                                                                    {task.completed_at && (
                                                                                        <span className="text-muted-foreground">
                                                                                            às {format(new Date(task.completed_at), 'HH:mm')}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {task.completion_notes && (
                                                                            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
                                                                                {task.completion_notes}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {statistics && !statsLoading && totalCount > 0 && (
                                <div className="mt-4 p-3 rounded-lg border bg-muted/30">
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                        <Timer className="h-4 w-4 text-primary" />
                                        Estatísticas do Período
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                                            <p className="text-xl font-bold text-primary">{statistics.total_tasks || 0}</p>
                                            <p className="text-xs text-muted-foreground">Total</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
                                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {statistics.completed_tasks || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Concluídas</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-amber-500/10 text-center">
                                            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                                                {statistics.pending_tasks || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Pendentes</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                {Math.round(statistics.completion_rate || 0)}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">Taxa</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
