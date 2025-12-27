/**
 * Componente de Visualização em Calendário/Tabela de Tarefas do Dia
 * Design moderno tipo timeline com visual atraente e cores de prioridade
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Loader2, Plus, Edit, Trash2, CheckSquare2, Clock, Calendar,
    ChevronLeft, ChevronRight, AlertTriangle, Zap, Flag
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskByWeekday {
    id: string;
    store_id: string;
    title: string;
    description: string | null;
    due_time: string | null;
    priority: string | null;
    weekday: number | null;
    shift_id: string | null;
    shift_name: string | null;
    display_order: number;
}

interface Store {
    id: string;
    name: string;
}

interface Shift {
    id: string;
    name: string;
}

const WEEKDAYS = [
    { value: 0, label: 'Dom', fullLabel: 'Domingo' },
    { value: 1, label: 'Seg', fullLabel: 'Segunda' },
    { value: 2, label: 'Ter', fullLabel: 'Terça' },
    { value: 3, label: 'Qua', fullLabel: 'Quarta' },
    { value: 4, label: 'Qui', fullLabel: 'Quinta' },
    { value: 5, label: 'Sex', fullLabel: 'Sexta' },
    { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const PRIORITIES = [
    { value: 'ALTA', label: 'Alta', color: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30', icon: AlertTriangle },
    { value: 'MÉDIA', label: 'Média', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: Flag },
    { value: 'BAIXA', label: 'Baixa', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: Zap },
];

export function AdminTasksCalendarView() {
    const { profile } = useAuth();
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<TaskByWeekday[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskByWeekday | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        shift_id: "none",
        due_time: "",
        priority: "MÉDIA",
        weekday: null as number | null,
        display_order: 0
    });

    useEffect(() => {
        fetchStores();
        fetchShifts();
    }, []);

    useEffect(() => {
        if (selectedStoreId) {
            fetchTasks();
        } else {
            setTasks([]);
        }
    }, [selectedStoreId]);

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
            console.error('[AdminTasksCalendarView] Erro ao buscar lojas:', error);
            toast.error('Erro ao carregar lojas');
        }
    };

    const fetchShifts = async () => {
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('shifts')
                .select('*')
                .order('display_order');

            if (error) {
                if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
                    console.warn('[AdminTasksCalendarView] Tabela shifts não existe ainda.');
                    setShifts([]);
                    return;
                }
                throw error;
            }
            setShifts(data || []);
        } catch (error: unknown) {
            console.error('[AdminTasksCalendarView] Erro ao buscar turnos:', error);
            setShifts([]);
        }
    };

    const fetchTasks = async () => {
        if (!selectedStoreId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_daily_tasks_by_weekday', {
                p_store_id: selectedStoreId
            });

            if (error) {
                if (error.code === 'PGRST42883' || error.message?.includes('does not exist')) {
                    console.warn('[AdminTasksCalendarView] Função get_daily_tasks_by_weekday não existe ainda.');
                    setTasks([]);
                    return;
                }
                throw error;
            }

            setTasks((data as unknown as TaskByWeekday[]) || []);
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('[AdminTasksCalendarView] Erro ao buscar tarefas:', error);
            toast.error('Erro ao carregar tarefas: ' + (err.message || 'Erro desconhecido'));
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const tasksByWeekday = useMemo(() => {
        const grouped: Record<number, TaskByWeekday[]> = {};
        
        WEEKDAYS.forEach(wd => {
            grouped[wd.value] = [];
        });

        tasks.forEach(task => {
            if (task.weekday === null) {
                WEEKDAYS.forEach(wd => {
                    grouped[wd.value].push({ ...task, weekday: wd.value });
                });
            } else {
                grouped[task.weekday].push(task);
            }
        });

        Object.keys(grouped).forEach(key => {
            grouped[Number(key)].sort((a, b) => {
                if (!a.due_time && !b.due_time) return a.display_order - b.display_order;
                if (!a.due_time) return 1;
                if (!b.due_time) return -1;
                return a.due_time.localeCompare(b.due_time);
            });
        });

        return grouped;
    }, [tasks]);

    const handleOpenDialog = (task?: TaskByWeekday, weekday?: number) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description || "",
                shift_id: task.shift_id || "none",
                due_time: task.due_time || "",
                priority: task.priority || "MÉDIA",
                weekday: task.weekday,
                display_order: task.display_order
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: "",
                description: "",
                shift_id: "none",
                due_time: "",
                priority: "MÉDIA",
                weekday: weekday !== undefined ? weekday : null,
                display_order: tasks.length
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingTask(null);
        setFormData({
            title: "",
            description: "",
            shift_id: "none",
            due_time: "",
            priority: "MÉDIA",
            weekday: null,
            display_order: 0
        });
    };

    const handleSubmit = async () => {
        if (!selectedStoreId || !formData.title.trim()) {
            toast.error('Preencha o título da tarefa');
            return;
        }

        try {
            if (editingTask) {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('daily_tasks')
                    .update({
                        title: formData.title.trim(),
                        description: formData.description.trim() || null,
                        shift_id: formData.shift_id === "none" ? null : formData.shift_id,
                        due_time: formData.due_time || null,
                        priority: formData.priority,
                        weekday: formData.weekday,
                        display_order: formData.display_order
                    })
                    .eq('id', editingTask.id);

                if (error) throw error;
                toast.success('Tarefa atualizada com sucesso!');
            } else {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('daily_tasks')
                    .insert({
                        store_id: selectedStoreId,
                        title: formData.title.trim(),
                        description: formData.description.trim() || null,
                        shift_id: formData.shift_id === "none" ? null : formData.shift_id,
                        due_time: formData.due_time || null,
                        priority: formData.priority,
                        weekday: formData.weekday,
                        display_order: formData.display_order,
                        is_active: true,
                        created_by: profile?.id || null
                    });

                if (error) throw error;
                toast.success('Tarefa criada com sucesso!');
            }

            handleCloseDialog();
            fetchTasks();
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('[AdminTasksCalendarView] Erro ao salvar tarefa:', error);
            toast.error('Erro ao salvar tarefa: ' + (err.message || 'Erro desconhecido'));
        }
    };

    const handleDelete = async (task: TaskByWeekday) => {
        if (!confirm(`Tem certeza que deseja excluir a tarefa "${task.title}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('daily_tasks')
                .delete()
                .eq('id', task.id);

            if (error) throw error;
            toast.success('Tarefa excluída com sucesso!');
            fetchTasks();
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error('[AdminTasksCalendarView] Erro ao excluir tarefa:', error);
            toast.error('Erro ao excluir tarefa: ' + (err.message || 'Erro desconhecido'));
        }
    };

    const getPriorityData = (priority: string | null) => {
        return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
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

    const getWeekDates = () => {
        return WEEKDAYS.map((wd, index) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + index);
            return date;
        });
    };

    const weekDates = getWeekDates();
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });

    return (
        <div className="space-y-6">
            <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <CheckSquare2 className="h-5 w-5 text-primary" />
                                </div>
                                Tarefas Semanais
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Configure tarefas recorrentes para cada dia da semana
                            </CardDescription>
                        </div>
                        
                        <div className="w-full sm:w-64">
                            <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
                                <SelectTrigger data-testid="select-store">
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek('prev')}
                                    data-testid="button-prev-week"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center gap-2 px-3">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">
                                        {format(currentWeekStart, "dd MMM", { locale: ptBR })} - {format(currentWeekEnd, "dd MMM yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek('next')}
                                    data-testid="button-next-week"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={goToCurrentWeek}
                                    data-testid="button-current-week"
                                >
                                    Hoje
                                </Button>
                            </div>
                            
                            <Button onClick={() => handleOpenDialog()} data-testid="button-add-task">
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Tarefa
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <div className="p-4 rounded-full bg-muted/50 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                    <CheckSquare2 className="h-10 w-10 opacity-50" />
                                </div>
                                <p className="text-lg font-medium">Nenhuma tarefa configurada</p>
                                <p className="text-sm mt-2">Clique em "Nova Tarefa" para começar</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-2">
                                {WEEKDAYS.map((weekday, index) => {
                                    const dayTasks = tasksByWeekday[weekday.value] || [];
                                    const date = weekDates[index];
                                    const isTodayDate = isToday(date);

                                    return (
                                        <div
                                            key={weekday.value}
                                            className={cn(
                                                "min-h-[300px] rounded-lg border-2 transition-all duration-200",
                                                isTodayDate 
                                                    ? "border-primary bg-primary/5" 
                                                    : "border-border bg-card"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 border-b text-center",
                                                isTodayDate ? "bg-primary/10" : "bg-muted/30"
                                            )}>
                                                <p className={cn(
                                                    "text-xs font-semibold uppercase tracking-wide",
                                                    isTodayDate ? "text-primary" : "text-muted-foreground"
                                                )}>
                                                    {weekday.label}
                                                </p>
                                                <p className={cn(
                                                    "text-lg font-bold",
                                                    isTodayDate ? "text-primary" : ""
                                                )}>
                                                    {format(date, "dd")}
                                                </p>
                                            </div>

                                            <ScrollArea className="h-[250px]">
                                                <div className="p-2 space-y-2">
                                                    {dayTasks.map((task) => {
                                                        const priorityData = getPriorityData(task.priority);
                                                        const PriorityIcon = priorityData.icon;

                                                        return (
                                                            <div
                                                                key={`${task.id}-${weekday.value}`}
                                                                className={cn(
                                                                    "p-2 rounded-md border transition-all duration-200 hover-elevate group",
                                                                    priorityData.color
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between gap-1">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1 mb-1">
                                                                            <PriorityIcon className="h-3 w-3 flex-shrink-0" />
                                                                            <span className="text-xs font-medium truncate">
                                                                                {task.title}
                                                                            </span>
                                                                        </div>
                                                                        {task.due_time && (
                                                                            <div className="flex items-center gap-1 text-[10px] opacity-80">
                                                                                <Clock className="h-2.5 w-2.5" />
                                                                                {task.due_time}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5"
                                                                            onClick={() => handleOpenDialog(task)}
                                                                            data-testid={`button-edit-task-${task.id}`}
                                                                        >
                                                                            <Edit className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 text-destructive"
                                                                            onClick={() => handleDelete(task)}
                                                                            data-testid={`button-delete-task-${task.id}`}
                                                                        >
                                                                            <Trash2 className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full h-7 text-xs border-dashed border hover:border-solid"
                                                        onClick={() => handleOpenDialog(undefined, weekday.value)}
                                                        data-testid={`button-add-task-${weekday.value}`}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Adicionar
                                                    </Button>
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingTask ? (
                                <>
                                    <Edit className="h-5 w-5" />
                                    Editar Tarefa
                                </>
                            ) : (
                                <>
                                    <Plus className="h-5 w-5" />
                                    Nova Tarefa
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTask
                                ? 'Altere os dados da tarefa abaixo'
                                : 'Preencha os dados para criar uma nova tarefa'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Ex: Varrer a Loja"
                                data-testid="input-task-title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detalhes adicionais..."
                                rows={2}
                                data-testid="input-task-description"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="weekday">Dia da Semana</Label>
                                <Select
                                    value={formData.weekday === null ? "all" : String(formData.weekday)}
                                    onValueChange={(v) => setFormData({ 
                                        ...formData, 
                                        weekday: v === "all" ? null : Number(v) 
                                    })}
                                >
                                    <SelectTrigger data-testid="select-weekday">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Dias</SelectItem>
                                        {WEEKDAYS.map(wd => (
                                            <SelectItem key={wd.value} value={String(wd.value)}>
                                                {wd.fullLabel}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="due_time">Horário Limite</Label>
                                <Input
                                    id="due_time"
                                    type="time"
                                    value={formData.due_time}
                                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                    data-testid="input-task-time"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Prioridade</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger data-testid="select-priority">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map(p => (
                                            <SelectItem key={p.value} value={p.value}>
                                                <span className="flex items-center gap-2">
                                                    <p.icon className="h-3 w-3" />
                                                    {p.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shift">Turno</Label>
                                <Select
                                    value={formData.shift_id}
                                    onValueChange={(v) => setFormData({ ...formData, shift_id: v })}
                                >
                                    <SelectTrigger data-testid="select-shift">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhum</SelectItem>
                                        {shifts.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} data-testid="button-save-task">
                            {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
