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
import { MessageSquare, Plus, Calendar, Gift, Phone, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { format, startOfDay, endOfDay, isToday, parseISO } from "date-fns";
import { toast } from "sonner";

interface CRMTask {
  id: string;
  title: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  due_date: string;
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  status: "PENDENTE" | "CONCLUÍDA" | "CANCELADA";
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
  const [saving, setSaving] = useState(false);

  const [newTask, setNewTask] = useState({ 
    title: "", 
    cliente_nome: "", 
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
    if (!storeId) return;

    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .select('*')
        .eq('store_id', storeId)
        .gte('due_date', todayStart)
        .lte('due_date', todayEnd)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar tarefas:', error);
      toast.error('Erro ao buscar tarefas');
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
    if (!newTask.title || !newTask.cliente_nome || !newTask.dueDate || !storeId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .insert([{
          store_id: storeId,
          colaboradora_id: profile?.id || null,
          cliente_nome: newTask.cliente_nome,
          title: newTask.title,
          due_date: newTask.dueDate,
          priority: newTask.priority,
          status: 'PENDENTE'
        }]);

      if (error) throw error;

      toast.success('Tarefa adicionada com sucesso!');
      setTaskDialogOpen(false);
      setNewTask({ title: "", cliente_nome: "", dueDate: "", priority: "MÉDIA" });
      fetchTasks();
    } catch (error: any) {
      console.error('Erro ao adicionar tarefa:', error);
      toast.error('Erro ao adicionar tarefa');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .update({ 
          status: 'CONCLUÍDA',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Tarefa concluída!');
      fetchTasks();
    } catch (error: any) {
      console.error('Erro ao concluir tarefa:', error);
      toast.error('Erro ao concluir tarefa');
    }
  };

  const handleAddCommitment = async () => {
    if (!newCommitment.cliente_nome || !newCommitment.scheduledDate || !storeId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_commitments')
        .insert([{
          store_id: storeId,
          colaboradora_id: profile?.id || null,
          cliente_nome: newCommitment.cliente_nome,
          type: newCommitment.type,
          scheduled_date: newCommitment.scheduledDate,
          notes: newCommitment.notes || null,
          status: 'AGENDADO'
        }]);

      if (error) throw error;

      toast.success('Compromisso agendado com sucesso!');
      setCommitmentDialogOpen(false);
      setNewCommitment({ cliente_nome: "", type: "FOLLOW_UP", scheduledDate: "", notes: "" });
      fetchCommitments();
    } catch (error: any) {
      console.error('Erro ao agendar compromisso:', error);
      toast.error('Erro ao agendar compromisso');
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
                  <div>
                    <Label>Descrição *</Label>
                    <Input
                      placeholder="Ex: Ligar para Maria Silva"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cliente/Colaboradora *</Label>
                    <Input
                      placeholder="Nome"
                      value={newTask.cliente_nome}
                      onChange={(e) => setNewTask({ ...newTask, cliente_nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data/Hora *</Label>
                    <Input
                      type="datetime-local"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    />
                  </div>
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
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.cliente_nome} • {format(parseISO(task.due_date), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Badge variant={task.priority === "ALTA" ? "destructive" : task.priority === "MÉDIA" ? "default" : "secondary"}>
                    {task.priority}
                  </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCompleteTask(task.id)}
                      className="h-8 w-8 p-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhuma tarefa pendente hoje</p>
          )}
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
              {commitments.map((comp) => (
                <div key={comp.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{comp.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {comp.type} • {format(parseISO(comp.scheduled_date), "dd/MM/yyyy HH:mm")}
                    </p>
                    {comp.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{comp.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum compromisso agendado para hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
