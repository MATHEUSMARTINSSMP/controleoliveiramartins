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
  const [renovationDialog, setRenovationDialog] = useState<{ open: boolean; transaction: CashbackTransaction | null }>({ open: false, transaction: null });
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

      // ✅ Filtrar clientes por loja e IGNORAR SEM CPF/CNPJ
      let queryClientes = supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id')
        .not('cpf_cnpj', 'is', null) // Ignorar sem CPF
        .neq('cpf_cnpj', ''); // Ignorar CPF vazio

      if (selectedStore !== 'all') {
        queryClientes = queryClientes.eq('store_id', selectedStore);
      }

      const { data: clientes, error: clientesError } = await queryClientes;

      if (clientesError) throw clientesError;

      clienteIds = clientes?.map(c => c.id) || [];

      if (clienteIds.length === 0) {
        setBalances([]);
        setTransactions([]);
        calculateKPIs([], []);
        setLoading(false);
        return;
      }

      // Buscar saldos
      let balanceQuery = supabase
        .schema('sistemaretiradas')
        .from('cashback_balance')
        .select('*, cliente:cliente_id (id, nome, cpf_cnpj)')
        .in('cliente_id', clienteIds);

      const { data: balancesData, error: balancesError } = await balanceQuery;
      if (balancesError) throw balancesError;
      setBalances(balancesData || []);

      // Buscar transações
      let transactionQuery = supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .select('*, cliente:cliente_id (id, nome, cpf_cnpj), tiny_order:tiny_order_id (id, numero_pedido, valor_total)')
        .in('cliente_id', clienteIds)
        .order('created_at', { ascending: false })
        .limit(2000); // Aumentei limite para pegar mais histórico

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

    // 1. Cashback Gerado (Total Histórico)
    const totalGerado = transactions
      .filter(t => t.transaction_type === 'EARNED')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // 2. Clientes (Total com saldo ou histórico)
    const totalClientes = balances.length;

    // 3. Cashback Resgatado (Total Histórico)
    const totalResgatado = transactions
      .filter(t => t.transaction_type === 'REDEEMED')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // 4. Cashback a Vencer (Próximos 7 dias)
    // Considera apenas o que ainda não expirou e vence em até 7 dias
    const aVencer = transactions
      .filter(t => {
        if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
        const expDate = new Date(t.data_expiracao);
        return isAfter(expDate, now) && isBefore(expDate, sevenDaysFromNow);
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    setKpis({
      total_cashback: totalGerado, // Reutilizando campo para "Gerado Total"
      disponivel: totalResgatado, // Reutilizando campo para "Resgatado"
      pendente: 0, // Não usado nos cards principais
      expirando: aVencer, // "A Vencer"
      expirado: 0, // Não usado
      total_clientes: totalClientes
    });
  };

  // ... (rest of the code)

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* ... (header and filters remain same) ... */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* CARD 1: Cashback Gerado (Total) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cashback Gerado</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.total_cashback)}</div>
                <p className="text-xs text-muted-foreground">Total histórico gerado</p>
              </CardContent>
            </Card>

            {/* CARD 2: Clientes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{kpis.total_clientes}</div>
                <p className="text-xs text-muted-foreground">Clientes com cashback</p>
              </CardContent>
            </Card>

            {/* CARD 3: Cashback Resgatado */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cashback Resgatado</CardTitle>
                <RefreshCw className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.disponivel)}</div>
                <p className="text-xs text-muted-foreground">Total histórico utilizado</p>
              </CardContent>
            </Card>

            {/* CARD 4: Cashback a Vencer */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">A Vencer (7 dias)</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.expirando)}</div>
                <p className="text-xs text-muted-foreground">Expira na próxima semana</p>
              </CardContent>
            </Card>

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
