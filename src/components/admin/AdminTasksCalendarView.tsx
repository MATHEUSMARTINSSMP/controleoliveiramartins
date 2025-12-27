/**
 * Componente de Visualização em Calendário/Tabela de Tarefas do Dia
 * Exibe tarefas organizadas por dia da semana em formato de tabela
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Edit, Trash2, CheckSquare2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface TaskByWeekday {
    id: string;
    store_id: string;
    title: string;
    description: string | null;
    due_time: string | null;
    priority: string | null;
    weekday: number | null; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado, NULL = todos os dias
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
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
    { value: null, label: 'Todos os Dias' },
];

const PRIORITIES = [
    { value: 'ALTA', label: 'ALTA', color: 'destructive' },
    { value: 'MÉDIA', label: 'MÉDIA', color: 'default' },
    { value: 'BAIXA', label: 'BAIXA', color: 'secondary' },
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
        } catch (error: any) {
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
        } catch (error: any) {
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
                    console.warn('[AdminTasksCalendarView] Função get_daily_tasks_by_weekday não existe ainda. Execute a migration primeiro.');
                    setTasks([]);
                    return;
                }
                throw error;
            }

            setTasks((data as unknown as TaskByWeekday[]) || []);
        } catch (error: any) {
            console.error('[AdminTasksCalendarView] Erro ao buscar tarefas:', error);
            toast.error('Erro ao carregar tarefas: ' + (error.message || 'Erro desconhecido'));
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    // Agrupar tarefas por horário (due_time) e depois por dia da semana
    const tasksByTimeAndWeekday = useMemo(() => {
        const grouped: Record<string, Partial<Record<number | 'all', TaskByWeekday[]>>> = {};

        tasks.forEach(task => {
            const timeKey = task.due_time || 'sem-horario';
            const weekdayKey = task.weekday === null ? 'all' : task.weekday;

            if (!grouped[timeKey]) {
                grouped[timeKey] = {};
            }
            if (!grouped[timeKey][weekdayKey]) {
                grouped[timeKey][weekdayKey] = [];
            }
            grouped[timeKey][weekdayKey]!.push(task);
        });

        // Ordenar por horário
        const sortedTimes = Object.keys(grouped).sort((a, b) => {
            if (a === 'sem-horario') return 1;
            if (b === 'sem-horario') return -1;
            return a.localeCompare(b);
        });

        return sortedTimes.map(time => ({
            time,
            tasks: grouped[time]
        }));
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

        // weekday já está validado pelo Select (não precisa validação adicional)

        try {
            if (editingTask) {
                // Atualizar tarefa - usar função RPC ou update direto
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
                // Criar tarefa
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
        } catch (error: any) {
            console.error('[AdminTasksCalendarView] Erro ao salvar tarefa:', error);
            toast.error('Erro ao salvar tarefa: ' + (error.message || 'Erro desconhecido'));
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
        } catch (error: any) {
            console.error('[AdminTasksCalendarView] Erro ao excluir tarefa:', error);
            toast.error('Erro ao excluir tarefa: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const getPriorityBadge = (priority: string | null) => {
        const priorityData = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
        return (
            <Badge variant={priorityData.color as any} className="text-xs">
                {priorityData.label}
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckSquare2 className="h-5 w-5" />
                        Tarefas Semanais (Configuração Fixa)
                    </CardTitle>
                    <CardDescription>
                        Configure tarefas fixas para cada dia da semana. Cada tarefa está vinculada a um dia específico.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Seletor de Loja */}
                    <div>
                        <Label>Selecione a Loja</Label>
                        <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
                            <SelectTrigger>
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

                    {/* Botão Adicionar Tarefa */}
                    {selectedStoreId && (
                        <div className="flex justify-end">
                            <Button onClick={() => handleOpenDialog()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Tarefa
                            </Button>
                        </div>
                    )}

                    {/* Tabela de Calendário */}
                    {selectedStoreId && (
                        <div className="border rounded-lg overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <CheckSquare2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Nenhuma tarefa configurada para esta loja.</p>
                                    <p className="text-sm mt-2">Clique em "Adicionar Tarefa" para começar.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[120px]">Horário</TableHead>
                                            {WEEKDAYS.filter(wd => wd.value !== null).map(weekday => (
                                                <TableHead key={weekday.value} className="text-center">
                                                    {weekday.label}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tasksByTimeAndWeekday.map(({ time, tasks: timeTasks }) => (
                                            <TableRow key={time}>
                                                <TableCell className="font-medium">
                                                    {time === 'sem-horario' ? 'Sem horário' : time}
                                                </TableCell>
                                                {WEEKDAYS.filter(wd => wd.value !== null).map(weekday => {
                                                    const weekdayTasks = timeTasks[weekday.value!] || [];
                                                    return (
                                                        <TableCell key={weekday.value} className="align-top">
                                                            <div className="space-y-2">
                                                                {weekdayTasks.map(task => (
                                                                    <div
                                                                        key={task.id}
                                                                        className="p-2 border rounded-md bg-card"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="font-medium text-sm truncate">{task.title}</div>
                                                                                {task.description && (
                                                                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                                        {task.description}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex gap-1 flex-shrink-0">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6"
                                                                                    onClick={() => handleOpenDialog(task)}
                                                                                >
                                                                                    <Edit className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 text-destructive"
                                                                                    onClick={() => handleDelete(task)}
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            {getPriorityBadge(task.priority)}
                                                                            {task.shift_name && (
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {task.shift_name}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {weekdayTasks.length === 0 && (
                                                                    <div className="text-center text-xs text-muted-foreground py-2">
                                                                        -
                                                                    </div>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full mt-1 text-xs h-7"
                                                                    onClick={() => handleOpenDialog(undefined, weekday.value!)}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" />
                                                                    Adicionar
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                        {tasksByTimeAndWeekday.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                                    Nenhuma tarefa encontrada
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Criar/Editar Tarefa */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTask
                                ? 'Altere os dados da tarefa abaixo'
                                : 'Preencha os dados para criar uma nova tarefa'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {/* Estrutura tipo tabela para melhor organização visual */}
                        <div className="border rounded-lg overflow-hidden bg-card">
                            <Table>
                                <TableBody>
                                    <TableRow className="border-b">
                                        <TableCell className="font-semibold bg-muted/50 w-[200px]">
                                            Título *
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                id="title"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Ex: Varrer a Loja"
                                                className="w-full"
                                            />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-b">
                                        <TableCell className="font-semibold bg-muted/50 align-top pt-4">
                                            Descrição
                                        </TableCell>
                                        <TableCell>
                                            <Textarea
                                                id="description"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Descrição opcional da tarefa"
                                                rows={3}
                                                className="w-full"
                                            />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-b">
                                        <TableCell className="font-semibold bg-muted/50">
                                            Horário
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                id="due_time"
                                                type="time"
                                                value={formData.due_time}
                                                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                                className="w-full max-w-[200px]"
                                            />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-b">
                                        <TableCell className="font-semibold bg-muted/50">
                                            Prioridade *
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={formData.priority}
                                                onValueChange={(value) => setFormData({ ...formData, priority: value })}
                                            >
                                                <SelectTrigger id="priority" className="w-full max-w-[200px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PRIORITIES.map(priority => (
                                                        <SelectItem key={priority.value} value={priority.value}>
                                                            {priority.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-b">
                                        <TableCell className="font-semibold bg-muted/50">
                                            Dia da Semana *
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={formData.weekday === null ? 'all' : formData.weekday.toString()}
                                                onValueChange={(value) => setFormData({ ...formData, weekday: value === 'all' ? null : parseInt(value) })}
                                            >
                                                <SelectTrigger id="weekday" className="w-full max-w-[250px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {WEEKDAYS.map(weekday => (
                                                        <SelectItem
                                                            key={weekday.value === null ? 'all' : weekday.value.toString()}
                                                            value={weekday.value === null ? 'all' : weekday.value.toString()}
                                                        >
                                                            {weekday.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-semibold bg-muted/50">
                                            Turno
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={formData.shift_id}
                                                onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
                                            >
                                                <SelectTrigger id="shift_id" className="w-full max-w-[250px]">
                                                    <SelectValue placeholder="Sem turno" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Sem turno</SelectItem>
                                                    {shifts.map(shift => (
                                                        <SelectItem key={shift.id} value={shift.id}>
                                                            {shift.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

