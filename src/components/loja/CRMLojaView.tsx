import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, Calendar, Gift, Phone, Clock, Loader2, CheckCircle2, Edit, XCircle } from "lucide-react";
import { format, startOfDay, endOfDay, isToday, parseISO, differenceInMinutes, differenceInHours, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, Bell } from "lucide-react";

interface CRMTask {
  id: string;
  title: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  cliente_whatsapp: string | null;
  informacoes_cliente: string | null; // ✅ Nova: informações adicionais (ocasião, ajuste, etc.)
  due_date: string;
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  status: "PENDENTE" | "CONCLUÍDA" | "CANCELADA";
  quem_fez: string | null;
  como_foi_contato: "WHATSAPP" | "TELEFONE" | "EMAIL" | "PRESENCIAL" | "OUTRO" | null;
  cliente_respondeu: boolean | null;
  observacoes_contato: string | null;
  colaboradora_id: string | null;
  atribuido_para: string | null;
  sale_id: string | null;
}

interface Birthday {
  id: string;
  nome: string;
  telefone: string | null;
  data_nascimento: string | null;
}

interface PostSale {
  id: string;
  cliente_nome: string;
  sale_date: string;
  scheduled_follow_up: string;
  details: string | null;
  status: "AGENDADA" | "CONCLUÍDA" | "CANCELADA";
}

interface CRMCommitment {
  id: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  type: "AJUSTE" | "FOLLOW_UP" | "VENDA" | "OUTRO";
  scheduled_date: string;
  notes: string | null;
  status: "AGENDADO" | "CONCLUÍDO" | "CANCELADO" | "FALTANDO";
}

interface CRMLojaViewProps {
  storeId: string | null;
}

