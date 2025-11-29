/**
 * Página de Gestão de Cashback - REDESIGN COMPLETO
 * 
 * Inspirado no sistema Kikadi
 * 3 Tabs: Lançar, Clientes, Histórico Geral
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Gift,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
}

interface CashbackTransaction {
  id: string;
  cliente_id: string;
  tiny_order_id: string | null;
  transaction_type: 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTMENT';
  amount: number;
  description: string | null;
  data_liberacao: string | null;
  data_expiracao: string | null;
  renovado: boolean;
  created_at: string;
  tiny_order?: { numero_pedido: string | null };
}

interface ClienteComSaldo {
  cliente: Cliente;
  saldo_disponivel: number;
  saldo_pendente: number;
  total_earned: number;
  transactions: CashbackTransaction[];
}

export default function CashbackManagement() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lancar');

  // Estados para lançamento/resgate
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteLancar, setSelectedClienteLancar] = useState('');
  const [valorLancar, setValorLancar] = useState('');
  const [descricaoLancar, setDescricaoLancar] = useState('');
  const [lancando, setLancando] = useState(false);

  const [selectedClienteResgatar, setSelectedClienteResgatar] = useState('');
  const [valorResgatar, setValorResgatar] = useState('');
  const [descricaoResgatar, setDescricaoResgatar] = useState('');
  const [resgatando, setResgatando] = useState(false);

  // Estados para lista de clientes
  const [clientesComSaldo, setClientesComSaldo] = useState<ClienteComSaldo[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para histórico geral
  const [historicoGeral, setHistoricoGeral] = useState<CashbackTransaction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'EARNED' | 'REDEEMED' | 'EXPIRED'>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterClientSearch, setFilterClientSearch] = useState('');

  // Estados para cancelamento
  const [canceling, setCanceling] = useState<string | null>(null);

  // KPIs
  const [kpis, setKpis] = useState({
    total_gerado: 0,
    total_clientes: 0,
    total_resgatado: 0,
    a_vencer_7d: 0,
  });

  useEffect(() => {
    if (!authLoading && profile) {
      fetchData();
    }
  }, [authLoading, profile]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar TODAS as clientes (com e sem saldo)
      const { data: allClientes, error: clientesError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id, nome, cpf_cnpj, telefone, email')
        .not('cpf_cnpj', 'is', null)
        .neq('cpf_cnpj', '')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(allClientes || []);

      // Buscar saldos
      const { data: balances, error: balancesError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_balance')
        .select('*');

      if (balancesError) throw balancesError;

      // Buscar todas as transações
      const { data: transactions, error: transactionsError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .select(`
          *,
          tiny_order:tiny_order_id (numero_pedido)
        `)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Combinar clientes com saldos e transações
      const clientesComSaldoData: ClienteComSaldo[] = (allClientes || []).map(cliente => {
        const balance = (balances || []).find(b => b.cliente_id === cliente.id);
        const clienteTransactions = (transactions || []).filter(t => t.cliente_id === cliente.id);

        return {
          cliente,
          saldo_disponivel: balance?.balance_disponivel || 0,
          saldo_pendente: balance?.balance_pendente || 0,
          total_earned: balance?.total_earned || 0,
          transactions: clienteTransactions,
        };
      });

      setClientesComSaldo(clientesComSaldoData);
      setHistoricoGeral(transactions || []);

      // Calcular KPIs
      const totalGerado = (transactions || [])
        .filter(t => t.transaction_type === 'EARNED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalResgatado = (transactions || [])
        .filter(t => t.transaction_type === 'REDEEMED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const aVencer7d = (transactions || [])
        .filter(t => {
          if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
          const expDate = new Date(t.data_expiracao);
          const now = new Date();
          const diff = expDate.getTime() - now.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return days > 0 && days <= 7;
        })
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setKpis({
        total_gerado: totalGerado,
        total_clientes: clientesComSaldoData.length,
        total_resgatado: totalResgatado,
        a_vencer_7d: aVencer7d,
      });

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados de cashback');
    } finally {
      setLoading(false);
    }
  };

  const handleLancar = async () => {
    if (!selectedClienteLancar || !valorLancar) {
      toast.error('Preencha cliente e valor');
      return;
    }

    setLancando(true);
    try {
      const valorCompra = parseFloat(valorLancar);
      if (valorCompra <= 0) {
        toast.error('Valor deve ser maior que zero');
        setLancando(false);
        return;
      }

      // ✅ 1. Validar se cliente tem CPF
      const cliente = clientes.find(c => c.id === selectedClienteLancar);
      if (!cliente || !cliente.cpf_cnpj || cliente.cpf_cnpj.trim() === '') {
        toast.error('Cliente sem CPF/CNPJ. Cashback não pode ser lançado.');
        setLancando(false);
        return;
      }

      // ✅ 2. Buscar configurações de cashback (global)
      const { data: settingsData, error: settingsError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      // Se não tem configuração global, usar padrão
      const settings = settingsData || {
        percentual_cashback: 15.00,
        prazo_liberacao_dias: 2,
        prazo_expiracao_dias: 30,
      };

      // ✅ 3. Calcular valor do cashback
      const cashbackAmount = Math.round((valorCompra * parseFloat(settings.percentual_cashback.toString())) / 100 * 100) / 100;

      if (cashbackAmount <= 0) {
        toast.error('Valor de cashback zero ou negativo');
        setLancando(false);
        return;
      }

      // ✅ 4. Calcular datas no fuso horário de Macapá (UTC-3)
      const agora = new Date();
      // Ajustar para UTC-3 (Macapá)
      const macapaOffset = -3 * 60; // -3 horas em minutos
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const dataLiberacao = new Date(macapaTime);
      dataLiberacao.setDate(dataLiberacao.getDate() + settings.prazo_liberacao_dias);

      const dataExpiracao = new Date(dataLiberacao);
      dataExpiracao.setDate(dataExpiracao.getDate() + settings.prazo_expiracao_dias);

      // ✅ 5. Inserir diretamente na tabela cashback_transactions
      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteLancar,
          tiny_order_id: null, // Lançamento manual não tem pedido vinculado
          transaction_type: 'EARNED',
          amount: cashbackAmount,
          description: descricaoLancar || 'Lançamento manual de cashback',
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
        });

      if (insertError) throw insertError;

      // ✅ O trigger do banco vai atualizar o saldo automaticamente

      toast.success(`✅ Cashback lançado: ${formatCurrency(cashbackAmount)}`);
      setSelectedClienteLancar('');
      setValorLancar('');
      setDescricaoLancar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao lançar cashback:', error);
      toast.error(error.message || 'Erro ao lançar cashback');
    } finally {
      setLancando(false);
    }
  };

  const handleResgatar = async () => {
    if (!selectedClienteResgatar || !valorResgatar) {
      toast.error('Preencha cliente e valor');
      return;
    }

    setResgatando(true);
    try {
      const valorResgate = parseFloat(valorResgatar);
      if (valorResgate <= 0) {
        toast.error('Valor deve ser maior que zero');
        setResgatando(false);
        return;
      }

      // ✅ 1. Buscar saldo disponível do cliente
      const { data: balanceData, error: balanceError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_balance')
        .select('balance_disponivel')
        .eq('cliente_id', selectedClienteResgatar)
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') {
        throw balanceError;
      }

      const balanceDisponivel = balanceData?.balance_disponivel || 0;

      if (balanceDisponivel === 0) {
        toast.error('Cliente não possui saldo de cashback');
        setResgatando(false);
        return;
      }

      if (balanceDisponivel < valorResgate) {
        toast.error(`Saldo insuficiente. Disponível: ${formatCurrency(balanceDisponivel)}`);
        setResgatando(false);
        return;
      }

      // ✅ 2. Inserir diretamente na tabela cashback_transactions
      // Usar horário de Macapá (UTC-3)
      const agora = new Date();
      const macapaOffset = -3 * 60; // -3 horas em minutos
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteResgatar,
          tiny_order_id: null,
          transaction_type: 'REDEEMED',
          amount: valorResgate,
          description: descricaoResgatar || 'Resgate manual de cashback',
          data_liberacao: macapaTime.toISOString(), // Resgate é imediato
          data_expiracao: null, // Resgate não expira
        });

      if (insertError) throw insertError;

      // ✅ O trigger do banco vai atualizar o saldo automaticamente

      toast.success(`✅ Cashback resgatado: ${formatCurrency(valorResgate)}`);
      setSelectedClienteResgatar('');
      setValorResgatar('');
      setDescricaoResgatar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao resgatar cashback:', error);
      toast.error(error.message || 'Erro ao resgatar cashback');
    } finally {
      setResgatando(false);
    }
  };

  const handleCancelar = async (transactionId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta transação?')) return;

    setCanceling(transactionId);
    try {
      const { data, error } = await supabase.rpc('cancelar_transacao_cashback', {
        p_transaction_id: transactionId,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Transação cancelada com sucesso');
        await fetchData();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao cancelar transação:', error);
      toast.error('Erro ao cancelar transação');
    } finally {
      setCanceling(null);
    }
  };

  const handleRenovar = async (clienteId: string) => {
    // Buscar transação expirada mais recente do cliente
    const cliente = clientesComSaldo.find(c => c.cliente.id === clienteId);
    if (!cliente) return;

    const expiredTransaction = cliente.transactions.find(t =>
      t.transaction_type === 'EARNED' &&
      t.data_expiracao &&
      new Date(t.data_expiracao) < new Date()
    );

    if (!expiredTransaction) {
      toast.error('Nenhum cashback expirado encontrado');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('renovar_cashback', {
        p_transaction_id: expiredTransaction.id,
        p_cliente_id: clienteId,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Cashback renovado com sucesso');
        await fetchData();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao renovar cashback:', error);
      toast.error('Erro ao renovar cashback');
    }
  };

  const toggleClientExpanded = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const filteredClientes = useMemo(() => {
    return clientesComSaldo.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      return (
        c.cliente.nome.toLowerCase().includes(searchLower) ||
        c.cliente.cpf_cnpj?.toLowerCase().includes(searchLower) ||
        c.cliente.telefone?.toLowerCase().includes(searchLower)
      );
    });
  }, [clientesComSaldo, searchTerm]);

  const filteredHistorico = useMemo(() => {
    let filtered = historicoGeral;

    // Filtro por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // Filtro por data
    if (filterDateStart) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.created_at) <= endDate);
    }

    // Filtro por cliente (nome ou CPF)
    if (filterClientSearch) {
      const searchLower = filterClientSearch.toLowerCase();
      filtered = filtered.filter(t => {
        const cliente = clientes.find(c => c.id === t.cliente_id);
        return (
          cliente?.nome.toLowerCase().includes(searchLower) ||
          cliente?.cpf_cnpj?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [historicoGeral, filterType, filterDateStart, filterDateEnd, filterClientSearch, clientes]);

  const cashbackPreview = useMemo(() => {
    if (!valorLancar) return 0;
    return parseFloat(valorLancar) * 0.15; // 15%
  }, [valorLancar]);

  const saldoClienteResgatar = useMemo(() => {
    if (!selectedClienteResgatar) return 0;
    const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
    return cliente?.saldo_disponivel || 0;
  }, [selectedClienteResgatar, clientesComSaldo]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/erp/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gift className="h-8 w-8 text-primary" />
              Gestão de Cashback
            </h1>
            <p className="text-muted-foreground">Gerencie o programa de cashback dos seus clientes</p>
          </div>
        </div>

      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback Gerado</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.total_gerado)}</div>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpis.total_clientes}</div>
            <p className="text-xs text-muted-foreground">Total cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resgatado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.total_resgatado)}</div>
            <p className="text-xs text-muted-foreground">Total utilizado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Vencer (7 dias)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.a_vencer_7d)}</div>
            <p className="text-xs text-muted-foreground">Expira na próxima semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lancar">Lançar</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico Geral</TabsTrigger>
        </TabsList>

        {/* TAB 1: LANÇAR */}
        <TabsContent value="lancar" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Pontuar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Pontuar
                </CardTitle>
                <CardDescription>Lançar cashback manualmente para uma cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente-lancar">Cliente *</Label>
                  <Select value={selectedClienteLancar} onValueChange={setSelectedClienteLancar}>
                    <SelectTrigger id="cliente-lancar">
                      <SelectValue placeholder="Buscar por nome ou CPF..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} - {c.cpf_cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor-lancar">Valor da Compra *</Label>
                  <Input
                    id="valor-lancar"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorLancar}
                    onChange={(e) => setValorLancar(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao-lancar">Descrição (opcional)</Label>
                  <Input
                    id="descricao-lancar"
                    placeholder="Ex: Compra em loja física"
                    value={descricaoLancar}
                    onChange={(e) => setDescricaoLancar(e.target.value)}
                  />
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    Cashback a gerar: <strong>{formatCurrency(cashbackPreview)}</strong>
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleLancar}
                  disabled={lancando || !selectedClienteLancar || !valorLancar}
                >
                  {lancando ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lançando...</>
                  ) : (
                    'LANÇAR'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Card Resgatar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-orange-600" />
                  Resgatar
                </CardTitle>
                <CardDescription>Resgatar cashback manualmente de uma cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente-resgatar">Cliente *</Label>
                  <Select value={selectedClienteResgatar} onValueChange={setSelectedClienteResgatar}>
                    <SelectTrigger id="cliente-resgatar">
                      <SelectValue placeholder="Buscar por nome ou CPF..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} - {c.cpf_cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor-resgatar">Valor a Resgatar *</Label>
                  <Input
                    id="valor-resgatar"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorResgatar}
                    onChange={(e) => setValorResgatar(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao-resgatar">Descrição (opcional)</Label>
                  <Input
                    id="descricao-resgatar"
                    placeholder="Ex: Desconto aplicado em compra"
                    value={descricaoResgatar}
                    onChange={(e) => setDescricaoResgatar(e.target.value)}
                  />
                </div>

                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-800">
                    Saldo disponível: <strong>{formatCurrency(saldoClienteResgatar)}</strong>
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={handleResgatar}
                  disabled={resgatando || !selectedClienteResgatar || !valorResgatar}
                >
                  {resgatando ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resgatando...</>
                  ) : (
                    'RESGATAR'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: CLIENTES */}
        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Clientes</CardTitle>
              <CardDescription>Lista completa de clientes (com e sem saldo)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente (nome, CPF, telefone)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Lista de Clientes */}
                <div className="space-y-2">
                  {filteredClientes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma cliente encontrada
                    </div>
                  ) : (
                    filteredClientes.map(({ cliente, saldo_disponivel, saldo_pendente, transactions }) => {
                      const aVencer = transactions.filter(t => {
                        if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
                        const expDate = new Date(t.data_expiracao);
                        const now = new Date();
                        const diff = expDate.getTime() - now.getTime();
                        const days = diff / (1000 * 60 * 60 * 24);
                        return days > 0 && days <= 7;
                      }).reduce((sum, t) => sum + Number(t.amount), 0);

                      const temExpirado = transactions.some(t =>
                        t.transaction_type === 'EARNED' &&
                        t.data_expiracao &&
                        new Date(t.data_expiracao) < new Date()
                      );

                      return (
                        <Collapsible
                          key={cliente.id}
                          open={expandedClients.has(cliente.id)}
                          onOpenChange={() => toggleClientExpanded(cliente.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                              <div className="flex items-center gap-3">
                                {expandedClients.has(cliente.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <div>
                                  <div className="font-medium">{cliente.nome}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {cliente.cpf_cnpj} • {transactions.length} transações
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">
                                  💰 {formatCurrency(saldo_disponivel)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {saldo_pendente > 0 && `⏳ Pendente: ${formatCurrency(saldo_pendente)}`}
                                  {aVencer > 0 && ` • ⚠️ A vencer: ${formatCurrency(aVencer)}`}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 border-t pt-4 px-4">
                              {transactions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  Nenhuma transação ainda
                                </p>
                              ) : (
                                <>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Evento</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Expira</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {transactions.map(t => (
                                        <TableRow key={t.id}>
                                          <TableCell className="text-sm">
                                            {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              {t.transaction_type === 'EARNED' && (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                  Ganhou
                                                </Badge>
                                              )}
                                              {t.transaction_type === 'REDEEMED' && (
                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                  Resgatou
                                                </Badge>
                                              )}
                                              {t.transaction_type === 'EXPIRED' && (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                  Expirou
                                                </Badge>
                                              )}
                                              {t.tiny_order?.numero_pedido && (
                                                <span className="text-xs text-muted-foreground">
                                                  (Pedido #{t.tiny_order.numero_pedido})
                                                </span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className={t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? 'text-red-600' : 'text-green-600'}>
                                            {t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? '-' : '+'}
                                            {formatCurrency(Math.abs(Number(t.amount)))}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {t.data_expiracao ? format(new Date(t.data_expiracao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {temExpirado && (
                                    <div className="mt-4">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRenovar(cliente.id)}
                                        className="w-full"
                                      >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Renovar Cashback Expirado
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HISTÓRICO GERAL */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico Cronológico da Loja</CardTitle>
              <CardDescription>Todas as movimentações de cashback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="EARNED">Ganhou</SelectItem>
                        <SelectItem value="REDEEMED">Resgatou</SelectItem>
                        <SelectItem value="EXPIRED">Expirou</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <Input
                      placeholder="Nome ou CPF..."
                      value={filterClientSearch}
                      onChange={(e) => setFilterClientSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tabela */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cashback</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistorico.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistorico.slice(0, 50).map(t => {
                        const cliente = clientes.find(c => c.id === t.cliente_id);
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">
                              {format(new Date(t.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{cliente?.nome || 'Desconhecido'}</div>
                                <div className="text-xs text-muted-foreground">{cliente?.cpf_cnpj}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.transaction_type === 'EARNED' && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Ganhou
                                </Badge>
                              )}
                              {t.transaction_type === 'REDEEMED' && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  Resgatou
                                </Badge>
                              )}
                              {t.transaction_type === 'EXPIRED' && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                  Expirou
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                              {t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? '-' : '+'}
                              {formatCurrency(Math.abs(Number(t.amount)))}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.tiny_order?.numero_pedido ? `#${t.tiny_order.numero_pedido}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.transaction_type !== 'ADJUSTMENT' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelar(t.id)}
                                  disabled={canceling === t.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {canceling === t.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Cancelar'
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
