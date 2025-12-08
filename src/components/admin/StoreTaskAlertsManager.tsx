import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Calendar, 
  Phone, 
  Send, 
  Loader2, 
  AlertTriangle,
  Store,
  MessageSquare,
  Users,
  Settings,
  Copy,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils";

interface StoreData {
  id: string;
  name: string;
  whatsapp_ativo: boolean;
}

interface TaskRecipient {
  id?: string;
  phone: string;
  name?: string;
  ativo: boolean;
}

interface StoreTask {
  id: string;
  store_id: string;
  nome: string;
  mensagem: string;
  horarios: string[];
  dias_semana: number[];
  sender_type: 'GLOBAL' | 'STORE';
  sender_phone?: string;
  ativo: boolean;
  envios_hoje: number;
  recipients: TaskRecipient[];
  created_at: string;
}

interface StoreWithTasks extends StoreData {
  tasks: StoreTask[];
  total_envios_hoje: number;
}

const DIAS_SEMANA = [
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
  { value: 7, label: 'Dom', fullLabel: 'Domingo' },
];

const HORARIOS_SUGERIDOS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

export const StoreTaskAlertsManager = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storesWithTasks, setStoresWithTasks] = useState<StoreWithTasks[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StoreTask | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    mensagem: '',
    horarios: [] as string[],
    dias_semana: [1, 2, 3, 4, 5, 6] as number[],
    sender_type: 'GLOBAL' as 'GLOBAL' | 'STORE',
    sender_phone: '',
    ativo: true,
    recipients: [{ phone: '', name: '', ativo: true }] as TaskRecipient[],
  });
  
  const [customHorario, setCustomHorario] = useState('');

  useEffect(() => {
    if (profile && profile.role === 'ADMIN') {
      fetchStoresAndTasks();
    }
  }, [profile]);

  const fetchStoresAndTasks = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { data: stores, error: storesError } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, whatsapp_ativo')
        .eq('admin_id', profile.id)
        .eq('active', true)
        .order('name');

      if (storesError) throw storesError;

      if (!stores || stores.length === 0) {
        setStoresWithTasks([]);
        setLoading(false);
        return;
      }

      const storeIds = stores.map(s => s.id);
      
      const { data: tasks, error: tasksError } = await supabase
        .schema('sistemaretiradas')
        .from('store_notifications')
        .select('*')
        .in('store_id', storeIds)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('Erro ao buscar tarefas:', tasksError);
      }

      const taskIds = (tasks || []).map(t => t.id);
      let recipients: any[] = [];
      
      if (taskIds.length > 0) {
        const { data: recipientsData, error: recipientsError } = await supabase
          .schema('sistemaretiradas')
          .from('store_notification_recipients')
          .select('*')
          .in('notification_id', taskIds);
        
        if (recipientsError) {
          console.error('Erro ao buscar destinatários:', recipientsError);
        } else {
          recipients = recipientsData || [];
        }
      }

      const combined: StoreWithTasks[] = stores.map(store => {
        const storeTasks = (tasks || [])
          .filter(t => t.store_id === store.id)
          .map(task => ({
            ...task,
            horarios: task.horarios || [],
            dias_semana: task.dias_semana || [],
            sender_type: task.sender_type || 'GLOBAL',
            envios_hoje: task.envios_hoje || 0,
            recipients: recipients
              .filter(r => r.notification_id === task.id)
              .map(r => ({
                id: r.id,
                phone: r.phone,
                name: r.name,
                ativo: r.ativo
              }))
          }));
        
        const totalEnvios = storeTasks.reduce((sum, t) => sum + (t.envios_hoje || 0), 0);
        
        return {
          ...store,
          tasks: storeTasks,
          total_envios_hoje: totalEnvios
        };
      });

      setStoresWithTasks(combined);
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (storeId: string, task?: StoreTask) => {
    setSelectedStoreId(storeId);
    
    if (task) {
      setEditingTask(task);
      setFormData({
        nome: task.nome || '',
        mensagem: task.mensagem || '',
        horarios: task.horarios || [],
        dias_semana: task.dias_semana || [1, 2, 3, 4, 5, 6],
        sender_type: task.sender_type || 'GLOBAL',
        sender_phone: task.sender_phone || '',
        ativo: task.ativo,
        recipients: task.recipients.length > 0 
          ? task.recipients 
          : [{ phone: '', name: '', ativo: true }],
      });
    } else {
      setEditingTask(null);
      setFormData({
        nome: '',
        mensagem: '',
        horarios: [],
        dias_semana: [1, 2, 3, 4, 5, 6],
        sender_type: 'GLOBAL',
        sender_phone: '',
        ativo: true,
        recipients: [{ phone: '', name: '', ativo: true }],
      });
    }
    
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!profile || !selectedStoreId) return;

    if (!formData.nome.trim()) {
      toast.error('Informe o nome da tarefa');
      return;
    }
    if (!formData.mensagem.trim()) {
      toast.error('Informe a mensagem');
      return;
    }
    if (formData.horarios.length === 0) {
      toast.error('Selecione pelo menos um horário');
      return;
    }
    if (formData.dias_semana.length === 0) {
      toast.error('Selecione pelo menos um dia da semana');
      return;
    }
    
    const validRecipients = formData.recipients.filter(r => r.phone.trim());
    if (validRecipients.length === 0) {
      toast.error('Adicione pelo menos um destinatário');
      return;
    }

    setSaving(true);
    try {
      const taskData = {
        store_id: selectedStoreId,
        admin_id: profile.id,
        nome: formData.nome.trim(),
        mensagem: formData.mensagem.trim(),
        horarios: formData.horarios,
        dias_semana: formData.dias_semana,
        sender_type: formData.sender_type,
        sender_phone: formData.sender_type === 'STORE' ? formData.sender_phone : null,
        ativo: formData.ativo,
        numero_whatsapp: validRecipients[0]?.phone || '',
        updated_at: new Date().toISOString(),
      };

      let taskId: string;

      if (editingTask) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('store_notifications')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) throw error;
        taskId = editingTask.id;

        await supabase
          .schema('sistemaretiradas')
          .from('store_notification_recipients')
          .delete()
          .eq('notification_id', taskId);
      } else {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('store_notifications')
          .insert({ ...taskData, created_at: new Date().toISOString() })
          .select('id')
          .single();

        if (error) throw error;
        taskId = data.id;
      }

      if (validRecipients.length > 0) {
        const recipientsToInsert = validRecipients.map(r => ({
          notification_id: taskId,
          phone: r.phone.replace(/\D/g, ''),
          name: r.name || null,
          ativo: r.ativo,
        }));

        const { error: recipientsError } = await supabase
          .schema('sistemaretiradas')
          .from('store_notification_recipients')
          .insert(recipientsToInsert);

        if (recipientsError) {
          console.error('Erro ao salvar destinatários:', recipientsError);
        }
      }

      toast.success(editingTask ? 'Alerta atualizado' : 'Alerta criado');
      setDialogOpen(false);
      fetchStoresAndTasks();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Deseja excluir este alerta?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('store_notifications')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Alerta excluído');
      fetchStoresAndTasks();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleActive = async (task: StoreTask) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('store_notifications')
        .update({ ativo: !task.ativo })
        .eq('id', task.id);

      if (error) throw error;

      setStoresWithTasks(prev => 
        prev.map(store => ({
          ...store,
          tasks: store.tasks.map(t => 
            t.id === task.id ? { ...t, ativo: !t.ativo } : t
          )
        }))
      );
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDuplicateTask = (task: StoreTask) => {
    setSelectedStoreId(task.store_id);
    setEditingTask(null);
    setFormData({
      nome: task.nome + ' (cópia)',
      mensagem: task.mensagem,
      horarios: [...task.horarios],
      dias_semana: [...task.dias_semana],
      sender_type: task.sender_type,
      sender_phone: task.sender_phone || '',
      ativo: true,
      recipients: task.recipients.map(r => ({ ...r, id: undefined })),
    });
    setDialogOpen(true);
  };

  const toggleHorario = (horario: string) => {
    setFormData(prev => ({
      ...prev,
      horarios: prev.horarios.includes(horario)
        ? prev.horarios.filter(h => h !== horario)
        : [...prev.horarios, horario].sort()
    }));
  };

  const addCustomHorario = () => {
    if (customHorario && !formData.horarios.includes(customHorario)) {
      setFormData(prev => ({
        ...prev,
        horarios: [...prev.horarios, customHorario].sort()
      }));
      setCustomHorario('');
    }
  };

  const toggleDia = (dia: number) => {
    setFormData(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort((a, b) => a - b)
    }));
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, { phone: '', name: '', ativo: true }]
    }));
  };

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const updateRecipient = (index: number, field: 'phone' | 'name', value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => 
        i === index ? { ...r, [field]: value } : r
      )
    }));
  };

  const formatHorarios = (horarios: string[]) => {
    if (!horarios || horarios.length === 0) return '-';
    return horarios.map(h => h.substring(0, 5)).join(', ');
  };

  const formatDias = (dias: number[]) => {
    if (!dias || dias.length === 0) return '-';
    if (dias.length === 7) return 'Todos os dias';
    if (dias.length === 6 && !dias.includes(7)) return 'Seg a Sáb';
    if (dias.length === 5 && dias.every(d => d >= 1 && d <= 5)) return 'Seg a Sex';
    return dias.map(d => DIAS_SEMANA.find(ds => ds.value === d)?.label || d).join(', ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Carregando alertas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            Sistema de Alertas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure tarefas programadas para envio via WhatsApp (limite: 10/dia por loja)
          </p>
        </div>
      </div>

      {storesWithTasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              Nenhuma loja encontrada. Cadastre uma loja primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={storesWithTasks.map(s => s.id)} className="space-y-4">
          {storesWithTasks.map((store) => (
            <AccordionItem 
              key={store.id} 
              value={store.id}
              className="border rounded-lg overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{store.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {store.tasks.length} {store.tasks.length === 1 ? 'alerta' : 'alertas'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={store.total_envios_hoje >= 10 ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {store.total_envios_hoje}/10 envios hoje
                    </Badge>
                    {!store.whatsapp_ativo && (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        WhatsApp inativo
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {store.total_envios_hoje >= 10 && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">
                        Limite diario atingido (10/10). Novos alertas serao enviados amanha.
                      </p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(store.id)}
                    className="w-full sm:w-auto gap-2"
                    disabled={store.total_envios_hoje >= 10}
                    data-testid={`button-add-alert-${store.id}`}
                  >
                    <Plus className="h-4 w-4" />
                    Novo Alerta
                  </Button>

                  {store.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum alerta configurado para esta loja.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {store.tasks.map((task) => (
                        <Card key={task.id} className={`${!task.ativo ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium truncate">{task.nome || 'Sem nome'}</h4>
                                    <Badge variant={task.ativo ? 'default' : 'secondary'} className="text-xs shrink-0">
                                      {task.ativo ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {task.mensagem}
                                  </p>
                                </div>
                                <Switch
                                  checked={task.ativo}
                                  onCheckedChange={() => handleToggleActive(task)}
                                  data-testid={`switch-alert-${task.id}`}
                                />
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs">
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatHorarios(task.horarios)}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDias(task.dias_semana)}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                                  <Users className="h-3 w-3" />
                                  <span>{task.recipients.length} dest.</span>
                                </div>
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                                  <Send className="h-3 w-3" />
                                  <span>{task.sender_type === 'STORE' ? 'Loja' : 'Global'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(store.id, task)}
                                  data-testid={`button-edit-alert-${task.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicateTask(task)}
                                  data-testid={`button-duplicate-alert-${task.id}`}
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  Duplicar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(task.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-alert-${task.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              {editingTask ? 'Editar Alerta' : 'Novo Alerta'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes do alerta de tarefa
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Tarefa *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Espirrar aromatizador"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  data-testid="input-task-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Ex: Hora de espirrar o aromatizador da loja!"
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  rows={3}
                  data-testid="input-task-message"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Horários de Envio *</Label>
                <div className="flex flex-wrap gap-2">
                  {HORARIOS_SUGERIDOS.map((h) => (
                    <Badge
                      key={h}
                      variant={formData.horarios.includes(h) ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => toggleHorario(h)}
                      data-testid={`badge-time-${h}`}
                    >
                      {h.substring(0, 5)}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={customHorario}
                    onChange={(e) => setCustomHorario(e.target.value)}
                    className="w-32"
                    data-testid="input-custom-time"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addCustomHorario}
                    data-testid="button-add-custom-time"
                  >
                    Adicionar
                  </Button>
                </div>
                {formData.horarios.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selecionados: {formData.horarios.join(', ')}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Dias da Semana *</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => (
                    <Badge
                      key={dia.value}
                      variant={formData.dias_semana.includes(dia.value) ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => toggleDia(dia.value)}
                      data-testid={`badge-day-${dia.value}`}
                    >
                      {dia.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, dias_semana: [1, 2, 3, 4, 5] })}
                    data-testid="button-weekdays-mon-fri"
                  >
                    Seg-Sex
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, dias_semana: [1, 2, 3, 4, 5, 6] })}
                    data-testid="button-weekdays-mon-sat"
                  >
                    Seg-Sáb
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, dias_semana: [1, 2, 3, 4, 5, 6, 7] })}
                    data-testid="button-weekdays-all"
                  >
                    Todos
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Remetente</Label>
                <Select
                  value={formData.sender_type}
                  onValueChange={(v) => setFormData({ ...formData, sender_type: v as 'GLOBAL' | 'STORE' })}
                >
                  <SelectTrigger data-testid="select-sender-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">Elevea (numero global)</SelectItem>
                    <SelectItem value="STORE">Numero proprio da loja</SelectItem>
                  </SelectContent>
                </Select>
                {formData.sender_type === 'STORE' && (
                  <p className="text-sm text-muted-foreground">
                    Sera usado o numero WhatsApp configurado para esta loja
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Destinatários *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addRecipient}
                    data-testid="button-add-recipient"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.recipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="DDD + Numero (ex: 96981113307)"
                          value={recipient.phone}
                          onChange={(e) => updateRecipient(index, 'phone', e.target.value)}
                          data-testid={`input-recipient-phone-${index}`}
                        />
                        <Input
                          placeholder="Nome (opcional)"
                          value={recipient.name || ''}
                          onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                          data-testid={`input-recipient-name-${index}`}
                        />
                      </div>
                      {formData.recipients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecipient(index)}
                          className="shrink-0"
                          data-testid={`button-remove-recipient-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Informe apenas DDD + numero, sem codigo do pais (DDI)
                </p>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                  data-testid="switch-task-active"
                />
                <Label htmlFor="ativo">Alerta ativo</Label>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} data-testid="button-cancel-task">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-task">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreTaskAlertsManager;
