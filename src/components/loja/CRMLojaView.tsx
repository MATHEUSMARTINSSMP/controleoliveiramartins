import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, Calendar, Gift, Phone, Clock } from "lucide-react";
import { format } from "date-fns";

interface CRMTask {
  id: string;
  title: string;
  cliente: string;
  dueDate: string;
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  status: "PENDENTE" | "CONCLUÍDA";
}

interface Birthday {
  id: string;
  cliente: string;
  phone: string;
  defaultMessage: string;
}

interface PostSale {
  id: string;
  cliente: string;
  saleDate: string;
  scheduledFollowUp: string;
  details: string;
  status: "AGENDADA" | "CONCLUÍDA";
}

interface CRMCommitment {
  id: string;
  cliente: string;
  type: "AJUSTE" | "FOLLOW_UP" | "VENDA" | "OUTRO";
  scheduledDate: string;
  notes: string;
}

export default function CRMLojaView() {
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [postSales, setPostSales] = useState<PostSale[]>([]);
  const [commitments, setCommitments] = useState<CRMCommitment[]>([]);

  const [newTask, setNewTask] = useState({ title: "", cliente: "", dueDate: "", priority: "MÉDIA" });
  const [newCommitment, setNewCommitment] = useState({ cliente: "", type: "FOLLOW_UP", scheduledDate: "", notes: "" });

  const handleAddTask = () => {
    if (!newTask.title || !newTask.cliente) return;
    setTasks([...tasks, { id: Date.now().toString(), ...newTask, status: "PENDENTE" }]);
    setNewTask({ title: "", cliente: "", dueDate: "", priority: "MÉDIA" });
  };

  const handleAddCommitment = () => {
    if (!newCommitment.cliente) return;
    setCommitments([...commitments, { id: Date.now().toString(), ...newCommitment }]);
    setNewCommitment({ cliente: "", type: "FOLLOW_UP", scheduledDate: "", notes: "" });
  };

  const whatsappLink = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encoded}`;
  };

  const pendingTasks = tasks.filter(t => t.status === "PENDENTE");

  return (
    <div className="space-y-6">
      {/* TAREFAS DO DIA */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tarefas do Dia
            </CardTitle>
            <Dialog>
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
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Ex: Ligar para Maria Silva"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cliente/Colaboradora</Label>
                    <Input
                      placeholder="Nome"
                      value={newTask.cliente}
                      onChange={(e) => setNewTask({ ...newTask, cliente: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data/Hora</Label>
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
                  <Button onClick={handleAddTask} className="w-full">Adicionar Tarefa</Button>
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
                    <p className="text-xs text-muted-foreground">{task.cliente} • {task.dueDate || "Sem data"}</p>
                  </div>
                  <Badge variant={task.priority === "ALTA" ? "destructive" : task.priority === "MÉDIA" ? "default" : "secondary"}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhuma tarefa pendente</p>
          )}
        </CardContent>
      </Card>

      {/* ANIVERSARIANTES DO DIA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Aniversariantes Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {birthdays.length > 0 ? (
            <div className="space-y-4">
              {birthdays.map((birthday) => (
                <div key={birthday.id} className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-sm">{birthday.cliente}</p>
                      <p className="text-xs text-muted-foreground">{birthday.phone}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Mensagem Padrão:</Label>
                    <Textarea
                      value={birthday.defaultMessage}
                      readOnly
                      className="text-xs h-20"
                      placeholder="Feliz Aniversário! Aproveite nosso cupom HAPPY20 com 20% OFF em sua próxima compra!"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(birthday.defaultMessage)}
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
                        <a href={whatsappLink(birthday.phone, `Oi ${birthday.cliente.split(" ")[0]}! ${birthday.defaultMessage}`)} target="_blank" rel="noreferrer">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Enviar WA
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum aniversariante hoje</p>
          )}
        </CardContent>
      </Card>

      {/* PÓS-VENDAS AGENDADAS */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens de Pós-Venda</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            ⚠️ <strong>IMPORTANTE:</strong> Precisamos criar no banco de dados: data_contato, dados_cliente, observacoes_pos_venda
          </p>
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
                      <TableCell className="text-xs font-medium">{ps.cliente}</TableCell>
                      <TableCell className="text-xs">{format(new Date(ps.saleDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">{format(new Date(ps.scheduledFollowUp), "dd/MM/yyyy")}</TableCell>
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
              Compromissos de CRM
            </CardTitle>
            <Dialog>
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
                    <Label>Buscar Cliente por:</Label>
                    <div className="flex gap-2 mt-2">
                      <Input placeholder="Nome" className="text-xs" />
                      <Input placeholder="CPF" className="text-xs" />
                      <Input placeholder="Data Venda" type="date" className="text-xs" />
                    </div>
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
                    <Label>Data/Hora Agendada</Label>
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
                  <Button onClick={handleAddCommitment} className="w-full">Agendar Compromisso</Button>
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
                    <p className="font-medium text-sm">{comp.cliente}</p>
                    <p className="text-xs text-muted-foreground">{comp.type} • {format(new Date(comp.scheduledDate), "dd/MM/yyyy HH:mm")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{comp.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum compromisso agendado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
