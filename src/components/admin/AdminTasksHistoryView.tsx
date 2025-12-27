/**
 * Componente de Histórico de Execuções de Tarefas
 * Admin pode navegar por datas para ver quem executou cada tarefa
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Loader2, History, Calendar, ChevronLeft, ChevronRight,
    Clock, AlertTriangle, Flag, Zap, User, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskExecution {
    execution_date: string;
    task_id: string;
    task_title: string;
    task_priority: string | null;
    due_time: string | null;
    is_completed: boolean;
    completed_at: string | null;
    completed_by: string | null;
    completed_by_name: string | null;
    completion_notes: string | null;
}

interface Store {
    id: string;
    name: string;
}

const PRIORITIES = [
    { value: 'ALTA', label: 'Alta', color: 'bg-red-500/20 text-red-700 dark:text-red-400', dotColor: 'bg-red-500', icon: AlertTriangle },
    { value: 'MÉDIA', label: 'Média', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400', dotColor: 'bg-amber-500', icon: Flag },
    { value: 'BAIXA', label: 'Baixa', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400', dotColor: 'bg-emerald-500', icon: Zap },
];

export function AdminTasksHistoryView() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [executions, setExecutions] = useState<TaskExecution[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

    useEffect(() => {
        fetchStores();
    }, []);

    useEffect(() => {
        if (selectedStoreId) {
            fetchHistory();
        } else {
            setExecutions([]);
        }
    }, [selectedStoreId, currentWeekStart]);

    const fetchStores = async () => {
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('active', true)
                .order('name');

            if (error) throw error;
            setStores(data || []);
        } catch (error: unknown) {
            console.error('[AdminTasksHistoryView] Erro ao buscar lojas:', error);
            toast.error('Erro ao carregar lojas');
        }
    };

    const fetchHistory = async () => {
        if (!selectedStoreId) return;

        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_task_execution_history', {
                p_store_id: selectedStoreId,
                p_start_date: format(currentWeekStart, 'yyyy-MM-dd'),
                p_end_date: format(weekEnd, 'yyyy-MM-dd')
            });

            if (error) {
                if (error.code === 'PGRST42883' || error.message?.includes('does not exist')) {
                    console.warn('[AdminTasksHistoryView] Função get_task_execution_history não existe ainda.');
                    setExecutions([]);
                    return;
                }
                throw error;
            }

            setExecutions((data as unknown as TaskExecution[]) || []);
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('[AdminTasksHistoryView] Erro ao buscar histórico:', error);
            toast.error('Erro ao carregar histórico: ' + (err.message || 'Erro desconhecido'));
            setExecutions([]);
        } finally {
            setLoading(false);
        }
    };

    const navigateWeek = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            setCurrentWeekStart(subWeeks(currentWeekStart, 1));
        } else {
            setCurrentWeekStart(addWeeks(currentWeekStart, 1));
        }
    };

    const goToCurrentWeek = () => {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    };

    const getPriorityData = (priority: string | null) => {
        return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
    };

    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const daysOfWeek = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

    const executionsByDay = useMemo(() => {
        const grouped: Record<string, TaskExecution[]> = {};
        
        daysOfWeek.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            grouped[dateKey] = [];
        });

        executions.forEach(exec => {
            const dateKey = exec.execution_date;
            if (grouped[dateKey]) {
                grouped[dateKey].push(exec);
            }
        });

        return grouped;
    }, [executions, daysOfWeek]);

    const getStatsForDay = (dayExecutions: TaskExecution[]) => {
        const total = dayExecutions.length;
        const completed = dayExecutions.filter(e => e.is_completed).length;
        return { total, completed, pending: total - completed };
    };

    return (
        <div className="space-y-6">
            <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <History className="h-5 w-5 text-primary" />
                                </div>
                                Histórico de Execuções
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Veja quem executou cada tarefa em cada dia
                            </CardDescription>
                        </div>
                        
                        <div className="w-full sm:w-56">
                            <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
                                <SelectTrigger data-testid="select-store-history">
                                    <SelectValue placeholder="Selecione uma loja" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map(store => (
                                        <SelectItem key={store.id} value={store.id}>
                                            {store.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                {selectedStoreId && (
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek('prev')}
                                    data-testid="button-prev-week-history"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center gap-2 px-3">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">
                                        {format(currentWeekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek('next')}
                                    data-testid="button-next-week-history"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToCurrentWeek}
                                data-testid="button-current-week-history"
                            >
                                Semana Atual
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : executions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <div className="p-4 rounded-full bg-muted/50 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                    <History className="h-10 w-10 opacity-50" />
                                </div>
                                <p className="text-lg font-medium">Nenhum histórico encontrado</p>
                                <p className="text-sm mt-2">Não há tarefas registradas para esta semana.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-4">
                                    {daysOfWeek.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const dayExecutions = executionsByDay[dateKey] || [];
                                        const stats = getStatsForDay(dayExecutions);
                                        const isTodayDate = isToday(day);

                                        if (dayExecutions.length === 0) return null;

                                        return (
                                            <div 
                                                key={dateKey}
                                                className={cn(
                                                    "rounded-lg border-2 overflow-hidden",
                                                    isTodayDate ? "border-primary" : "border-border"
                                                )}
                                            >
                                                <div className={cn(
                                                    "px-4 py-2 flex items-center justify-between",
                                                    isTodayDate ? "bg-primary/10" : "bg-muted/50"
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "font-semibold",
                                                            isTodayDate && "text-primary"
                                                        )}>
                                                            {format(day, "EEEE", { locale: ptBR })}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {format(day, "dd/MM/yyyy")}
                                                        </span>
                                                        {isTodayDate && (
                                                            <Badge variant="default" className="text-xs">Hoje</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs">
                                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {stats.completed} concluídas
                                                        </span>
                                                        {stats.pending > 0 && (
                                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                                <XCircle className="h-3 w-3" />
                                                                {stats.pending} pendentes
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="divide-y">
                                                    {dayExecutions.map((exec, idx) => {
                                                        const priorityData = getPriorityData(exec.task_priority);

                                                        return (
                                                            <div 
                                                                key={`${exec.task_id}-${idx}`}
                                                                className="px-4 py-3 flex items-center justify-between gap-4"
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className={cn(
                                                                        "w-2 h-2 rounded-full flex-shrink-0",
                                                                        priorityData.dotColor
                                                                    )} />
                                                                    
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={cn(
                                                                                "font-medium",
                                                                                exec.is_completed && "text-muted-foreground"
                                                                            )}>
                                                                                {exec.task_title}
                                                                            </span>
                                                                            {exec.due_time && (
                                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                                    <Clock className="h-3 w-3" />
                                                                                    {exec.due_time}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {exec.completion_notes && (
                                                                            <p className="text-xs text-muted-foreground mt-1 italic">
                                                                                {exec.completion_notes}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {exec.is_completed ? (
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                                Concluída
                                                                            </Badge>
                                                                            {exec.completed_by_name && (
                                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                                    <User className="h-3 w-3" />
                                                                                    {exec.completed_by_name}
                                                                                    {exec.completed_at && (
                                                                                        <span>
                                                                                            às {format(new Date(exec.completed_at), 'HH:mm')}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-muted-foreground">
                                                                            <XCircle className="h-3 w-3 mr-1" />
                                                                            Pendente
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
