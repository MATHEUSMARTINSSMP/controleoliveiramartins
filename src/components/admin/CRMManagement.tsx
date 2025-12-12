import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Trash2, Edit, Loader2, Phone, Mail, Calendar, Clock, Gift, CheckCircle2, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { normalizeCPF } from '@/lib/cpf';

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
  status: "AGENDADO" | "CONCLUÍDO" | "CANCELADO" | "FALTANDO";
  storeName?: string;
}

interface CRMContact {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  data_nascimento?: string;
  observacoes?: string;
  store_id?: string;
}

interface Store {
  id: string;
  name: string;
}

export const CRMManagement = () => {
  const { profile } = useAuth();
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
  
  // Filtros avançados
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'PENDENTE' | 'CONCLUÍDA'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'ALTA' | 'MÉDIA' | 'BAIXA'>('all');
  const [postSaleStatusFilter, setPostSaleStatusFilter] = useState<'all' | 'AGENDADA' | 'CONCLUÍDA' | 'CANCELADA'>('all');
  const [commitmentStatusFilter, setCommitmentStatusFilter] = useState<'all' | 'AGENDADO' | 'CONCLUÍDO' | 'CANCELADO' | 'FALTANDO'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStoreId, setImportStoreId] = useState<string>('');
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: Array<{ row: number; nome: string; error: string }>;
  } | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    observacoes: '',
    store_id: '',
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

  useEffect(() => {
    // Recarregar dados quando o filtro de loja mudar
    console.log('📋 [CRMManagement] useEffect - selectedStore mudou para:', selectedStore);
    if (!loading) {
      fetchAllData();
    }
  }, [selectedStore]);
  
  useEffect(() => {
    // Recarregar dados quando profile mudar
    console.log('📋 [CRMManagement] useEffect - profile mudou:', profile?.id);
    if (profile && !loading) {
      fetchAllData();
    }
  }, [profile]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      console.log('📋 [CRMManagement] fetchAllData iniciado');
      console.log('📋 [CRMManagement] profile.id (admin_id):', profile?.id);
      console.log('📋 [CRMManagement] selectedStore:', selectedStore);

      // Buscar lojas FILTRADAS PELO ADMIN_ID
      const { data: storesData, error: storesError } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, admin_id')
        .eq('active', true);
      
      console.log('📋 [CRMManagement] Todas as lojas encontradas:', storesData?.length || 0);
      
      // FILTRO CRÍTICO: apenas lojas do admin logado
      const adminStores = storesData?.filter(store => store.admin_id === profile?.id) || [];
      
      console.log('📋 [CRMManagement] Lojas do admin:', adminStores.length);
      console.log('📋 [CRMManagement] IDs das lojas do admin:', adminStores.map(s => s.id));
      
      if (adminStores) setStores(adminStores.map(s => ({ id: s.id, name: s.name })));

      // Buscar contatos da tabela 'contacts' (PRIORIDADE) ou 'crm_contacts' (FALLBACK)
      try {
        let contactsData: any[] = [];
        
        // Tentar tabela 'contacts' primeiro
        console.log('📋 [CRMManagement] Buscando contatos da tabela contacts...');
        const { data: contactsDataPrimary, error: contactsErrorPrimary } = await supabase
          .schema('sistemaretiradas')
          .from('contacts')
          .select('*, stores(name, admin_id)')
          .order('nome', { ascending: true });
        
        console.log('📋 [CRMManagement] Resultado contacts:', {
          encontrados: contactsDataPrimary?.length || 0,
          error: contactsErrorPrimary?.code,
          message: contactsErrorPrimary?.message
        });
        
        if (contactsErrorPrimary && contactsErrorPrimary.code === '42P01') {
          // Tabela contacts não existe, tentar crm_contacts
          console.log('📋 [CRMManagement] Tabela contacts não existe, tentando crm_contacts...');
          const { data: contactsDataFallback, error: contactsErrorFallback } = await supabase
            .schema('sistemaretiradas')
            .from('crm_contacts')
            .select('*, stores(name, admin_id)')
            .order('nome', { ascending: true });
          
          console.log('📋 [CRMManagement] Resultado crm_contacts:', {
            encontrados: contactsDataFallback?.length || 0,
            error: contactsErrorFallback?.code
          });
          
          if (!contactsErrorFallback && contactsDataFallback) {
            contactsData = contactsDataFallback;
          }
        } else if (!contactsErrorPrimary && contactsDataPrimary) {
          contactsData = contactsDataPrimary;
        }
        
        // FILTRO CRÍTICO 1: Apenas contatos de lojas do admin logado
        const adminStoreIds = new Set(adminStores.map(s => s.id));
        contactsData = contactsData.filter((c: any) => {
          const contactStoreId = c.store_id;
          const isAdminStore = contactStoreId && adminStoreIds.has(contactStoreId);
          
          // Verificar também se o store.admin_id está correto
          const storeAdminId = c.stores?.admin_id;
          const isCorrectAdmin = storeAdminId === profile?.id;
          
          return isAdminStore || isCorrectAdmin;
        });
        
        console.log('📋 [CRMManagement] Contatos após filtro de admin:', contactsData.length);
        
        // FILTRO CRÍTICO 2: Aplicar filtro de loja se selecionado
        if (selectedStore !== 'all') {
          const beforeFilter = contactsData.length;
          contactsData = contactsData.filter((c: any) => c.store_id === selectedStore);
          console.log('📋 [CRMManagement] Contatos após filtro de loja:', {
            antes: beforeFilter,
            depois: contactsData.length,
            loja_selecionada: selectedStore
          });
        }

        if (contactsData.length > 0) {
          setContacts(contactsData.map((c: any) => ({
            id: c.id,
            nome: c.nome,
            email: c.email || undefined,
            telefone: c.telefone || undefined,
            cpf: c.cpf || undefined,
            data_nascimento: c.data_nascimento || undefined,
            observacoes: c.observacoes || undefined,
            store_id: c.store_id,
            storeName: c.stores?.name
          })));
          
          console.log('📋 [CRMManagement] Contatos setados no state:', contactsData.length);
        } else {
          console.log('📋 [CRMManagement] Nenhum contato encontrado após filtros');
          setContacts([]);
        }
      } catch (e) {
        console.error('📋 [CRMManagement] Erro ao buscar contatos:', e);
        console.log('Tabela contacts/crm_contacts não existe ainda ou erro ao buscar');
      }

      // Buscar tarefas
      await fetchTasks();

      // Buscar aniversariantes
      await fetchBirthdays();

      // Buscar pós-vendas
      await fetchPostSales();

      // Buscar compromissos
      await fetchCommitments();
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados CRM');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const query = supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .select('*, stores(name)')
        .order('due_date', { ascending: true });

      // Aplicar filtro de loja se selecionado
      if (selectedStore !== 'all') {
        query.eq('store_id', selectedStore);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setTasks(data.map((t: any) => ({
          id: t.id,
          title: t.title,
          cliente: t.cliente_nome || 'Cliente não identificado',
          dueDate: t.due_date ? format(new Date(t.due_date), 'HH:mm') : '',
          priority: t.priority || 'MÉDIA',
          status: t.status || 'PENDENTE',
          storeName: t.stores?.name
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar tarefas:', error);
    }
  };

  const fetchBirthdays = async () => {
    try {
      // Buscar aniversariantes de hoje de crm_contacts
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const diaAtual = hoje.getDate();

      const birthdaysList: Birthday[] = [];

      // Buscar de crm_contacts
      try {
        const query = supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .select('*, stores(name)')
          .not('data_nascimento', 'is', null);

        // Aplicar filtro de loja se selecionado
        if (selectedStore !== 'all') {
          query.eq('store_id', selectedStore);
        }

        const { data, error } = await query;

        if (!error && data) {
          // Filtrar aniversariantes de hoje
          const aniversariantesHoje = data.filter((contact: any) => {
            if (!contact.data_nascimento) return false;
            const dataNasc = new Date(contact.data_nascimento);
            return dataNasc.getMonth() + 1 === mesAtual && dataNasc.getDate() === diaAtual;
          });

          birthdaysList.push(...aniversariantesHoje.map((b: any) => ({
            id: b.id,
            cliente: b.nome,
            phone: b.telefone || '',
            defaultMessage: `Feliz Aniversário, ${b.nome.split(' ')[0]}! 🎉 Aproveite nosso cupom especial HAPPY20 com 20% OFF em sua próxima compra!`,
            storeName: b.stores?.name
          })));
        }
      } catch (e) {
        console.log('Erro ao buscar aniversariantes de crm_contacts:', e);
      }

      // Também buscar de tiny_contacts se disponível
      try {
        const query = supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('*, stores(name)')
          .not('data_nascimento', 'is', null);

        // Aplicar filtro de loja se selecionado
        if (selectedStore !== 'all') {
          query.eq('store_id', selectedStore);
        }

        const { data: tinyContacts, error: tinyError } = await query;

        if (!tinyError && tinyContacts) {
          const tinyBirthdays = tinyContacts.filter((contact: any) => {
            if (!contact.data_nascimento) return false;
            const dataNasc = new Date(contact.data_nascimento);
            return dataNasc.getMonth() + 1 === mesAtual && dataNasc.getDate() === diaAtual;
          });

          birthdaysList.push(...tinyBirthdays.map((b: any) => ({
            id: `tiny_${b.id}`,
            cliente: b.nome,
            phone: b.telefone || '',
            defaultMessage: `Feliz Aniversário, ${b.nome.split(' ')[0]}! 🎉 Aproveite nosso cupom especial HAPPY20 com 20% OFF em sua próxima compra!`,
            storeName: b.stores?.name
          })));
        }
      } catch (e) {
        // Tabela pode não existir ou não ter dados
        console.log('Não foi possível buscar aniversariantes de tiny_contacts');
      }

      setBirthdays(birthdaysList);
    } catch (error) {
      console.error('Erro ao buscar aniversariantes:', error);
    }
  };

  const fetchPostSales = async () => {
    try {
      const query = supabase
        .schema('sistemaretiradas')
        .from('crm_post_sales')
        .select('*, stores(name)')
        .order('scheduled_follow_up', { ascending: true });

      // Aplicar filtro de loja se selecionado
      if (selectedStore !== 'all') {
        query.eq('store_id', selectedStore);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setPostSales(data.map((ps: any) => ({
          id: ps.id,
          cliente: ps.cliente_nome || 'Cliente não identificado',
          saleDate: ps.sale_date,
          scheduledFollowUp: ps.scheduled_follow_up,
          details: ps.details || '',
          status: ps.status || 'AGENDADA',
          storeName: ps.stores?.name
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar pós-vendas:', error);
    }
  };

  const fetchCommitments = async () => {
    try {
      const query = supabase
        .schema('sistemaretiradas')
        .from('crm_commitments')
        .select('*, stores(name)')
        .order('scheduled_date', { ascending: true });

      // Aplicar filtro de loja se selecionado
      if (selectedStore !== 'all') {
        query.eq('store_id', selectedStore);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setCommitments(data.map((c: any) => ({
          id: c.id,
          cliente: c.cliente_nome || 'Cliente não identificado',
          type: c.type || 'OUTRO',
          scheduledDate: c.scheduled_date,
          notes: c.notes || '',
          status: c.status || 'AGENDADO',
          storeName: c.stores?.name
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar compromissos:', error);
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !taskForm.cliente) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);

      const taskData: any = {
        title: taskForm.title,
        cliente_nome: taskForm.cliente,
        due_date: taskForm.dueDate,
        priority: taskForm.priority,
        status: 'PENDENTE'
      };

      // Aplicar filtro de loja se selecionado
      if (selectedStore !== 'all') {
        taskData.store_id = selectedStore;
      }

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .insert([taskData]);

      if (error) throw error;

      toast.success('Tarefa adicionada!');
      setTaskDialogOpen(false);
      setTaskForm({ title: '', cliente: '', dueDate: '', priority: 'MÉDIA' });
      fetchTasks();
    } catch (error: any) {
      console.error('Erro ao salvar tarefa:', error);
      toast.error('Erro ao salvar tarefa');
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

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Deletar esta tarefa?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Tarefa deletada!');
      fetchTasks();
    } catch (error: any) {
      console.error('Erro ao deletar tarefa:', error);
      toast.error('Erro ao deletar tarefa');
    }
  };

  const handleSaveContact = async () => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.store_id) {
      toast.error('Selecione uma loja para vincular o contato');
      return;
    }

    try {
      setSaving(true);

      const contactData = {
        nome: formData.nome,
        email: formData.email || null,
        telefone: formData.telefone || null,
        cpf: formData.cpf ? normalizeCPF(formData.cpf) : null,
        data_nascimento: formData.data_nascimento || null,
        observacoes: formData.observacoes || null,
        store_id: formData.store_id,
      };

      if (editingId) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .update(contactData)
          .eq('id', editingId);

        if (error) throw error;

        setContacts(prev =>
          prev.map(c => c.id === editingId ? { ...c, ...contactData } : c)
        );

        toast.success('Contato atualizado!');
      } else {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .insert([contactData])
          .select();

        if (error) throw error;

        if (data) setContacts(prev => [...prev, ...data]);

        toast.success('Contato criado!');
      }

      setContactDialogOpen(false);
      resetContactForm();
    } catch (error: any) {
      console.error('Erro ao salvar contato:', error);
      toast.error(`Erro ao salvar contato: ${error.message || 'Erro desconhecido'}`);
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

  // Função para gerar arquivo modelo XLS
  const generateTemplateFile = () => {
    const templateData = [
      {
        'NOME': 'João Silva',
        'CPF': '12345678901',
        'CELULAR': '11999999999',
        'EMAIL': 'joao@email.com',
        'DATA_NASCIMENTO': '1990-01-15',
        'OBSERVACOES': 'Cliente preferencial'
      },
      {
        'NOME': 'Maria Santos',
        'CPF': '98765432100',
        'CELULAR': '11988888888',
        'EMAIL': 'maria@email.com',
        'DATA_NASCIMENTO': '1985-05-20',
        'OBSERVACOES': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 20 }, // NOME
      { wch: 15 }, // CPF
      { wch: 15 }, // CELULAR
      { wch: 25 }, // EMAIL
      { wch: 18 }, // DATA_NASCIMENTO
      { wch: 30 }  // OBSERVACOES
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx');
    toast.success('Arquivo modelo baixado com sucesso!');
  };

  // Função para normalizar telefone
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(/[^\d]/g, '');
  };

  // Função para normalizar nome (primeira letra de cada palavra maiúscula)
  const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .split(' ')
      .map(word => {
        // Ignorar palavras vazias ou muito pequenas (artigos, preposições)
        if (word.length <= 2) return word;
        // Primeira letra maiúscula
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .trim();
  };

  // Função para validar CPF
  const validateCPF = (cpf: string): boolean => {
    const normalized = normalizeCPF(cpf);
    if (normalized.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(normalized)) return false;
    
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(normalized.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(normalized.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(normalized.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(normalized.charAt(10))) return false;
    
    return true;
  };

  // Função para processar arquivo de importação
  const handleFileImport = async (file: File) => {
    if (!importStoreId) {
      toast.error('Selecione uma loja antes de importar');
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const errors: Array<{ row: number; nome: string; error: string }> = [];
      const successContacts: any[] = [];
      const cpfSet = new Set<string>(); // Para detectar duplicados no próprio arquivo

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2; // +2 porque começa na linha 2 (linha 1 é cabeçalho)

        const nomeRaw = String(row.NOME || row.nome || '').trim();
        const cpfRaw = String(row.CPF || row.cpf || '').trim();
        const celularRaw = String(row.CELULAR || row.celular || row.TELEFONE || row.telefone || '').trim();
        const email = String(row.EMAIL || row.email || '').trim();
        const dataNasc = String(row.DATA_NASCIMENTO || row.data_nascimento || '').trim();
        const observacoes = String(row.OBSERVACOES || row.observacoes || '').trim();

        // Validar campos obrigatórios
        if (!nomeRaw) {
          errors.push({ row: rowNum, nome: 'Sem nome', error: 'Campo NOME é obrigatório' });
          continue;
        }

        // Normalizar nome (primeira letra de cada palavra maiúscula)
        const nome = normalizeName(nomeRaw);

        if (!cpfRaw) {
          errors.push({ row: rowNum, nome, error: 'Campo CPF é obrigatório' });
          continue;
        }

        const cpfNormalized = normalizeCPF(cpfRaw);
        
        // Verificar se é CNPJ (14 dígitos) e pular
        if (cpfNormalized.length === 14) {
          errors.push({ row: rowNum, nome, error: 'CNPJ detectado (pulando - apenas CPF é aceito)' });
          continue;
        }
        
        if (cpfNormalized.length !== 11) {
          errors.push({ row: rowNum, nome, error: 'CPF inválido (deve ter 11 dígitos)' });
          continue;
        }

        if (!validateCPF(cpfNormalized)) {
          errors.push({ row: rowNum, nome, error: 'CPF inválido (dígitos verificadores incorretos)' });
          continue;
        }

        // Verificar duplicado no próprio arquivo (manter erro para arquivo)
        if (cpfSet.has(cpfNormalized)) {
          errors.push({ row: rowNum, nome, error: 'CPF duplicado no arquivo (será pulado)' });
          continue;
        }
        cpfSet.add(cpfNormalized);

        // CPF duplicado no banco não é mais erro - será atualizado via upsert

        if (!celularRaw) {
          errors.push({ row: rowNum, nome, error: 'Campo CELULAR é obrigatório' });
          continue;
        }

        const telefoneNormalized = normalizePhone(celularRaw);
        if (telefoneNormalized.length < 10 || telefoneNormalized.length > 11) {
          errors.push({ row: rowNum, nome, error: 'CELULAR inválido (deve ter 10 ou 11 dígitos)' });
          continue;
        }

        // Validar data de nascimento se fornecida (aceitar formato brasileiro DD/MM/YYYY)
        let dataNascimento = null;
        if (dataNasc && dataNasc.trim() !== '' && dataNasc.trim() !== '-') {
          const dataNascTrimmed = dataNasc.trim();
          
          // Tentar parsear formato brasileiro DD/MM/YYYY
          const dateMatch = dataNascTrimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (dateMatch) {
            const [, dia, mes, ano] = dateMatch;
            const diaNum = parseInt(dia, 10);
            const mesNum = parseInt(mes, 10);
            const anoNum = parseInt(ano, 10);
            
            // Validar valores básicos
            if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) {
              errors.push({ row: rowNum, nome, error: 'DATA_NASCIMENTO inválida (dia/mês inválido)' });
              continue;
            }
            
            // Validar ano (razoável: entre 1900 e ano atual)
            const anoAtual = new Date().getFullYear();
            if (anoNum < 1900 || anoNum > anoAtual) {
              errors.push({ row: rowNum, nome, error: 'DATA_NASCIMENTO inválida (ano inválido)' });
              continue;
            }
            
            // Criar data no formato ISO (YYYY-MM-DD)
            const dataISO = `${anoNum}-${mesNum.toString().padStart(2, '0')}-${diaNum.toString().padStart(2, '0')}`;
            
            // Validar se a data é válida criando um objeto Date e verificando se corresponde
            const date = new Date(dataISO + 'T12:00:00'); // Usar meio-dia para evitar problemas de timezone
            
            // Verificar se a data foi criada corretamente
            if (isNaN(date.getTime())) {
              errors.push({ row: rowNum, nome, error: 'DATA_NASCIMENTO inválida (data não existe)' });
              continue;
            }
            
            // Verificar se os valores correspondem (ex: 31/02/2000 vira 02/03/2000)
            if (date.getFullYear() !== anoNum || date.getMonth() + 1 !== mesNum || date.getDate() !== diaNum) {
              errors.push({ row: rowNum, nome, error: 'DATA_NASCIMENTO inválida (data não existe)' });
              continue;
            }
            
            dataNascimento = dataISO;
          } else {
            // Tentar parsear formato ISO YYYY-MM-DD como fallback
            const date = new Date(dataNascTrimmed);
            if (isNaN(date.getTime())) {
              // Se não conseguir parsear, não é erro crítico - apenas ignora a data
              // Mas avisa o usuário
              errors.push({ row: rowNum, nome, error: 'DATA_NASCIMENTO em formato inválido (será ignorada, formato esperado: DD/MM/YYYY)' });
              // Não fazemos continue aqui - apenas ignora a data e continua
            } else {
              dataNascimento = format(date, 'yyyy-MM-dd');
            }
          }
        }

        successContacts.push({
          nome: nome, // Nome normalizado
          cpf: cpfNormalized, // CPF normalizado (sem pontos e traços)
          telefone: telefoneNormalized,
          email: email || null,
          data_nascimento: dataNascimento,
          observacoes: observacoes || null,
          store_id: importStoreId,
        });
      }

      // Inserir ou atualizar contatos válidos em lote (upsert)
      // Se o CPF já existir, atualiza o registro; senão, insere novo
      if (successContacts.length > 0) {
        const { error: upsertError } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .upsert(successContacts, {
            onConflict: 'cpf', // Usa o índice único do CPF para detectar conflitos
            ignoreDuplicates: false // Atualiza ao invés de ignorar
          });

        if (upsertError) {
          throw upsertError;
        }
      }

      setImportResults({
        success: successContacts.length,
        errors,
      });

      if (successContacts.length > 0) {
        toast.success(`${successContacts.length} cliente(s) importado(s) com sucesso!`);
        // Recarregar contatos
        await fetchAllData();
      }

      if (errors.length > 0) {
        toast.warning(`${errors.length} erro(s) encontrado(s). Verifique o relatório.`);
      }
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error(`Erro ao importar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleEditContact = (contact: CRMContact) => {
    setFormData({
      nome: contact.nome,
      email: contact.email || '',
      telefone: contact.telefone || '',
      cpf: contact.cpf || '',
      data_nascimento: contact.data_nascimento || '',
      observacoes: contact.observacoes || '',
      store_id: contact.store_id || '',
    });
    setEditingId(contact.id);
    setContactDialogOpen(true);
  };

  const resetContactForm = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      data_nascimento: '',
      observacoes: '',
      store_id: selectedStore !== 'all' ? selectedStore : (stores.length > 0 ? stores[0].id : ''),
    });
    setEditingId(null);
  };

  const whatsappLink = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encoded}`;
  };

  const filteredTasks = tasks.filter(t => {
    // Filtro de loja
    if (selectedStore !== 'all' && t.storeName !== selectedStore) return false;
    
    // Filtro de busca
    const matchesSearch = !searchTerm || 
      t.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // Filtro de status
    if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
    
    // Filtro de prioridade
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    
    // Filtro de data (se aplicável)
    if (dateRangeFilter.start || dateRangeFilter.end) {
      const taskDate = new Date(t.dueDate);
      if (dateRangeFilter.start && taskDate < new Date(dateRangeFilter.start)) return false;
      if (dateRangeFilter.end && taskDate > new Date(dateRangeFilter.end)) return false;
    }
    
    return true;
  });

  const filteredBirthdays = birthdays.filter(b => {
    if (selectedStore !== 'all' && b.storeName !== selectedStore) return false;
    return !searchTerm || b.cliente.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredPostSales = postSales.filter(ps => {
    if (selectedStore !== 'all' && ps.storeName !== selectedStore) return false;
    if (!searchTerm || ps.cliente.toLowerCase().includes(searchTerm.toLowerCase())) {
      if (postSaleStatusFilter !== 'all' && ps.status !== postSaleStatusFilter) return false;
      return true;
    }
    return false;
  });

  const filteredCommitments = commitments.filter(c => {
    if (selectedStore !== 'all' && c.storeName !== selectedStore) return false;
    if (!searchTerm || c.cliente.toLowerCase().includes(searchTerm.toLowerCase())) {
      if (commitmentStatusFilter !== 'all' && c.status !== commitmentStatusFilter) return false;
      if (dateRangeFilter.start || dateRangeFilter.end) {
        const commitmentDate = new Date(c.scheduledDate);
        if (dateRangeFilter.start && commitmentDate < new Date(dateRangeFilter.start)) return false;
        if (dateRangeFilter.end && commitmentDate > new Date(dateRangeFilter.end)) return false;
      }
      return true;
    }
    return false;
  });

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
              <Select 
                value={selectedStore} 
                onValueChange={(value) => {
                  console.log('📋 [CRMManagement] Select de loja mudou para:', value);
                  setSelectedStore(value);
                }}
              >
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

      {/* Abas - Bem Visível */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="pt-4">
          <div className="flex gap-2 flex-wrap">
            {(['tasks', 'birthdays', 'postsales', 'commitments', 'contacts'] as const).map(tab => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
                className="text-xs sm:text-sm font-semibold shadow-sm"
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
        </CardContent>
      </Card>

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
                    <DialogDescription>
                      Crie uma nova tarefa para acompanhamento no CRM
                    </DialogDescription>
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
                    <Button onClick={handleSaveTask} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {tasks.length === 0 ? 'Nenhuma tarefa' : 'Nenhuma tarefa encontrada com os filtros aplicados'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map(task => (
                  <div key={task.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.cliente} • {task.storeName} • {task.dueDate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={task.priority === 'ALTA' ? 'destructive' : task.priority === 'MÉDIA' ? 'default' : 'secondary'}>
                        {task.priority}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteTask(task.id)}
                        className="h-7"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
              <p className="text-center text-muted-foreground py-4">
                {birthdays.length === 0 ? 'Nenhum aniversariante' : 'Nenhum aniversariante encontrado com os filtros aplicados'}
              </p>
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
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle>Contatos CRM ({contacts.length} total)</CardTitle>
              <div className="flex gap-2">
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Importar</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Importar Clientes</DialogTitle>
                      <DialogDescription>
                        Importe uma lista de clientes a partir de um arquivo Excel (.xlsx ou .xls)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Loja *</Label>
                        <Select value={importStoreId} onValueChange={setImportStoreId}>
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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={generateTemplateFile}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar Modelo
                        </Button>
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileImport(file);
                              }
                            }}
                            disabled={importing || !importStoreId}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                      {importing && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processando importação...
                        </div>
                      )}
                      {importResults && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">{importResults.success} cliente(s) importado(s) com sucesso</span>
                          </div>
                          {importResults.errors.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-4 w-4" />
                                <span className="font-medium">{importResults.errors.length} erro(s) encontrado(s):</span>
                              </div>
                              <div className="max-h-60 overflow-y-auto border rounded p-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-16">Linha</TableHead>
                                      <TableHead>Nome</TableHead>
                                      <TableHead>Erro</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {importResults.errors.map((error, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="font-mono text-xs">{error.row}</TableCell>
                                        <TableCell className="text-sm">{error.nome || '-'}</TableCell>
                                        <TableCell className="text-sm text-red-600">{error.error}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={contactDialogOpen} onOpenChange={(open) => {
                setContactDialogOpen(open);
                if (!open) {
                  resetContactForm();
                } else {
                  // Ao abrir, pré-selecionar loja baseada no filtro
                  const defaultStoreId = selectedStore !== 'all' ? selectedStore : (stores.length > 0 ? stores[0].id : '');
                  setFormData(prev => ({ ...prev, store_id: defaultStoreId }));
                }
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
                    <DialogDescription>
                      {editingId ? 'Atualize as informações do contato' : 'Adicione um novo contato ao CRM'}
                    </DialogDescription>
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
                      <Label>CPF</Label>
                      <Input
                        placeholder="000.000.000-00"
                        value={formData.cpf || ''}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
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
                      <Label>Loja *</Label>
                      {stores.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-2 border rounded">
                          Carregando lojas...
                        </div>
                      ) : (
                        <Select
                          value={formData.store_id}
                          onValueChange={(value) => setFormData({ ...formData, store_id: value })}
                        >
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
                      )}
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
                      <TableHead className="text-xs hidden lg:table-cell">Loja</TableHead>
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => (
                      <TableRow key={contact.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs sm:text-sm font-medium">{contact.nome}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell text-muted-foreground truncate">{contact.email || '-'}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell text-muted-foreground">{contact.telefone || '-'}</TableCell>
                        <TableCell className="text-xs hidden lg:table-cell text-muted-foreground">
                          <Badge variant="outline">{contact.storeName || 'N/A'}</Badge>
                        </TableCell>
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
      {/* PÓS-VENDAS */}
      {activeTab === 'postsales' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Pós-Vendas Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPostSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {postSales.length === 0 ? 'Nenhuma pós-venda registrada' : 'Nenhuma pós-venda encontrada com os filtros aplicados'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Loja</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Venda</TableHead>
                      <TableHead className="text-xs">Follow-up</TableHead>
                      <TableHead className="text-xs text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPostSales.map(ps => (
                      <TableRow key={ps.id}>
                        <TableCell className="text-xs font-medium">{ps.cliente}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">{ps.storeName}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell text-muted-foreground">{format(new Date(ps.saleDate), 'dd/MM')}</TableCell>
                        <TableCell className="text-xs">{format(new Date(ps.scheduledFollowUp), 'dd/MM')}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={ps.status === 'AGENDADA' ? 'default' : 'secondary'} className="text-xs">
                            {ps.status}
                          </Badge>
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

      {/* COMPROMISSOS */}
      {activeTab === 'commitments' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Compromissos de CRM
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCommitments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {commitments.length === 0 ? 'Nenhum compromisso agendado' : 'Nenhum compromisso encontrado com os filtros aplicados'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredCommitments.map(comp => (
                  <div key={comp.id} className="p-3 bg-muted/50 rounded-lg border flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{comp.cliente}</p>
                      <p className="text-xs text-muted-foreground">{comp.storeName} • {comp.type}</p>
                      <p className="text-xs mt-1">{comp.notes}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(comp.scheduledDate), 'dd/MM HH:mm')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
