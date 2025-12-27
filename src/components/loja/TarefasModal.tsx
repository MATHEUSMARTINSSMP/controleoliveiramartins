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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
    Loader2, CheckSquare2, Calendar, ChevronLeft, ChevronRight,
    Clock, AlertTriangle, Flag, Zap, User, CheckCircle2,
    CircleDashed, Timer, Users
} from "lucide-react";
import { useDailyTasks, DailyTask } from "@/hooks/useDailyTasks";
import { useTaskStatistics } from "@/hooks/useTaskStatistics";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TarefasModalProps {
    storeId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Colaboradora {
    id: string;
    name: string;
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
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [selectingForTask, setSelectingForTask] = useState<DailyTask | null>(null);
    const [selectedColaboradora, setSelectedColaboradora] = useState<string>("");
    
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
        const fetchColaboradoras = async () => {
            if (!storeId) return;

            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('name');

            if (error) {
                console.error('[TarefasModal] Erro ao buscar colaboradoras:', error);
                return;
            }

            setColaboradoras(data || []);
        };

        if (open && storeId) {
            fetchColaboradoras();
        }
    }, [storeId, open]);

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

    const handleCheckboxClick = (task: DailyTask) => {
        if (task.completed_by) {
            handleUncomplete(task);
        } else {
            setSelectingForTask(task);
            setSelectedColaboradora("");
        }
    };

    const handleConfirmComplete = async () => {
        if (!selectingForTask || !selectedColaboradora) {
            toast.error('Selecione uma colaboradora');
            return;
        }

        setCompletingTaskId(selectingForTask.id);
        try {
            await completeTaskWithProfile(selectingForTask.id, selectedColaboradora);
            setSelectingForTask(null);
            setSelectedColaboradora("");
        } finally {
            setCompletingTaskId(null);
        }
    };

    const completeTaskWithProfile = async (taskId: string, profileId: string): Promise<boolean> => {
        try {
            const { error: completeError } = await supabase.rpc('complete_task_execution', {
                p_task_id: taskId,
                p_profile_id: profileId,
                p_notes: null,
                p_completion_date: selectedDate.toISOString().split('T')[0]
            });

            if (completeError) throw completeError;
            toast.success('Tarefa marcada como completa!');
            return true;
        } catch (err: any) {
            console.error('[TarefasModal] Erro ao completar tarefa:', err);
            toast.error('Erro ao marcar tarefa: ' + (err.message || 'Erro desconhecido'));
            return false;
        }
    };

    const handleUncomplete = async (task: DailyTask) => {
        setCompletingTaskId(task.id);
        try {
            await uncompleteTask(task.id);
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

    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.due_time && b.due_time) {
            return a.due_time.localeCompare(b.due_time);
        }
        if (a.due_time) return -1;
        if (b.due_time) return 1;
        return 0;
    });

    const completedCount = tasks.filter(t => t.completed_by).length;
    const totalCount = tasks.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    const overdueCount = sortedTasks.filter(t => isTaskOverdue(t)).length;
    const pendingOnTimeCount = sortedTasks.filter(t => !t.completed_by && !isTaskOverdue(t)).length;

    const getCurrentTimePosition = () => {
        if (!isTodaySelected || sortedTasks.length === 0) return null;
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        let position = 0;
        for (const task of sortedTasks) {
            if (task.due_time && task.due_time > currentTime) {
                break;
            }
            position++;
        }
        
        return position;
    };

    const currentTimePosition = getCurrentTimePosition();

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
                                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground flex-wrap gap-2">
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            {completedCount} concluídas
                                        </span>
                                        {isTodaySelected && overdueCount > 0 && (
                                            <span className="flex items-center gap-1 text-red-500">
                                                <AlertTriangle className="h-3 w-3" />
                                                {overdueCount} atrasadas
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <CircleDashed className="h-3 w-3" />
                                            {pendingOnTimeCount} no prazo
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
                                <div className="relative">
                                    <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-amber-500 to-red-500/30" />
                                    
                                    <div className="space-y-3">
                                        {sortedTasks.map((task, index) => {
                                            const priorityData = getPriorityData(task.priority);
                                            const PriorityIcon = priorityData.icon;
                                            const isCompleted = !!task.completed_by;
                                            const isOverdue = isTaskOverdue(task);
                                            const isCompleting = completingTaskId === task.id;
                                            const isSelectingThis = selectingForTask?.id === task.id;
                                            const completedByName = task.completed_by 
                                                ? completedByNames.get(task.completed_by) || 'Usuário'
                                                : null;
                                            
                                            const showCurrentTimeLine = isTodaySelected && 
                                                currentTimePosition !== null && 
                                                index === currentTimePosition;

                                            return (
                                                <div key={task.id} className="relative">
                                                    {showCurrentTimeLine && (
                                                        <div className="relative mb-3 flex items-center gap-2">
                                                            <div className="absolute left-[11px] w-[9px] h-[9px] rounded-full bg-primary ring-2 ring-primary/30 animate-pulse z-10" />
                                                            <div className="ml-8 flex-1 h-px bg-primary/50" />
                                                            <span className="text-xs font-medium text-primary px-2">
                                                                {format(new Date(), 'HH:mm')} - Agora
                                                            </span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-start gap-3">
                                                        <div className="relative z-10 flex flex-col items-center">
                                                            <div 
                                                                className={cn(
                                                                    "w-[9px] h-[9px] rounded-full border-2 bg-background",
                                                                    isCompleted 
                                                                        ? "border-emerald-500 bg-emerald-500" 
                                                                        : isOverdue 
                                                                            ? "border-red-500 bg-red-500 animate-pulse"
                                                                            : "border-amber-500"
                                                                )}
                                                            />
                                                        </div>

                                                        <div 
                                                            className={cn(
                                                                "flex-1 p-3 rounded-lg border-2 transition-all duration-200",
                                                                isCompleted 
                                                                    ? "bg-emerald-500/10 border-emerald-500/30" 
                                                                    : isOverdue
                                                                        ? "bg-red-500/10 border-red-500/30"
                                                                        : isSelectingThis
                                                                            ? "bg-primary/10 border-primary/50"
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
                                                                            onCheckedChange={() => handleCheckboxClick(task)}
                                                                            disabled={isPastDate && !isCompleted}
                                                                            className="h-5 w-5"
                                                                            data-testid={`checkbox-task-${task.id}`}
                                                                        />
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {task.due_time && (
                                                                            <Badge 
                                                                                variant="outline" 
                                                                                className={cn(
                                                                                    "text-xs font-mono",
                                                                                    isOverdue 
                                                                                        ? "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30" 
                                                                                        : isCompleted
                                                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                                                                            : "bg-muted"
                                                                                )}
                                                                            >
                                                                                <Clock className="h-3 w-3 mr-1" />
                                                                                {task.due_time.substring(0, 5)}
                                                                            </Badge>
                                                                        )}
                                                                        
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

                                                                    {isCompleted && completedByName && (
                                                                        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                                                                            <User className="h-3 w-3" />
                                                                            {completedByName}
                                                                            {task.completed_at && (
                                                                                <span className="text-muted-foreground">
                                                                                    às {format(new Date(task.completed_at), 'HH:mm')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {isSelectingThis && (
                                                                        <div className="mt-3 p-3 rounded-lg bg-background border border-primary/30">
                                                                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                                                <Users className="h-4 w-4 text-primary" />
                                                                                Quem executou esta tarefa?
                                                                            </p>
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <Select
                                                                                    value={selectedColaboradora}
                                                                                    onValueChange={setSelectedColaboradora}
                                                                                >
                                                                                    <SelectTrigger 
                                                                                        className="flex-1 min-w-[180px]" 
                                                                                        data-testid="select-colaboradora"
                                                                                    >
                                                                                        <SelectValue placeholder="Selecione..." />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {colaboradoras.map(colab => (
                                                                                            <SelectItem 
                                                                                                key={colab.id} 
                                                                                                value={colab.id}
                                                                                                data-testid={`option-colab-${colab.id}`}
                                                                                            >
                                                                                                {colab.name}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={handleConfirmComplete}
                                                                                    disabled={!selectedColaboradora}
                                                                                    data-testid="button-confirm-complete"
                                                                                >
                                                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                                    Confirmar
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => setSelectingForTask(null)}
                                                                                    data-testid="button-cancel-complete"
                                                                                >
                                                                                    Cancelar
                                                                                </Button>
                                                                            </div>
                                                                            {colaboradoras.length === 0 && (
                                                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                                                                    Nenhuma colaboradora ativa encontrada.
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {task.completion_notes && (
                                                                        <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
                                                                            {task.completion_notes}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
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
                                        <div className="p-2 rounded-lg bg-primary/10 text-center">
                                            <p className="text-xl font-bold text-primary">
                                                {statistics.completion_rate || 0}%
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
