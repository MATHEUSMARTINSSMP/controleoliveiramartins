/**
 * Componente de Configuração de Tarefas do Dia no Admin Dashboard
 * Permite criar, editar e gerenciar tarefas diárias por loja
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Edit, Trash2, CheckSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Shift {
    id: string;
    name: string;
    start_time: string | null;
    end_time: string | null;
    color: string | null;
}

interface DailyTask {
    id: string;
    store_id: string;
    title: string;
    description: string | null;
    shift_id: string | null;
    due_time: string | null;
    is_active: boolean;
    is_recurring: boolean;
    display_order: number;
    shift_name?: string;
}

interface Store {
    id: string;
    name: string;
}

export function AdminDailyTasksConfig() {
    const { profile } = useAuth();
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        shift_id: "",
        due_time: "",
        is_recurring: false,
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
            console.error('[AdminDailyTasksConfig] Erro ao buscar lojas:', error);
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

            if (error) throw error;
            setShifts(data || []);
        } catch (error: any) {
            console.error('[AdminDailyTasksConfig] Erro ao buscar turnos:', error);
        }
    };

    const fetchTasks = async () => {
        if (!selectedStoreId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('daily_tasks')
                .select(`
                    *,
                    shifts:shift_id (
                        name
                    )
                `)
                .eq('store_id', selectedStoreId)
                .order('display_order')
                .order('created_at');

            if (error) throw error;

            const tasksData = (data || []).map((task: any) => ({
                ...task,
                shift_name: task.shifts?.name || null
            }));

            setTasks(tasksData);
        } catch (error: any) {
            console.error('[AdminDailyTasksConfig] Erro ao buscar tarefas:', error);
            toast.error('Erro ao carregar tarefas');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (task?: DailyTask) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description || "",
                shift_id: task.shift_id || "",
                due_time: task.due_time || "",
                is_recurring: task.is_recurring,
                display_order: task.display_order
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: "",
                description: "",
                shift_id: "",
                due_time: "",
                is_recurring: false,
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
            shift_id: "",
            due_time: "",
            is_recurring: false,
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
                // Atualizar tarefa
                const { error } = await supabase.rpc('update_daily_task', {
                    p_task_id: editingTask.id,
                    p_title: formData.title.trim(),
                    p_description: formData.description.trim() || null,
                    p_shift_id: formData.shift_id || null,
                    p_due_time: formData.due_time || null,
                    p_is_recurring: formData.is_recurring,
                    p_display_order: formData.display_order
                });

                if (error) throw error;
                toast.success('Tarefa atualizada com sucesso!');
            } else {
                // Criar tarefa
                const { error } = await supabase.rpc('create_daily_task', {
                    p_store_id: selectedStoreId,
                    p_title: formData.title.trim(),
                    p_description: formData.description.trim() || null,
                    p_shift_id: formData.shift_id || null,
                    p_due_time: formData.due_time || null,
                    p_is_recurring: formData.is_recurring,
                    p_display_order: formData.display_order,
                    p_created_by: profile?.id || null
                });

                if (error) throw error;
                toast.success('Tarefa criada com sucesso!');
            }

            handleCloseDialog();
            fetchTasks();
        } catch (error: any) {
            console.error('[AdminDailyTasksConfig] Erro ao salvar tarefa:', error);
            toast.error('Erro ao salvar tarefa: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleToggleActive = async (task: DailyTask) => {
        try {
            const { error } = await supabase.rpc('update_daily_task', {
                p_task_id: task.id,
                p_is_active: !task.is_active
            });

            if (error) throw error;
            toast.success(`Tarefa ${!task.is_active ? 'ativada' : 'desativada'}!`);
            fetchTasks();
        } catch (error: any) {
            console.error('[AdminDailyTasksConfig] Erro ao alterar status:', error);
            toast.error('Erro ao alterar status da tarefa');
        }
    };

    const handleDelete = async (task: DailyTask) => {
        if (!confirm(`Tem certeza que deseja excluir a tarefa "${task.title}"?`)) {
            return;
        }

        try {
            const { error } = await supabase.rpc('delete_daily_task', {
                p_task_id: task.id
            });

            if (error) throw error;
            toast.success('Tarefa excluída com sucesso!');
            fetchTasks();
        } catch (error: any) {
            console.error('[AdminDailyTasksConfig] Erro ao excluir tarefa:', error);
            toast.error('Erro ao excluir tarefa: ' + (error.message || 'Erro desconhecido'));
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
                tasks: []
            };
        }

        acc[shiftKey].tasks.push(task);
        return acc;
    }, {} as Record<string, { shiftId: string | null; shiftName: string; tasks: DailyTask[] }>);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5" />
                        Configuração de Tarefas do Dia
                    </CardTitle>
                    <CardDescription>
                        Configure tarefas diárias organizadas por turno para cada loja
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

                    {/* Botão Criar Tarefa */}
                    {selectedStoreId && (
                        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Tarefa
                        </Button>
                    )}

                    {/* Lista de Tarefas */}
                    {selectedStoreId && (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Nenhuma tarefa configurada para esta loja.</p>
                                    <p className="text-sm mt-2">Clique em "Nova Tarefa" para começar.</p>
                                </div>
                            ) : (
                                Object.values(tasksByShift).map(({ shiftName, tasks: shiftTasks }) => (
                                    <Card key={shiftName} className="border-2">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">{shiftName}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {shiftTasks.map(task => (
                                                <div
                                                    key={task.id}
                                                    className={`p-4 border rounded-lg flex items-start justify-between gap-4 ${
                                                        !task.is_active ? 'opacity-50' : ''
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-semibold">{task.title}</h4>
                                                            {!task.is_active && (
                                                                <Badge variant="secondary">Inativa</Badge>
                                                            )}
                                                            {task.is_recurring && (
                                                                <Badge variant="outline">Recorrente</Badge>
                                                            )}
                                                            {task.shift_name && (
                                                                <Badge variant="outline">{task.shift_name}</Badge>
                                                            )}
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-sm text-muted-foreground mb-2">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                        {task.due_time && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                Até {task.due_time}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Switch
                                                            checked={task.is_active}
                                                            onCheckedChange={() => handleToggleActive(task)}
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenDialog(task)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(task)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Criar/Editar Tarefa */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure os detalhes da tarefa diária
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="title">Título *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Ex: Enviar mensagem de cashback"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descrição opcional da tarefa"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="shift">Turno</Label>
                                <Select
                                    value={formData.shift_id}
                                    onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um turno" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Sem Turno</SelectItem>
                                        {shifts.map(shift => (
                                            <SelectItem key={shift.id} value={shift.id}>
                                                {shift.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="due_time">Horário Limite</Label>
                                <Input
                                    id="due_time"
                                    type="time"
                                    value={formData.due_time}
                                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="display_order">Ordem de Exibição</Label>
                                <Input
                                    id="display_order"
                                    type="number"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                    min={0}
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch
                                    id="is_recurring"
                                    checked={formData.is_recurring}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                                />
                                <Label htmlFor="is_recurring" className="cursor-pointer">
                                    Tarefa Recorrente (diária)
                                </Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingTask ? 'Atualizar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

