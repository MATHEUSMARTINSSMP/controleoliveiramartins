/**
 * Componente de Cashback para Visão Loja
 * Versão simplificada do CashbackManagement
 * Sem: Bonificar, Configurações, Edição de Tags
 */

import { useEffect, useState, useMemo } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  tags?: string[] | null;
  data_nascimento?: string | null;
  categoria?: string | null;
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

interface CashbackLojaViewProps {
  storeId: string | null;
}

export default function CashbackLojaView({ storeId }: CashbackLojaViewProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lancar');

  // Estados para lançamento/resgate
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteLancar, setSelectedClienteLancar] = useState('');
  const [valorLancar, setValorLancar] = useState('');
  const [descricaoLancar, setDescricaoLancar] = useState('');
  const [lancando, setLancando] = useState(false);
  const [searchClienteLancar, setSearchClienteLancar] = useState('');

  const [selectedClienteResgatar, setSelectedClienteResgatar] = useState('');
  const [valorResgatar, setValorResgatar] = useState('');
  const [descricaoResgatar, setDescricaoResgatar] = useState('');
  const [resgatando, setResgatando] = useState(false);
  const [searchClienteResgatar, setSearchClienteResgatar] = useState('');

  // Estados para lista de clientes
  const [clientesComSaldo, setClientesComSaldo] = useState<ClienteComSaldo[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para histórico geral
  const [historicoGeral, setHistoricoGeral] = useState<CashbackTransaction[]>([]);
  const [filtroHistorico, setFiltroHistorico] = useState<'todos' | 'ganhou' | 'resgatou'>('todos');

  // KPIs
  const [kpis, setKpis] = useState({
    total_gerado: 0,
    total_clientes: 0,
    total_resgatado: 0,
    a_vencer_7d: 0,
  });

  useEffect(() => {
    if (profile && storeId) {
      fetchData();
    }
  }, [profile, storeId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar TODAS as clientes (com e sem saldo)
      const { data: allClientes, error: clientesError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id, nome, cpf_cnpj, telefone, email, tags, data_nascimento')
        .not('cpf_cnpj', 'is', null)
        .neq('cpf_cnpj', '')
        .order('nome');

      if (clientesError) throw clientesError;

      setClientes(allClientes || []);

      // Buscar saldos de cashback
      const { data: balances, error: balancesError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_balance')
        .select('*');

      if (balancesError) throw balancesError;

      // Buscar transações
      const { data: transactions, error: transactionsError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .select(`
          *,
          tiny_order:tiny_orders(numero_pedido)
        `)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Buscar pedidos para calcular categoria
      const { data: ordersData, error: ordersError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, valor_total, situacao');

      if (ordersError) {
        console.error('Erro ao buscar pedidos para categoria:', ordersError);
      }

      // Calcular total de compras por cliente
      const totalComprasPorCliente = new Map<string, number>();
      ordersData?.forEach((order: any) => {
        if (order.cliente_id && order.valor_total) {
          const valor = parseFloat(order.valor_total || 0);
          if (!isNaN(valor) && isFinite(valor)) {
            const atual = totalComprasPorCliente.get(order.cliente_id) || 0;
            totalComprasPorCliente.set(order.cliente_id, atual + valor);
          }
        }
      });

      // Função para obter categoria do cliente
      const obterCategoriaCliente = (clienteId: string): string | null => {
        const totalCompras = totalComprasPorCliente.get(clienteId) || 0;
        if (totalCompras > 10000) return 'BLACK';
        if (totalCompras >= 5000) return 'PLATINUM';
        if (totalCompras >= 1000) return 'VIP';
        if (totalCompras > 0) return 'REGULAR';
        return null;
      };

      // Combinar clientes com saldos e transações
      const clientesComSaldoData: ClienteComSaldo[] = (allClientes || []).map(cliente => {
        const balance = (balances || []).find(b => b.cliente_id === cliente.id);
        const clienteTransactions = (transactions || []).filter(t => t.cliente_id === cliente.id);
        const categoria = obterCategoriaCliente(cliente.id);

        return {
          cliente: { ...cliente, categoria },
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

      const hoje = new Date();
      const aVencer = (transactions || [])
        .filter(t => {
          if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
          const expDate = new Date(t.data_expiracao);
          const diff = expDate.getTime() - hoje.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return days > 0 && days <= 7;
        })
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setKpis({
        total_gerado,
        total_clientes: allClientes?.length || 0,
        total_resgatado,
        a_vencer_7d: aVencer,
      });
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados de cashback');
    } finally {
      setLoading(false);
    }
  };

  // Função para lançar cashback
  const handleLancar = async () => {
    if (!selectedClienteLancar || !valorLancar || parseFloat(valorLancar) <= 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLancando(true);
    try {
      const { data: settingsData } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      const settings = settingsData || {
        prazo_liberacao_dias: 2,
        prazo_expiracao_dias: 30,
      };

      const valorNum = parseFloat(valorLancar);
      const agora = new Date();
      const macapaOffset = -3 * 60;
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const dataLiberacao = new Date(macapaTime);
      dataLiberacao.setDate(dataLiberacao.getDate() + settings.prazo_liberacao_dias);

      const dataExpiracao = new Date(dataLiberacao);
      dataExpiracao.setDate(dataExpiracao.getDate() + settings.prazo_expiracao_dias);

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteLancar,
          tiny_order_id: null,
          transaction_type: 'EARNED',
          amount: valorNum,
          description: descricaoLancar || 'Cashback manual',
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
        });

      if (error) throw error;

      toast.success(`Cashback de ${formatCurrency(valorNum)} lançado com sucesso!`);
      setSelectedClienteLancar('');
      setValorLancar('');
      setDescricaoLancar('');
      setSearchClienteLancar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao lançar cashback:', error);
      toast.error('Erro ao lançar cashback: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLancando(false);
    }
  };

  // Função para resgatar cashback
  const handleResgatar = async () => {
    if (!selectedClienteResgatar || !valorResgatar || parseFloat(valorResgatar) <= 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setResgatando(true);
    try {
      const valorNum = parseFloat(valorResgatar);

      // Verificar saldo disponível
      const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
      if (!cliente || cliente.saldo_disponivel < valorNum) {
        toast.error('Saldo insuficiente para resgate');
        return;
      }

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteResgatar,
          tiny_order_id: null,
          transaction_type: 'REDEEMED',
          amount: valorNum,
          description: descricaoResgatar || 'Resgate de cashback',
        });

      if (error) throw error;

      toast.success(`Cashback de ${formatCurrency(valorNum)} resgatado com sucesso!`);
      setSelectedClienteResgatar('');
      setValorResgatar('');
      setDescricaoResgatar('');
      setSearchClienteResgatar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao resgatar cashback:', error);
      toast.error('Erro ao resgatar cashback: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setResgatando(false);
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

  // Filtrar clientes por busca
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientesComSaldo;
    const term = searchTerm.toLowerCase();
    return clientesComSaldo.filter(({ cliente }) =>
      cliente.nome.toLowerCase().includes(term) ||
      cliente.cpf_cnpj?.toLowerCase().includes(term)
    );
  }, [clientesComSaldo, searchTerm]);

  // Filtrar histórico
  const historicoFiltrado = useMemo(() => {
    if (filtroHistorico === 'todos') return historicoGeral;
    if (filtroHistorico === 'ganhou') {
      return historicoGeral.filter(t => t.transaction_type === 'EARNED');
    }
    if (filtroHistorico === 'resgatou') {
      return historicoGeral.filter(t => t.transaction_type === 'REDEEMED');
    }
    return historicoGeral;
  }, [historicoGeral, filtroHistorico]);

  // Filtrar clientes para lançar/resgatar
  const clientesFiltradosLancar = useMemo(() => {
    if (!searchClienteLancar) return clientes;
    const term = searchClienteLancar.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.cpf_cnpj?.toLowerCase().includes(term)
    );
  }, [clientes, searchClienteLancar]);

  const clientesFiltradosResgatar = useMemo(() => {
    if (!searchClienteResgatar) return clientesComSaldo.filter(c => c.saldo_disponivel > 0);
    const term = searchClienteResgatar.toLowerCase();
    return clientesComSaldo.filter(({ cliente }) =>
      (cliente.nome.toLowerCase().includes(term) ||
        cliente.cpf_cnpj?.toLowerCase().includes(term)) &&
      clientesComSaldo.find(c => c.cliente.id === cliente.id)?.saldo_disponivel > 0
    );
  }, [clientesComSaldo, searchClienteResgatar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cashback Gerado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.total_gerado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total_clientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Total cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resgatado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.total_resgatado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total utilizado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              A Vencer (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.a_vencer_7d)}</div>
            <p className="text-xs text-muted-foreground mt-1">Expira na próxima semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="lancar">Lançar</TabsTrigger>
          <TabsTrigger value="resgatar">Resgatar</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico Geral</TabsTrigger>
        </TabsList>

        {/* TAB 1: LANÇAR */}
        <TabsContent value="lancar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lançar Cashback</CardTitle>
              <CardDescription>Adicione cashback manualmente para um cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={searchClienteLancar}
                    onChange={(e) => {
                      setSearchClienteLancar(e.target.value);
                      if (!e.target.value) setSelectedClienteLancar('');
                    }}
                    className="pl-10"
                  />
                </div>
                {searchClienteLancar && clientesFiltradosLancar.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {clientesFiltradosLancar.map(cliente => (
                      <div
                        key={cliente.id}
                        onClick={() => {
                          setSelectedClienteLancar(cliente.id);
                          setSearchClienteLancar(cliente.nome);
                        }}
                        className={`p-3 cursor-pointer hover:bg-muted ${
                          selectedClienteLancar === cliente.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="font-medium">{cliente.nome}</div>
                        <div className="text-sm text-muted-foreground">{cliente.cpf_cnpj}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valorLancar}
                  onChange={(e) => setValorLancar(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Ex: Cashback de compra especial"
                  value={descricaoLancar}
                  onChange={(e) => setDescricaoLancar(e.target.value)}
                />
              </div>

              <Button
                onClick={handleLancar}
                disabled={lancando || !selectedClienteLancar || !valorLancar}
                className="w-full"
              >
                {lancando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Lançando...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Lançar Cashback
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: RESGATAR */}
        <TabsContent value="resgatar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resgatar Cashback</CardTitle>
              <CardDescription>Registre o resgate de cashback por um cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={searchClienteResgatar}
                    onChange={(e) => {
                      setSearchClienteResgatar(e.target.value);
                      if (!e.target.value) setSelectedClienteResgatar('');
                    }}
                    className="pl-10"
                  />
                </div>
                {searchClienteResgatar && clientesFiltradosResgatar.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {clientesFiltradosResgatar.map(({ cliente, saldo_disponivel }) => (
                      <div
                        key={cliente.id}
                        onClick={() => {
                          setSelectedClienteResgatar(cliente.id);
                          setSearchClienteResgatar(cliente.nome);
                        }}
                        className={`p-3 cursor-pointer hover:bg-muted ${
                          selectedClienteResgatar === cliente.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="font-medium">{cliente.nome}</div>
                        <div className="text-sm text-muted-foreground">{cliente.cpf_cnpj}</div>
                        <div className="text-sm font-semibold text-green-600 mt-1">
                          Saldo: {formatCurrency(saldo_disponivel)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valorResgatar}
                  onChange={(e) => setValorResgatar(e.target.value)}
                />
                {selectedClienteResgatar && (
                  <p className="text-xs text-muted-foreground">
                    Saldo disponível: {formatCurrency(
                      clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar)?.saldo_disponivel || 0
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Ex: Resgate em compra"
                  value={descricaoResgatar}
                  onChange={(e) => setDescricaoResgatar(e.target.value)}
                />
              </div>

              <Button
                onClick={handleResgatar}
                disabled={resgatando || !selectedClienteResgatar || !valorResgatar}
                className="w-full"
              >
                {resgatando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resgatando...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Resgatar Cashback
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CLIENTES */}
        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>Visualize clientes e seus saldos de cashback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2">
                  {clientesFiltrados.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</p>
                  ) : (
                    clientesFiltrados.map(({ cliente, saldo_disponivel, saldo_pendente, transactions }) => {
                      const aVencer = transactions.filter(t => {
                        if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
                        const expDate = new Date(t.data_expiracao);
                        const now = new Date();
                        const diff = expDate.getTime() - now.getTime();
                        const days = diff / (1000 * 60 * 60 * 24);
                        return days > 0 && days <= 7;
                      }).reduce((sum, t) => sum + Number(t.amount), 0);

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
                                <div className="flex-1">
                                  <div className="font-medium">{cliente.nome}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {cliente.cpf_cnpj} • {transactions.length} transações
                                  </div>
                                  {(cliente.tags && cliente.tags.length > 0) || cliente.categoria ? (
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {cliente.tags && cliente.tags.length > 0 && (
                                        cliente.tags.map((tag, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))
                                      )}
                                      {cliente.categoria && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                          {cliente.categoria}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : null}
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
                            <div className="mt-2 border-t pt-4 px-4 space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">Histórico de Transações</h4>
                                </div>
                                {transactions.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-8">
                                    Nenhuma transação ainda
                                  </p>
                                ) : (
                                  <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                                    <Table>
                                      <TableHeader className="sticky top-0 bg-background z-10">
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
                                                  <>
                                                    {t.description?.startsWith('BONIFICAÇÃO:') ? (
                                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                        Bonificação
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        Ganhou
                                                      </Badge>
                                                    )}
                                                  </>
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
                                  </div>
                                )}
                              </div>
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

        {/* TAB 4: HISTÓRICO GERAL */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico Cronológico</CardTitle>
              <CardDescription>Todas as movimentações de cashback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={filtroHistorico === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroHistorico('todos')}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filtroHistorico === 'ganhou' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroHistorico('ganhou')}
                  >
                    Ganhou
                  </Button>
                  <Button
                    variant={filtroHistorico === 'resgatou' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroHistorico('resgatou')}
                  >
                    Resgatou
                  </Button>
                </div>

                <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Expira</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicoFiltrado.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhuma transação encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        historicoFiltrado.map(t => {
                          const cliente = clientes.find(c => c.id === t.cliente_id);
                          return (
                            <TableRow key={t.id}>
                              <TableCell className="text-sm">
                                {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm">{cliente?.nome || 'Cliente não encontrado'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {t.transaction_type === 'EARNED' && (
                                    <>
                                      {t.description?.startsWith('BONIFICAÇÃO:') ? (
                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                          Bonificação
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                          Ganhou
                                        </Badge>
                                      )}
                                    </>
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
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

