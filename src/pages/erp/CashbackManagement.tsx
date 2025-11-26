/**
 * Página de Gestão de Cashback
 * 
 * Gestão completa do programa de cashback com todas as funcionalidades
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  ArrowLeft, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Gift
} from 'lucide-react';
import { format, addDays, isAfter, isBefore, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import CashbackSettings from '@/components/erp/CashbackSettings';

interface CashbackTransaction {
  id: string;
  cliente_id: string | null;
  tiny_order_id: string | null;
  transaction_type: 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTMENT';
  amount: number;
  description: string | null;
  data_liberacao: string | null;
  data_expiracao: string | null;
  renovado: boolean;
  created_at: string;
  cliente?: { id: string; nome: string; cpf_cnpj: string | null; };
  tiny_order?: { id: string; numero_pedido: string | null; valor_total: number; };
}

interface CashbackBalance {
  id: string;
  cliente_id: string | null;
  balance: number;
  balance_disponivel: number;
  balance_pendente: number;
  total_earned: number;
  cliente?: { id: string; nome: string; cpf_cnpj: string | null; };
}

interface CashbackKPIs {
  total_cashback: number;
  disponivel: number;
  pendente: number;
  expirando: number;
  expirado: number;
  total_clientes: number;
}

export default function CashbackManagement() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [kpis, setKpis] = useState<CashbackKPIs>({
    total_cashback: 0, disponivel: 0, pendente: 0, expirando: 0, expirado: 0, total_clientes: 0,
  });
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [balances, setBalances] = useState<CashbackBalance[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [renovationDialog, setRenovationDialog] = useState<{open: boolean; transaction: CashbackTransaction | null}>({ open: false, transaction: null });
  const [renovating, setRenovating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'LOJA')) {
      navigate('/erp/login');
      return;
    }
    fetchStores();
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (selectedStore) fetchData();
  }, [selectedStore, activeTab]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase.schema('sistemaretiradas').from('stores').select('id, name').eq('active', true).order('name');
      if (error) throw error;
      setStores(data || []);
      if (data && data.length > 0) setSelectedStore(data[0].id);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let clienteIds: string[] | null = null;
      if (selectedStore !== 'all') {
        const { data: clientes } = await supabase.schema('sistemaretiradas').from('tiny_contacts').select('id').eq('store_id', selectedStore);
        clienteIds = clientes?.map(c => c.id) || [];
        if (clienteIds.length === 0) {
          setBalances([]); setTransactions([]); calculateKPIs([], []); setLoading(false); return;
        }
      }
      let balanceQuery = supabase.schema('sistemaretiradas').from('cashback_balance').select('*, cliente:cliente_id (id, nome, cpf_cnpj)').not('cliente_id', 'is', null);
      if (clienteIds) balanceQuery = balanceQuery.in('cliente_id', clienteIds);
      const { data: balancesData, error: balancesError } = await balanceQuery;
      if (balancesError) throw balancesError;
      setBalances(balancesData || []);
      let transactionQuery = supabase.schema('sistemaretiradas').from('cashback_transactions').select('*, cliente:cliente_id (id, nome, cpf_cnpj), tiny_order:tiny_order_id (id, numero_pedido, valor_total)').not('cliente_id', 'is', null).order('created_at', { ascending: false }).limit(1000);
      if (clienteIds) transactionQuery = transactionQuery.in('cliente_id', clienteIds);
      const { data: transactionsData, error: transactionsError } = await transactionQuery;
      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);
      calculateKPIs(balancesData || [], transactionsData || []);
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados de cashback');
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (balances: CashbackBalance[], transactions: CashbackTransaction[]) => {
    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);
    let total = 0, disponivel = 0, pendente = 0, expirando = 0, expirado = 0;
    balances.forEach(b => { total += Number(b.balance || 0); disponivel += Number(b.balance_disponivel || 0); pendente += Number(b.balance_pendente || 0); });
    transactions.forEach(t => {
      if (t.transaction_type === 'EARNED' && t.data_expiracao) {
        const expDate = new Date(t.data_expiracao);
        if (isBefore(expDate, now)) expirado += Number(t.amount || 0);
        else if (isBefore(expDate, sevenDaysFromNow)) expirando += Number(t.amount || 0);
      }
    });
    setKpis({ total_cashback: total, disponivel, pendente, expirando, expirado, total_clientes: balances.length });
  };

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => t.cliente?.nome?.toLowerCase().includes(term) || t.cliente?.cpf_cnpj?.includes(term) || t.tiny_order?.numero_pedido?.includes(term) || t.description?.toLowerCase().includes(term));
    }
    if (statusFilter !== 'all') {
      const now = new Date();
      const sevenDaysFromNow = addDays(now, 7);
      filtered = filtered.filter(t => {
        if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
        const expDate = new Date(t.data_expiracao);
        if (statusFilter === 'expirando') return isBefore(expDate, sevenDaysFromNow) && isAfter(expDate, now);
        else if (statusFilter === 'expirado') return isBefore(expDate, now);
        else if (statusFilter === 'disponivel') return t.data_liberacao && isBefore(new Date(t.data_liberacao), now) && isAfter(expDate, now);
        else if (statusFilter === 'pendente') return t.data_liberacao && isAfter(new Date(t.data_liberacao), now);
        return true;
      });
    }
    return filtered;
  }, [transactions, searchTerm, statusFilter]);

  const groupedByClient = useMemo(() => {
    const grouped = new Map<string, CashbackTransaction[]>();
    filteredTransactions.forEach(t => {
      if (t.cliente_id) {
        if (!grouped.has(t.cliente_id)) grouped.set(t.cliente_id, []);
        grouped.get(t.cliente_id)!.push(t);
      }
    });
    return Array.from(grouped.entries()).map(([clienteId, trans]) => ({
      clienteId, cliente: trans[0].cliente, transactions: trans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      total: trans.filter(t => t.transaction_type === 'EARNED').reduce((sum, t) => sum + Number(t.amount || 0), 0),
    }));
  }, [filteredTransactions]);

  const handleRenovar = async () => {
    if (!renovationDialog.transaction) return;
    try {
      setRenovating(true);
      const { data, error } = await supabase.schema('sistemaretiradas').rpc('renovar_cashback', { p_transaction_id: renovationDialog.transaction.id, p_cliente_id: renovationDialog.transaction.cliente_id });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erro ao renovar cashback');
      toast.success(data?.message || 'Cashback renovado com sucesso!');
      setRenovationDialog({ open: false, transaction: null });
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao renovar cashback:', error);
      toast.error(error.message || 'Erro ao renovar cashback');
    } finally {
      setRenovating(false);
    }
  };

  const toggleClientExpanded = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) newExpanded.delete(clienteId);
    else newExpanded.add(clienteId);
    setExpandedClients(newExpanded);
  };

  const getStatusBadge = (transaction: CashbackTransaction) => {
    if (transaction.transaction_type !== 'EARNED' || !transaction.data_expiracao) {
      return <Badge variant="secondary">{transaction.transaction_type}</Badge>;
    }
    const now = new Date();
    const expDate = new Date(transaction.data_expiracao);
    const daysUntilExpiry = differenceInDays(expDate, now);
    if (isBefore(expDate, now)) return <Badge variant="destructive">Expirado</Badge>;
    else if (daysUntilExpiry <= 7) return <Badge variant="outline" className="border-orange-500 text-orange-700">Expira em {daysUntilExpiry} dias</Badge>;
    else if (transaction.data_liberacao && isBefore(new Date(transaction.data_liberacao), now)) return <Badge variant="default" className="bg-green-600">Disponível</Badge>;
    else return <Badge variant="secondary">Pendente</Badge>;
  };

  if (loading && transactions.length === 0) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/erp/dashboard')}><ArrowLeft className="h-4 w-4" /></Button>
          <div><h1 className="text-3xl font-bold flex items-center gap-2"><Gift className="h-8 w-8 text-primary" />Gestão de Cashback</h1><p className="text-muted-foreground">Gerencie o programa de cashback dos seus clientes</p></div>
        </div>
      </div>
      <Card><CardContent className="pt-6"><div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><label className="text-sm font-medium mb-2 block">Loja</label><Select value={selectedStore} onValueChange={setSelectedStore}><SelectTrigger><SelectValue placeholder="Todas as lojas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex-1 min-w-[200px]"><label className="text-sm font-medium mb-2 block">Buscar</label><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Cliente, CPF, pedido..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></div>
        <div className="flex-1 min-w-[200px]"><label className="text-sm font-medium mb-2 block">Status</label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="disponivel">Disponível</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="expirando">Expirando</SelectItem><SelectItem value="expirado">Expirado</SelectItem></SelectContent></Select></div>
      </div></CardContent></Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5"><TabsTrigger value="overview">Visão Geral</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger><TabsTrigger value="expiring">Expirando</TabsTrigger><TabsTrigger value="expired">Expirado</TabsTrigger><TabsTrigger value="settings">Configurações</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Cashback</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.total_cashback)}</div><p className="text-xs text-muted-foreground">{kpis.total_clientes} clientes com cashback</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Disponível</CardTitle><CheckCircle2 className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.disponivel)}</div><p className="text-xs text-muted-foreground">Pronto para uso</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pendente</CardTitle><Clock className="h-4 w-4 text-yellow-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(kpis.pendente)}</div><p className="text-xs text-muted-foreground">Aguardando liberação</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expirando</CardTitle><AlertTriangle className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.expirando)}</div><p className="text-xs text-muted-foreground">Expira nos próximos 7 dias</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expirado</CardTitle><AlertTriangle className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(kpis.expirado)}</div><p className="text-xs text-muted-foreground">Não pode mais ser usado</p></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Clientes com Cashback</CardTitle><CardDescription>Clique para expandir e ver o histórico completo</CardDescription></CardHeader><CardContent>
            {groupedByClient.length === 0 ? <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div> : <div className="space-y-2">
              {groupedByClient.map(({ clienteId, cliente, transactions, total }) => (
                <Collapsible key={clienteId} open={expandedClients.has(clienteId)} onOpenChange={() => toggleClientExpanded(clienteId)}>
                  <CollapsibleTrigger asChild><div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-3">{expandedClients.has(clienteId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<div><div className="font-medium">{cliente?.nome || 'Cliente Desconhecido'}</div><div className="text-sm text-muted-foreground">{cliente?.cpf_cnpj || 'Sem CPF/CNPJ'} • {transactions.length} transações</div></div></div>
                    <div className="text-right"><div className="font-bold">{formatCurrency(total)}</div><div className="text-xs text-muted-foreground">Total acumulado</div></div>
                  </div></CollapsibleTrigger>
                  <CollapsibleContent><div className="mt-2 border-t pt-4"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Pedido</TableHead><TableHead>Status</TableHead><TableHead>Expira em</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
                    {transactions.map((t) => (<TableRow key={t.id}><TableCell className="text-xs">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell><TableCell><Badge variant="outline">{t.transaction_type}</Badge></TableCell><TableCell className="font-medium">{formatCurrency(Number(t.amount || 0))}</TableCell><TableCell className="text-xs">{t.tiny_order?.numero_pedido || '-'}</TableCell><TableCell>{getStatusBadge(t)}</TableCell><TableCell className="text-xs">{t.data_expiracao ? format(new Date(t.data_expiracao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</TableCell><TableCell>{t.transaction_type === 'EARNED' && t.data_expiracao && (isBefore(new Date(t.data_expiracao), addDays(new Date(), 7)) || isBefore(new Date(t.data_expiracao), new Date())) && <Button variant="outline" size="sm" onClick={() => setRenovationDialog({ open: true, transaction: t })}><RefreshCw className="h-3 w-3 mr-1" />Renovar</Button>}</TableCell></TableRow>))}
                  </TableBody></Table></div></CollapsibleContent>
                </Collapsible>
              ))}
            </div>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="history"><Card><CardHeader><CardTitle>Histórico Completo</CardTitle><CardDescription>Todas as transações de cashback</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Pedido</TableHead><TableHead>Status</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader><TableBody>
          {filteredTransactions.map((t) => (<TableRow key={t.id}><TableCell className="text-xs">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell><TableCell><div><div className="font-medium">{t.cliente?.nome || '-'}</div><div className="text-xs text-muted-foreground">{t.cliente?.cpf_cnpj || ''}</div></div></TableCell><TableCell><Badge variant="outline">{t.transaction_type}</Badge></TableCell><TableCell className="font-medium">{formatCurrency(Number(t.amount || 0))}</TableCell><TableCell className="text-xs">{t.tiny_order?.numero_pedido || '-'}</TableCell><TableCell>{getStatusBadge(t)}</TableCell><TableCell className="text-xs max-w-[200px] truncate">{t.description || '-'}</TableCell></TableRow>))}
        </TableBody></Table></CardContent></Card></TabsContent>
        <TabsContent value="expiring"><Card><CardHeader><CardTitle>Cashback Expirando</CardTitle><CardDescription>Cashback que expira nos próximos 7 dias</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Expira em</TableHead><TableHead>Pedido</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
          {filteredTransactions.filter(t => { if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false; const expDate = new Date(t.data_expiracao); const now = new Date(); const sevenDaysFromNow = addDays(now, 7); return isBefore(expDate, sevenDaysFromNow) && isAfter(expDate, now); }).map((t) => { const daysUntilExpiry = differenceInDays(new Date(t.data_expiracao!), new Date()); return (<TableRow key={t.id}><TableCell><div><div className="font-medium">{t.cliente?.nome || '-'}</div><div className="text-xs text-muted-foreground">{t.cliente?.cpf_cnpj || ''}</div></div></TableCell><TableCell className="font-medium">{formatCurrency(Number(t.amount || 0))}</TableCell><TableCell><Badge variant="outline" className="border-orange-500 text-orange-700">{daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}</Badge></TableCell><TableCell className="text-xs">{t.tiny_order?.numero_pedido || '-'}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => setRenovationDialog({ open: true, transaction: t })}><RefreshCw className="h-3 w-3 mr-1" />Renovar</Button><Button variant="ghost" size="sm" disabled className="ml-2" title="Em breve: Enviar mensagem ao cliente"><MessageSquare className="h-3 w-3" /></Button></TableCell></TableRow>); })}
        </TableBody></Table></CardContent></Card></TabsContent>
        <TabsContent value="expired"><Card><CardHeader><CardTitle>Cashback Expirado</CardTitle><CardDescription>Cashback que já expirou (pode ser renovado)</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Expirou em</TableHead><TableHead>Pedido</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
          {filteredTransactions.filter(t => { if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false; return isBefore(new Date(t.data_expiracao), new Date()); }).map((t) => (<TableRow key={t.id}><TableCell><div><div className="font-medium">{t.cliente?.nome || '-'}</div><div className="text-xs text-muted-foreground">{t.cliente?.cpf_cnpj || ''}</div></div></TableCell><TableCell className="font-medium">{formatCurrency(Number(t.amount || 0))}</TableCell><TableCell><Badge variant="destructive">{format(new Date(t.data_expiracao!), 'dd/MM/yyyy', { locale: ptBR })}</Badge></TableCell><TableCell className="text-xs">{t.tiny_order?.numero_pedido || '-'}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => setRenovationDialog({ open: true, transaction: t })}><RefreshCw className="h-3 w-3 mr-1" />Renovar</Button></TableCell></TableRow>))}
        </TableBody></Table></CardContent></Card></TabsContent>
        <TabsContent value="settings"><CashbackSettings storeId={selectedStore !== 'all' ? selectedStore : undefined} /></TabsContent>
      </Tabs>
      <AlertDialog open={renovationDialog.open} onOpenChange={(open) => setRenovationDialog({ open, transaction: null })}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Renovar Cashback</AlertDialogTitle><AlertDialogDescription>Deseja renovar o cashback de <strong>{renovationDialog.transaction?.cliente?.nome}</strong> no valor de <strong>{formatCurrency(Number(renovationDialog.transaction?.amount || 0))}</strong>?<br /><br />O prazo de expiração será estendido conforme as configurações do sistema.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRenovar} disabled={renovating}>{renovating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Renovando...</> : 'Renovar'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
