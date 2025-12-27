/**
 * Componente de Visualização em Calendário de Tarefas Recorrentes Semanais
 * Grid fixo: Colunas = Dias da Semana, Linhas = Slots de Horário
 * Design para tarefas recorrentes (ex: toda segunda 10h, toda terça 17h)
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
    Loader2, Plus, Edit, Trash2, CheckSquare2, Clock, 
    AlertTriangle, Zap, Flag
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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
    { value: 0, label: 'DOM', fullLabel: 'Domingo' },
    { value: 1, label: 'SEG', fullLabel: 'Segunda' },
    { value: 2, label: 'TER', fullLabel: 'Terça' },
    { value: 3, label: 'QUA', fullLabel: 'Quarta' },
    { value: 4, label: 'QUI', fullLabel: 'Quinta' },
    { value: 5, label: 'SEX', fullLabel: 'Sexta' },
    { value: 6, label: 'SÁB', fullLabel: 'Sábado' },
];

const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

const PRIORITIES = [
    { value: 'ALTA', label: 'Alta', color: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30', dotColor: 'bg-red-500', icon: AlertTriangle },
    { value: 'MÉDIA', label: 'Média', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500', icon: Flag },
    { value: 'BAIXA', label: 'Baixa', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-500', icon: Zap },
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

    const tasksBySlot = useMemo(() => {
        const grid: Record<string, Record<number, TaskByWeekday[]>> = {};
        
        TIME_SLOTS.forEach(time => {
            grid[time] = {};
            WEEKDAYS.forEach(wd => {
                grid[time][wd.value] = [];
            });
        });

        const noTimeSlot: Record<number, TaskByWeekday[]> = {};
        WEEKDAYS.forEach(wd => {
            noTimeSlot[wd.value] = [];
        });

        tasks.forEach(task => {
            const timeKey = task.due_time?.substring(0, 5);
            
            if (task.weekday === null) {
                WEEKDAYS.forEach(wd => {
                    if (timeKey && grid[timeKey]) {
                        grid[timeKey][wd.value].push({ ...task, weekday: wd.value });
                    } else if (!timeKey) {
                        noTimeSlot[wd.value].push({ ...task, weekday: wd.value });
                    }
                });
            } else {
                if (timeKey && grid[timeKey]) {
                    grid[timeKey][task.weekday].push(task);
                } else if (!timeKey) {
                    noTimeSlot[task.weekday].push(task);
                }
            }
        });

        return { grid, noTimeSlot };
    }, [tasks]);

    const usedTimeSlots = useMemo(() => {
        const slots = new Set<string>();
        tasks.forEach(task => {
            if (task.due_time) {
                const timeKey = task.due_time.substring(0, 5);
                if (TIME_SLOTS.includes(timeKey)) {
                    slots.add(timeKey);
                }
            }
        });
        return Array.from(slots).sort();
    }, [tasks]);

    const handleOpenDialog = (task?: TaskByWeekday, weekday?: number, time?: string) => {
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
                due_time: time || "",
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

    const today = new Date().getDay();

    const renderTaskCell = (cellTasks: TaskByWeekday[], weekday: number, time?: string) => {
        if (cellTasks.length === 0) {
            return (
                <button
                    onClick={() => handleOpenDialog(undefined, weekday, time)}
                    className="w-full h-full min-h-[40px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-add-task-${weekday}-${time || 'notime'}`}
                >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
            );
        }

        return (
            <div className="space-y-1 p-1">
                {cellTasks.map((task) => {
                    const priorityData = getPriorityData(task.priority);

                    return (
                        <div
                            key={`${task.id}-${weekday}`}
                            className={cn(
                                "px-2 py-1.5 rounded-md border text-xs group/task cursor-pointer transition-all",
                                priorityData.color
                            )}
                            onClick={() => handleOpenDialog(task)}
                            data-testid={`task-${task.id}`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", priorityData.dotColor)} />
                                    <span className="font-medium truncate">{task.title}</span>
                                </div>
                                <div className="flex gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={(e) => { e.stopPropagation(); handleOpenDialog(task); }}
                                        data-testid={`button-edit-task-${task.id}`}
                                    >
                                        <Edit className="h-2.5 w-2.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-destructive"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                                        data-testid={`button-delete-task-${task.id}`}
                                    >
                                        <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                </div>
                            </div>
                            {task.due_time && !time && (
                                <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-70">
                                    <Clock className="h-2.5 w-2.5" />
                                    {task.due_time}
                                </div>
                            )}
                        </div>
                    );
                })}
                <button
                    onClick={() => handleOpenDialog(undefined, weekday, time)}
                    className="w-full py-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                    data-testid={`button-add-more-${weekday}-${time || 'notime'}`}
                >
                    <Plus className="h-3 w-3" />
                </button>
            </div>
        );
    };

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
                                Tarefas Recorrentes Semanais
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Configure tarefas fixas para cada dia da semana (ex: toda segunda 10h)
                            </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="w-full sm:w-56">
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
                            
                            {selectedStoreId && (
                                <Button onClick={() => handleOpenDialog()} data-testid="button-add-task">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nova Tarefa
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>

                {selectedStoreId && (
                    <CardContent className="space-y-4">
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
                                <p className="text-sm mt-2">Clique em "Nova Tarefa" ou em qualquer célula para começar</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[600px]">
                                <div className="min-w-[800px]">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="w-20 p-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                                                    <Clock className="h-4 w-4" />
                                                </th>
                                                {WEEKDAYS.map((wd) => (
                                                    <th 
                                                        key={wd.value}
                                                        className={cn(
                                                            "p-2 text-center text-sm font-semibold uppercase tracking-wide border-b min-w-[100px]",
                                                            today === wd.value 
                                                                ? "text-primary bg-primary/5" 
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {wd.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TIME_SLOTS.map((time) => {
                                                const hasTasksInSlot = usedTimeSlots.includes(time) || 
                                                    WEEKDAYS.some(wd => (tasksBySlot.grid[time]?.[wd.value]?.length || 0) > 0);
                                                
                                                if (!hasTasksInSlot && usedTimeSlots.length > 0 && !['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].includes(time)) {
                                                    return null;
                                                }

                                                return (
                                                    <tr key={time} className="group border-b border-border/50 hover:bg-muted/30 transition-colors">
                                                        <td className="p-2 text-sm font-medium text-muted-foreground whitespace-nowrap align-top">
                                                            {time}
                                                        </td>
                                                        {WEEKDAYS.map((wd) => (
                                                            <td 
                                                                key={`${time}-${wd.value}`}
                                                                className={cn(
                                                                    "p-1 align-top border-l border-border/30 min-h-[50px]",
                                                                    today === wd.value && "bg-primary/5"
                                                                )}
                                                            >
                                                                {renderTaskCell(
                                                                    tasksBySlot.grid[time]?.[wd.value] || [],
                                                                    wd.value,
                                                                    time
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                            
                                            {Object.values(tasksBySlot.noTimeSlot).some(arr => arr.length > 0) && (
                                                <tr className="group border-t-2 border-border">
                                                    <td className="p-2 text-sm font-medium text-muted-foreground whitespace-nowrap align-top">
                                                        <span className="text-xs">Sem horário</span>
                                                    </td>
                                                    {WEEKDAYS.map((wd) => (
                                                        <td 
                                                            key={`notime-${wd.value}`}
                                                            className={cn(
                                                                "p-1 align-top border-l border-border/30",
                                                                today === wd.value && "bg-primary/5"
                                                            )}
                                                        >
                                                            {renderTaskCell(
                                                                tasksBySlot.noTimeSlot[wd.value] || [],
                                                                wd.value
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </ScrollArea>
                        )}

                        <div className="flex items-center gap-4 pt-4 border-t">
                            <span className="text-xs text-muted-foreground font-medium">Legenda:</span>
                            {PRIORITIES.map(p => (
                                <div key={p.value} className="flex items-center gap-1.5">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", p.dotColor)} />
                                    <span className="text-xs text-muted-foreground">{p.label}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckSquare2 className="h-5 w-5 text-primary" />
                            {editingTask ? 'Editar Tarefa' : 'Nova Tarefa Recorrente'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTask 
                                ? 'Atualize os dados da tarefa abaixo.'
                                : 'Configure uma tarefa que se repete semanalmente.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título da Tarefa *</Label>
                            <Input
                                id="title"
                                placeholder="Ex: Conferir estoque"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                data-testid="input-task-title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                placeholder="Detalhes adicionais..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="resize-none"
                                rows={2}
                                data-testid="input-task-description"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Dia da Semana</Label>
                                <Select 
                                    value={formData.weekday?.toString() ?? "all"} 
                                    onValueChange={(v) => setFormData(prev => ({ 
                                        ...prev, 
                                        weekday: v === "all" ? null : Number(v) 
                                    }))}
                                >
                                    <SelectTrigger data-testid="select-weekday">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os dias</SelectItem>
                                        {WEEKDAYS.map(wd => (
                                            <SelectItem key={wd.value} value={wd.value.toString()}>
                                                {wd.fullLabel}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="due_time">Horário</Label>
                                <Input
                                    id="due_time"
                                    type="time"
                                    value={formData.due_time}
                                    onChange={(e) => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                                    data-testid="input-task-time"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prioridade</Label>
                                <Select 
                                    value={formData.priority} 
                                    onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                                >
                                    <SelectTrigger data-testid="select-priority">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map(p => (
                                            <SelectItem key={p.value} value={p.value}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", p.dotColor)} />
                                                    {p.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {shifts.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Turno (opcional)</Label>
                                    <Select 
                                        value={formData.shift_id} 
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, shift_id: v }))}
                                    >
                                        <SelectTrigger data-testid="select-shift">
                                            <SelectValue placeholder="Nenhum" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum</SelectItem>
                                            {shifts.map(shift => (
                                                <SelectItem key={shift.id} value={shift.id}>
                                                    {shift.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
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
