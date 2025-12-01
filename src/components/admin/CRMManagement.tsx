import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Trash2, Edit, Loader2, Phone, Mail, Calendar, Clock, Gift, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CRMTask {
  id: string;
  title: string;
  cliente: string;
  dueDate: string;
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  status: "PENDENTE" | "CONCLUÍDA";
  storeName?: string;
}

interface Birthday {
  id: string;
  cliente: string;
  phone: string;
  defaultMessage: string;
  storeName?: string;
}

interface PostSale {
  id: string;
  cliente: string;
  saleDate: string;
  scheduledFollowUp: string;
  details: string;
  status: "AGENDADA" | "CONCLUÍDA";
  storeName?: string;
}

interface CRMCommitment {
  id: string;
  cliente: string;
  type: "AJUSTE" | "FOLLOW_UP" | "VENDA" | "OUTRO";
  scheduledDate: string;
  notes: string;
  storeName?: string;
}

interface CRMContact {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  observacoes?: string;
  store_id?: string;
}

interface Store {
  id: string;
  name: string;
}

export const CRMManagement = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [postSales, setPostSales] = useState<PostSale[]>([]);
  const [commitments, setCommitments] = useState<CRMCommitment[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'birthdays' | 'postsales' | 'commitments' | 'contacts'>('tasks');

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    observacoes: '',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    cliente: '',
    dueDate: '',
    priority: 'MÉDIA' as "ALTA" | "MÉDIA" | "BAIXA",
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Buscar lojas
      const { data: storesData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (storesData) setStores(storesData);

      // Buscar contatos
      try {
        const { data: contactsData } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .select('*')
          .order('nome');

        if (contactsData) setContacts(contactsData);
      } catch (e) {
        console.log('Tabela crm_contacts não existe ainda');
      }

      // Simular dados de tarefas, aniversariantes, etc. (virão do banco depois)
      setTasks(generateSampleTasks());
      setBirthdays(generateSampleBirthdays());
      setPostSales(generateSamplePostSales());
      setCommitments(generateSampleCommitments());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados CRM');
    } finally {
      setLoading(false);
    }
  };

  const generateSampleTasks = (): CRMTask[] => [
    {
      id: '1',
      title: 'Ligar para João Silva',
      cliente: 'João Silva',
      dueDate: format(new Date(), 'HH:mm'),
      priority: 'ALTA',
      status: 'PENDENTE',
      storeName: 'Loja Principal',
    },
  ];

  const generateSampleBirthdays = (): Birthday[] => [
    {
      id: '1',
      cliente: 'Maria Santos',
      phone: '11999999999',
      defaultMessage: 'Feliz Aniversário! Aproveite nosso cupom HAPPY20 com 20% OFF',
      storeName: 'Loja Centro',
    },
  ];

  const generateSamplePostSales = (): PostSale[] => [];

  const generateSampleCommitments = (): CRMCommitment[] => [];

  const handleSaveContact = async () => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        setContacts(prev =>
          prev.map(c => c.id === editingId ? { ...c, ...formData } : c)
        );

        toast.success('Contato atualizado!');
      } else {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .insert([formData])
          .select();

        if (error) throw error;

        if (data) setContacts(prev => [...prev, ...data]);

        toast.success('Contato criado!');
      }

      setContactDialogOpen(false);
      resetContactForm();
    } catch (error: any) {
      console.error('Erro ao salvar contato:', error);
      toast.error('Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Deletar este contato?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contato deletado!');
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao deletar contato');
    }
  };

  const handleEditContact = (contact: CRMContact) => {
    setFormData({
      nome: contact.nome,
      email: contact.email || '',
      telefone: contact.telefone || '',
      data_nascimento: contact.data_nascimento || '',
      observacoes: contact.observacoes || '',
    });
    setEditingId(contact.id);
    setContactDialogOpen(true);
  };

  const resetContactForm = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      data_nascimento: '',
      observacoes: '',
    });
    setEditingId(null);
  };

  const whatsappLink = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encoded}`;
  };

  const filteredTasks = tasks.filter(t =>
    (selectedStore === 'all' || t.storeName?.includes(selectedStore)) &&
    (t.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredBirthdays = birthdays.filter(b =>
    (selectedStore === 'all' || b.storeName?.includes(selectedStore)) &&
    b.cliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone?.includes(searchTerm)
  );

  const pendingTasks = filteredTasks.filter(t => t.status === 'PENDENTE');

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filtros */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                Gestão CRM Global
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Controle todos os dados de CRM de todas as lojas
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
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
        <CardContent>
          <Input
            placeholder="Buscar por nome, cliente ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {(['tasks', 'birthdays', 'postsales', 'commitments', 'contacts'] as const).map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab)}
            className="text-xs sm:text-sm"
          >
            {tab === 'tasks' && <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
            {tab === 'birthdays' && <Gift className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
            {tab === 'postsales' && <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
            {tab === 'commitments' && <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
            {tab === 'contacts' && <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
            <span className="hidden sm:inline">
              {tab === 'tasks' && 'Tarefas'}
              {tab === 'birthdays' && 'Aniversariantes'}
              {tab === 'postsales' && 'Pós-Vendas'}
              {tab === 'commitments' && 'Compromissos'}
              {tab === 'contacts' && 'Contatos'}
            </span>
            <span className="sm:hidden">
              {tab === 'tasks' && 'Tarefas'}
              {tab === 'birthdays' && 'Aniver.'}
              {tab === 'postsales' && 'Pós-V.'}
              {tab === 'commitments' && 'Comp.'}
              {tab === 'contacts' && 'Contatos'}
            </span>
          </Button>
        ))}
      </div>

      {/* TAREFAS */}
      {activeTab === 'tasks' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tarefas do CRM ({pendingTasks.length} pendentes)
              </CardTitle>
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-accent">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Nova Tarefa</span>
                    <span className="sm:hidden">Nova</span>
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
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Cliente/Colaboradora</Label>
                      <Input
                        placeholder="Nome"
                        value={taskForm.cliente}
                        onChange={(e) => setTaskForm({ ...taskForm, cliente: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Data/Hora</Label>
                      <Input
                        type="datetime-local"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as any })}>
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
                    <Button onClick={() => toast.info('Tarefa seria adicionada')} className="w-full">Adicionar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.cliente} • {task.storeName} • {task.dueDate}</p>
                    </div>
                    <Badge variant={task.priority === 'ALTA' ? 'destructive' : task.priority === 'MÉDIA' ? 'default' : 'secondary'}>
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ANIVERSARIANTES */}
      {activeTab === 'birthdays' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Aniversariantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredBirthdays.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhum aniversariante</p>
            ) : (
              <div className="space-y-4">
                {filteredBirthdays.map(b => (
                  <div key={b.id} className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 rounded-lg border">
                    <div className="flex justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm">{b.cliente}</p>
                        <p className="text-xs text-muted-foreground">{b.storeName}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={whatsappLink(b.phone, `Oi ${b.cliente.split(' ')[0]}! ${b.defaultMessage}`)} target="_blank" rel="noreferrer">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          WA
                        </a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{b.defaultMessage}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CONTATOS */}
      {activeTab === 'contacts' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Contatos CRM ({contacts.length} total)</CardTitle>
              <Dialog open={contactDialogOpen} onOpenChange={(open) => {
                setContactDialogOpen(open);
                if (!open) resetContactForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-accent">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Novo Contato</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Editar' : 'Novo'} Contato CRM</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        placeholder="Nome do cliente"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="cliente@email.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={formData.telefone || ''}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={formData.data_nascimento || ''}
                        onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Informações adicionais..."
                        value={formData.observacoes || ''}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        className="min-h-20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setContactDialogOpen(false)} variant="outline" className="flex-1">Cancelar</Button>
                      <Button onClick={handleSaveContact} disabled={saving} className="flex-1">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Salvar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhum contato</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Email</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Telefone</TableHead>
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => (
                      <TableRow key={contact.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs sm:text-sm font-medium">{contact.nome}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell text-muted-foreground truncate">{contact.email || '-'}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell text-muted-foreground">{contact.telefone || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditContact(contact)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteContact(contact.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PÓS-VENDAS e COMPROMISSOS (placeholders) */}
      {activeTab === 'postsales' && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            Pós-vendas será preenchida automaticamente após registrar vendas no sistema
          </CardContent>
        </Card>
      )}

      {activeTab === 'commitments' && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            Gerenciamento de compromissos (em desenvolvimento)
          </CardContent>
        </Card>
      )}
    </div>
  );
};