export default function CRMLojaView({ storeId }: CRMLojaViewProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [postSales, setPostSales] = useState<PostSale[]>([]);
  const [commitments, setCommitments] = useState<CRMCommitment[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CRMTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [colaboradoras, setColaboradoras] = useState<Array<{id: string; name: string}>>([]);

  const [newTask, setNewTask] = useState({ 
    categoria: "PERSONALIZADA" as "ANIVERSARIO" | "POS_VENDA" | "PERSONALIZADA",
    title: "", 
    cliente_nome: "", 
    cliente_whatsapp: "",
    consultora_id: "TODOS",
    dueDate: "", 
    priority: "MÉDIA" as "ALTA" | "MÉDIA" | "BAIXA" 
  });
  
  const [newCommitment, setNewCommitment] = useState({ 
    cliente_nome: "", 
    type: "FOLLOW_UP" as "AJUSTE" | "FOLLOW_UP" | "VENDA" | "OUTRO", 
    scheduledDate: "", 
    notes: "" 
  });

  useEffect(() => {
    if (storeId) {
      fetchAllData();
    }
  }, [storeId]);

  const fetchAllData = async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchTasks(),
        fetchBirthdays(),
        fetchPostSales(),
        fetchCommitments()
      ]);
    } catch (error) {
      console.error('Erro ao buscar dados CRM:', error);
      toast.error('Erro ao carregar dados do CRM');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!storeId) {
      console.warn('[CRMLojaView] fetchTasks chamado sem storeId');
      return;
    }

    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      // ✅ Buscar tarefas do dia E tarefas atrasadas (status PENDENTE)
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'PENDENTE')
        .lte('due_date', todayEnd) // Tarefas até o final de hoje (inclui atrasadas)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('[CRMLojaView] Erro ao buscar tarefas:', error);
        // Não mostrar toast para erros de busca (pode ser apenas que não há dados)
        if (error.code !== 'PGRST116') {
          console.warn('[CRMLojaView] Erro ao buscar tarefas (não crítico):', error.message);
        }
        setTasks([]);
        return;
      }
      setTasks(data || []);
    } catch (error: any) {
      console.error('[CRMLojaView] Erro inesperado ao buscar tarefas:', error);
      setTasks([]);
    }
  };

  const fetchBirthdays = async () => {
    if (!storeId) return;

    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Buscar de crm_contacts
      const { data: crmContacts, error: crmError } = await supabase
        .schema('sistemaretiradas')
        .from('crm_contacts')
        .select('id, nome, telefone, data_nascimento')
        .eq('store_id', storeId)
        .not('data_nascimento', 'is', null);

      if (crmError) throw crmError;

      // Filtrar aniversariantes do dia
      const todayBirthdays = (crmContacts || []).filter(contact => {
        if (!contact.data_nascimento) return false;
        const birthDate = parseISO(contact.data_nascimento);
        return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
      });

      setBirthdays(todayBirthdays.map(c => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        data_nascimento: c.data_nascimento
      })));

      // Também buscar de tiny_contacts se disponível
      try {
        const { data: tinyContacts } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('id, nome, telefone, data_nascimento')
          .eq('store_id', storeId)
          .not('data_nascimento', 'is', null);

        if (tinyContacts) {
          const tinyBirthdays = tinyContacts.filter(contact => {
            if (!contact.data_nascimento) return false;
            const birthDate = parseISO(contact.data_nascimento);
            return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
          });

          setBirthdays(prev => [
            ...prev,
            ...tinyBirthdays.map(c => ({
              id: c.id,
              nome: c.nome,
              telefone: c.telefone,
              data_nascimento: c.data_nascimento
            }))
          ]);
        }
      } catch (e) {
        // Tabela pode não existir ou não ter dados
        console.log('Não foi possível buscar aniversariantes de tiny_contacts');
      }
    } catch (error: any) {
      console.error('Erro ao buscar aniversariantes:', error);
    }
  };

  const fetchPostSales = async () => {
    if (!storeId) return;

    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_post_sales')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'AGENDADA')
        .order('scheduled_follow_up', { ascending: true });

      if (error) throw error;
      setPostSales(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar pós-vendas:', error);
    }
  };

  const fetchCommitments = async () => {
    if (!storeId) return;

    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_commitments')
        .select('*')
        .eq('store_id', storeId)
        .gte('scheduled_date', todayStart)
        .lte('scheduled_date', todayEnd)
        .in('status', ['AGENDADO'])
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setCommitments(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar compromissos:', error);
    }
  };

  const handleAddTask = async () => {
    // Validações
    if (!storeId) {
      toast.error('Erro: Loja não identificada');
      return;
    }

    if (!newTask.title || newTask.title.trim().length === 0) {
      toast.error('O título da tarefa é obrigatório');
      return;
    }

    if (!newTask.cliente_nome || newTask.cliente_nome.trim().length === 0) {
      toast.error('O nome do cliente é obrigatório');
      return;
    }

    if (!newTask.dueDate) {
      toast.error('A data/hora da tarefa é obrigatória');
      return;
    }

    // Validar se a data não é no passado
    const dueDate = new Date(newTask.dueDate);
    if (isNaN(dueDate.getTime())) {
      toast.error('Data/hora inválida');
      return;
    }

    try {
      setSaving(true);
      // Determinar atribuido_para baseado na consultora selecionada
      const atribuidoPara = newTask.consultora_id === 'TODOS' ? 'TODOS' : newTask.consultora_id;

      const { error, data } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .insert([{
          store_id: storeId,
          colaboradora_id: newTask.consultora_id !== 'TODOS' ? newTask.consultora_id : null,
          cliente_nome: newTask.cliente_nome.trim(),
          cliente_whatsapp: newTask.cliente_whatsapp.trim() || null,
          title: newTask.title.trim(),
          description: `Categoria: ${newTask.categoria === 'ANIVERSARIO' ? 'Aniversário' : newTask.categoria === 'POS_VENDA' ? 'Pós-Venda' : 'Personalizada'}`,
          due_date: newTask.dueDate,
          priority: newTask.priority,
          status: 'PENDENTE',
          atribuido_para: atribuidoPara
        }])
        .select();

      if (error) {
        console.error('[CRMLojaView] Erro ao adicionar tarefa:', error);
        if (error.code === '23505') {
          toast.error('Esta tarefa já existe');
        } else if (error.code === '23503') {
          toast.error('Erro: Loja ou colaboradora inválida');
        } else {
          toast.error(`Erro ao adicionar tarefa: ${error.message || 'Erro desconhecido'}`);
        }
        return;
      }

      if (!data || data.length === 0) {
        toast.error('Erro: Tarefa não foi criada');
        return;
      }

      toast.success('Tarefa adicionada com sucesso!');
      setTaskDialogOpen(false);
      setNewTask({ 
        categoria: "PERSONALIZADA",
        title: "", 
        cliente_nome: "", 
        cliente_whatsapp: "",
        consultora_id: "TODOS",
        dueDate: "", 
        priority: "MÉDIA" 
      });
      await fetchTasks();
    } catch (error: any) {
      console.error('[CRMLojaView] Erro inesperado ao adicionar tarefa:', error);
      toast.error(`Erro inesperado: ${error.message || 'Tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!taskId) {
      toast.error('Erro: ID da tarefa não identificado');
      return;
    }

    try {
      const { error, data } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .update({ 
          status: 'CONCLUÍDA',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select();

      if (error) {
        console.error('[CRMLojaView] Erro ao concluir tarefa:', error);
        if (error.code === 'PGRST116') {
          toast.error('Tarefa não encontrada');
        } else {
          toast.error(`Erro ao concluir tarefa: ${error.message || 'Erro desconhecido'}`);
        }
        return;
      }

      if (!data || data.length === 0) {
        toast.error('Tarefa não encontrada');
        return;
      }

      toast.success('Tarefa concluída!');
      await fetchTasks();
    } catch (error: any) {
      console.error('[CRMLojaView] Erro inesperado ao concluir tarefa:', error);
      toast.error(`Erro inesperado: ${error.message || 'Tente novamente'}`);
    }
  };

  const handleAddCommitment = async () => {
    // Validações
    if (!storeId) {
      toast.error('Erro: Loja não identificada');
      return;
    }

    if (!newCommitment.cliente_nome || newCommitment.cliente_nome.trim().length === 0) {
      toast.error('O nome do cliente é obrigatório');
      return;
    }

    if (!newCommitment.scheduledDate) {
      toast.error('A data/hora do compromisso é obrigatória');
      return;
    }

    // Validar se a data não é no passado
    const scheduledDate = new Date(newCommitment.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      toast.error('Data/hora inválida');
      return;
    }

    try {
      setSaving(true);
      const { error, data } = await supabase
        .schema('sistemaretiradas')
        .from('crm_commitments')
        .insert([{
          store_id: storeId,
          colaboradora_id: profile?.id || null,
          cliente_nome: newCommitment.cliente_nome.trim(),
          type: newCommitment.type,
          scheduled_date: newCommitment.scheduledDate,
          notes: newCommitment.notes?.trim() || null,
          status: 'AGENDADO'
        }])
        .select();

      if (error) {
        console.error('[CRMLojaView] Erro ao agendar compromisso:', error);
        if (error.code === '23505') {
          toast.error('Este compromisso já existe');
        } else if (error.code === '23503') {
          toast.error('Erro: Loja ou colaboradora inválida');
        } else {
          toast.error(`Erro ao agendar compromisso: ${error.message || 'Erro desconhecido'}`);
        }
        return;
      }

      if (!data || data.length === 0) {
        toast.error('Erro: Compromisso não foi criado');
        return;
      }

      toast.success('Compromisso agendado com sucesso!');
      setCommitmentDialogOpen(false);
      setNewCommitment({ cliente_nome: "", type: "FOLLOW_UP", scheduledDate: "", notes: "" });
      await fetchCommitments();
    } catch (error: any) {
      console.error('[CRMLojaView] Erro inesperado ao agendar compromisso:', error);
      toast.error(`Erro inesperado: ${error.message || 'Tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  const whatsappLink = (phone: string, message: string) => {
    const normalizedPhone = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${normalizedPhone}?text=${encoded}`;
  };

  const getBirthdayMessage = (nome: string) => {
    const firstName = nome.split(' ')[0];
    return `Oi ${firstName}! Feliz Aniversário! 🎉 Aproveite nosso cupom HAPPY20 com 20% OFF em sua próxima compra!`;
  };

  const getTaskUrgency = (dueDate: string) => {
    const due = parseISO(dueDate);
    const now = new Date();
    const diffMinutes = differenceInMinutes(due, now);
    const diffHours = differenceInHours(due, now);

    if (isPast(due) && !isToday(due)) {
      return { level: 'overdue', label: 'Atrasada' };
    }
    if (diffHours < 1) {
      return { level: 'urgent', label: 'Urgente' };
    }
    if (diffHours < 3) {
      return { level: 'soon', label: 'Em breve' };
    }
    return { level: 'normal', label: null };
  };

  const getCommitmentUrgency = (scheduledDate: string) => {
    const scheduled = parseISO(scheduledDate);
    const now = new Date();
    const diffHours = differenceInHours(scheduled, now);

    if (isPast(scheduled) && !isToday(scheduled)) {
      return { level: 'overdue', label: 'Atrasado' };
    }
    if (diffHours < 1) {
      return { level: 'urgent', label: 'Urgente' };
    }
    if (diffHours < 3) {
      return { level: 'soon', label: 'Em breve' };
    }
    return { level: 'normal', label: null };
  };

  const handleOpenTaskEdit = (task: CRMTask) => {
    setSelectedTask(task);
    setTaskEditDialogOpen(true);
  };

  const handleUpdateTask = async (taskId: string, updates: any) => {
    if (!storeId) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('store_id', storeId);

      if (error) {
        console.error('[CRMLojaView] Erro ao atualizar tarefa:', error);
        toast.error('Erro ao atualizar tarefa');
        return;
      }

      toast.success('Tarefa atualizada com sucesso!');
      setTaskEditDialogOpen(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (error: any) {
      console.error('[CRMLojaView] Erro inesperado ao atualizar tarefa:', error);
      toast.error('Erro ao atualizar tarefa');
    } finally {
      setSaving(false);
    }
  };

  // Componente TaskCard
  const TaskCard = ({ task, onEdit, onComplete, colaboradoras }: {
    task: CRMTask;
    onEdit: () => void;
    onComplete: () => void;
    colaboradoras: Array<{id: string; name: string}>;
  }) => {
    const urgency = getTaskUrgency(task.due_date);
    const quemFezNome = colaboradoras.find(c => c.id === task.quem_fez)?.name || "Não definido";
    
    return (
      <div 
        className={`flex items-start justify-between p-3 rounded-lg border ${
          urgency.level === 'overdue' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
          urgency.level === 'urgent' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' :
          urgency.level === 'soon' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' :
          'bg-muted/50'
        }`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm">{task.title}</p>
            {urgency.label && (
              <Badge variant={urgency.level === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                {urgency.level === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                {urgency.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1">
            {task.cliente_nome} • {format(parseISO(task.due_date), "dd/MM/yyyy HH:mm")}
          </p>
          {task.cliente_whatsapp && (
            <p className="text-xs text-muted-foreground mb-1">
              📱 {task.cliente_whatsapp}
            </p>
          )}
          {/* ✅ Mostrar informações adicionais (ocasião, ajuste, etc.) */}
          {task.informacoes_cliente && (() => {
            try {
              const info = JSON.parse(task.informacoes_cliente);
              return (
                <div className="text-xs text-muted-foreground mb-1 space-y-0.5">
                  {info.ocasiao && (
                    <p>🎉 Ocasião: {info.ocasiao}</p>
                  )}
                  {info.ajuste && (
                    <p>✂️ Ajuste: {info.ajuste}</p>
                  )}
                </div>
              );
            } catch {
              // Se não for JSON, exibir como texto simples
              return (
                <p className="text-xs text-muted-foreground mb-1">
                  ℹ️ {task.informacoes_cliente}
                </p>
              );
            }
          })()}
          {/* Mostrar status do contato se já foi feito */}
          {task.quem_fez && (
            <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
              <p>✅ Feita por: {quemFezNome}</p>
              {task.como_foi_contato && (
                <p>📞 Contato: {task.como_foi_contato}</p>
              )}
              {task.cliente_respondeu !== null && (
                <p>{task.cliente_respondeu ? '✅ Cliente respondeu' : '❌ Cliente não respondeu'}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={task.priority === "ALTA" ? "destructive" : task.priority === "MÉDIA" ? "default" : "secondary"}>
            {task.priority}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8 p-0"
            title="Editar tarefa"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onComplete}
            className="h-8 w-8 p-0"
            title="Marcar como concluída"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Separar tarefas atrasadas das tarefas do dia
  const hoje = new Date();
  const hojeStart = startOfDay(hoje);
  
  const tarefasAtrasadas = tasks.filter(t => {
    const dueDate = parseISO(t.due_date);
    return dueDate < hojeStart;
  });
  
  const tarefasDoDia = tasks.filter(t => {
    const dueDate = parseISO(t.due_date);
    return dueDate >= hojeStart && dueDate <= endOfDay(hoje);
  });
  
  const pendingTasks = tasks.filter(t => t.status === "PENDENTE");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TAREFAS DO DIA */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tarefas do Dia ({pendingTasks.length})
            </CardTitle>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Tarefa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Categoria */}
                  <div>
                    <Label>Categoria *</Label>
                    <Select 
                      value={newTask.categoria} 
                      onValueChange={(v) => setNewTask({ ...newTask, categoria: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANIVERSARIO">Aniversário</SelectItem>
                        <SelectItem value="POS_VENDA">Pós-Venda</SelectItem>
                        <SelectItem value="PERSONALIZADA">Personalizada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tarefa (Descrição) */}
                  <div>
                    <Label>Tarefa (Descrição) *</Label>
                    <Textarea
                      placeholder="Ex: Ligar para Maria Silva, enviar mensagem de aniversário, etc."
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Cliente */}
                  <div>
                    <Label>Cliente *</Label>
                    <Input
                      placeholder="Nome do cliente"
                      value={newTask.cliente_nome}
                      onChange={(e) => setNewTask({ ...newTask, cliente_nome: e.target.value })}
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <Label>WhatsApp</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={newTask.cliente_whatsapp}
                      onChange={(e) => setNewTask({ ...newTask, cliente_whatsapp: e.target.value })}
                    />
                  </div>

                  {/* Consultora */}
                  <div>
                    <Label>Consultora *</Label>
                    <Select 
                      value={newTask.consultora_id} 
                      onValueChange={(v) => setNewTask({ ...newTask, consultora_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todas</SelectItem>
                        {colaboradoras.map((colab) => (
                          <SelectItem key={colab.id} value={colab.id}>
                            {colab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data */}
                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate ? newTask.dueDate.split('T')[0] : ''}
                      onChange={(e) => {
                        // Converter para formato datetime-local (adicionar hora padrão 09:00)
                        const dateValue = e.target.value;
                        setNewTask({ ...newTask, dueDate: dateValue ? `${dateValue}T09:00:00` : '' });
                      }}
                    />
                  </div>

                  {/* Prioridade */}
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALTA">Alta</SelectItem>
                        <SelectItem value="MÉDIA">Média</SelectItem>
                        <SelectItem value="BAIXA">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleAddTask} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Adicionar Tarefa
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* TAREFAS ATRASADAS */}
          {tarefasAtrasadas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Tarefas Atrasadas ({tarefasAtrasadas.length})
              </h3>
              <div className="space-y-2">
                {tarefasAtrasadas.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => handleOpenTaskEdit(task)}
                    onComplete={() => handleCompleteTask(task.id)}
                    colaboradoras={colaboradoras}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAREFAS DO DIA */}
          {tarefasDoDia.length > 0 ? (
            <div className="space-y-2">
              {tarefasAtrasadas.length > 0 && (
                <h3 className="text-sm font-semibold mb-3">Tarefas de Hoje ({tarefasDoDia.length})</h3>
              )}
              {tarefasDoDia.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => handleOpenTaskEdit(task)}
                  onComplete={() => handleCompleteTask(task.id)}
                  colaboradoras={colaboradoras}
                />
              ))}
            </div>
          ) : tarefasAtrasadas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhuma tarefa pendente hoje</p>
          ) : null}
        </CardContent>
      </Card>

      {/* ANIVERSARIANTES DO DIA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Aniversariantes Hoje ({birthdays.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {birthdays.length > 0 ? (
            <div className="space-y-4">
              {birthdays.map((birthday) => {
                const message = getBirthdayMessage(birthday.nome);
                return (
                <div key={birthday.id} className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                        <p className="font-bold text-sm">{birthday.nome}</p>
                        {birthday.telefone && (
                          <p className="text-xs text-muted-foreground">{birthday.telefone}</p>
                        )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Mensagem Padrão:</Label>
                    <Textarea
                        value={message}
                      readOnly
                      className="text-xs h-20"
                    />
                      {birthday.telefone && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(message);
                              toast.success('Mensagem copiada!');
                            }}
                        className="flex-1"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Copiar Msg
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                            <a href={whatsappLink(birthday.telefone, message)} target="_blank" rel="noreferrer">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Enviar WA
                        </a>
                      </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum aniversariante hoje</p>
          )}
        </CardContent>
      </Card>

      {/* PÓS-VENDAS AGENDADAS */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens de Pós-Venda ({postSales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {postSales.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Data Venda</TableHead>
                    <TableHead className="text-xs">Follow-up</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postSales.map((ps) => (
                    <TableRow key={ps.id}>
                      <TableCell className="text-xs font-medium">{ps.cliente_nome}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(ps.sale_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(ps.scheduled_follow_up), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={ps.status === "AGENDADA" ? "default" : "secondary"} className="text-xs">
                          {ps.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Nenhuma pós-venda agendada</p>
              <p className="text-xs text-muted-foreground mt-2">Pós-vendas serão criadas automaticamente após registrar vendas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COMPROMISSOS DE CRM */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Compromissos de Hoje ({commitments.length})
            </CardTitle>
            <Dialog open={commitmentDialogOpen} onOpenChange={setCommitmentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Agendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agendar Compromisso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Input
                      placeholder="Nome do cliente"
                      value={newCommitment.cliente_nome}
                      onChange={(e) => setNewCommitment({ ...newCommitment, cliente_nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo de Compromisso</Label>
                    <Select value={newCommitment.type} onValueChange={(v) => setNewCommitment({ ...newCommitment, type: v as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AJUSTE">Ajuste de Peça</SelectItem>
                        <SelectItem value="FOLLOW_UP">Follow-up de Venda</SelectItem>
                        <SelectItem value="VENDA">Oportunidade de Venda</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data/Hora Agendada *</Label>
                    <Input
                      type="datetime-local"
                      value={newCommitment.scheduledDate}
                      onChange={(e) => setNewCommitment({ ...newCommitment, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Ex: Verificar se o ajuste saiu bem"
                      value={newCommitment.notes}
                      onChange={(e) => setNewCommitment({ ...newCommitment, notes: e.target.value })}
                      className="h-20"
                    />
                  </div>
                  <Button onClick={handleAddCommitment} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Agendar Compromisso
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {commitments.length > 0 ? (
            <div className="space-y-2">
              {commitments.map((comp) => {
                const urgency = getCommitmentUrgency(comp.scheduled_date);
                return (
                  <div 
                    key={comp.id} 
                    className={`flex items-start justify-between p-3 rounded-lg border ${
                      urgency.level === 'overdue' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                      urgency.level === 'urgent' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' :
                      urgency.level === 'soon' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' :
                      'bg-muted/50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{comp.cliente_nome}</p>
                        {urgency.label && (
                          <Badge variant={urgency.level === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                            {urgency.level === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {urgency.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {comp.type} • {format(parseISO(comp.scheduled_date), "dd/MM/yyyy HH:mm")}
                      </p>
                      {comp.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{comp.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum compromisso agendado para hoje</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição de Tarefa */}
      <Dialog open={taskEditDialogOpen} onOpenChange={setTaskEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskEditForm
              task={selectedTask}
              colaboradoras={colaboradoras}
              onSave={(updates) => handleUpdateTask(selectedTask.id, updates)}
              onClose={() => {
                setTaskEditDialogOpen(false);
                setSelectedTask(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente de Formulário de Edição de Tarefa
function TaskEditForm({ 
  task, 
  colaboradoras, 
  onSave, 
  onClose 
}: { 
  task: CRMTask; 
  colaboradoras: Array<{id: string; name: string}>;
  onSave: (updates: any) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"CONCLUÍDA" | "PENDENTE">(task.status as "CONCLUÍDA" | "PENDENTE");
  const [quemFez, setQuemFez] = useState<string>(task.quem_fez || "");
  const [comoContato, setComoContato] = useState<string>(task.como_foi_contato || "");
  const [clienteRespondeu, setClienteRespondeu] = useState<string>(
    task.cliente_respondeu === null ? "" : task.cliente_respondeu ? "sim" : "nao"
  );
  const [observacoes, setObservacoes] = useState<string>(task.observacoes_contato || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const updates: any = {
        status,
        quem_fez: quemFez || null,
        como_foi_contato: comoContato || null,
        cliente_respondeu: clienteRespondeu === "" ? null : clienteRespondeu === "sim",
        observacoes_contato: observacoes.trim() || null
      };

      onSave(updates);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* Status: Feita / Não Feita */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as "CONCLUÍDA" | "PENDENTE")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDENTE">Não Feita</SelectItem>
            <SelectItem value="CONCLUÍDA">Feita</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quem Fez */}
      <div className="space-y-2">
        <Label>Quem Fez</Label>
        <Select value={quemFez} onValueChange={setQuemFez}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione quem fez" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não definido</SelectItem>
            {colaboradoras.map((colab) => (
              <SelectItem key={colab.id} value={colab.id}>
                {colab.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Como Foi o Contato */}
      <div className="space-y-2">
        <Label>Como Foi o Contato</Label>
        <Select value={comoContato} onValueChange={setComoContato}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo de contato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não definido</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="TELEFONE">Telefone</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="PRESENCIAL">Presencial</SelectItem>
            <SelectItem value="OUTRO">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cliente Respondeu */}
      <div className="space-y-2">
        <Label>Cliente Respondeu?</Label>
        <Select value={clienteRespondeu} onValueChange={setClienteRespondeu}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não contatado ainda</SelectItem>
            <SelectItem value="sim">Sim</SelectItem>
            <SelectItem value="nao">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Observações do Contato */}
      <div className="space-y-2">
        <Label>Observações do Contato</Label>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações sobre o contato realizado..."
          rows={4}
        />
      </div>

      {/* Informações da Tarefa (somente leitura) */}
      <div className="space-y-2">
        <Label>Informações da Tarefa</Label>
        <div className="p-3 bg-muted rounded-md text-sm space-y-1">
          <p><strong>Cliente:</strong> {task.cliente_nome}</p>
          <p><strong>Data/Hora:</strong> {format(parseISO(task.due_date), "dd/MM/yyyy HH:mm")}</p>
          {task.cliente_whatsapp && (
            <p><strong>WhatsApp:</strong> {task.cliente_whatsapp}</p>
          )}
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
