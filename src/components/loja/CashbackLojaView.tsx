/**
 * Componente de Cashback para Visão Loja
 * Versão simplificada do CashbackManagement
 * Layout Lado a Lado: Pontuar (Venda) e Resgatar
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
  Loader2,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Gift,
  ArrowRightLeft,
  Wallet,
  ShoppingBag
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
  const [activeTab, setActiveTab] = useState('operacoes');

  // Estados para Pontuar (Lançar)
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClientePontuar, setSelectedClientePontuar] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [pontuando, setPontuando] = useState(false);
  const [searchClientePontuar, setSearchClientePontuar] = useState('');
  const [percentualCashback, setPercentualCashback] = useState(15); // Padrão 15%

  // Estados para Resgatar
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
      fetchSettings();
    }
  }, [profile, storeId]);

  const fetchSettings = async () => {
    try {
      // Tenta buscar configuração da loja, senão global
      let query = supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('percentual_cashback');

      if (storeId) {
        // Tentar buscar específico da loja primeiro (se existisse tabela por loja, mas aqui é global ou null)
        // Como a tabela atual é global (store_id null), buscamos a global mesmo
        query = query.is('store_id', null);
      } else {
        query = query.is('store_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (data) {
        setPercentualCashback(Number(data.percentual_cashback));
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar TODAS as clientes
      const { data: allClientes, error: clientesError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id, nome, cpf_cnpj, telefone, email, tags, data_nascimento')
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

      // Buscar pedidos desta loja para calcular categoria
      let ordersQuery = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, valor_total');

      if (storeId) {
        ordersQuery = ordersQuery.eq('store_id', storeId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) console.error('Erro ao buscar pedidos:', ordersError);

      // Calcular total de compras por cliente NESTA loja
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

      const obterCategoriaCliente = (clienteId: string): string | null => {
        const totalCompras = totalComprasPorCliente.get(clienteId) || 0;
        if (totalCompras > 10000) return 'BLACK';
        if (totalCompras >= 5000) return 'PLATINUM';
        if (totalCompras >= 1000) return 'VIP';
        if (totalCompras > 0) return 'REGULAR';
        return null;
      };

      // Combinar dados
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

      // KPIs
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

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Pontuar (Baseado em Venda)
  const handlePontuar = async () => {
    if (!selectedClientePontuar || !valorVenda || parseFloat(valorVenda) <= 0) {
      toast.error('Preencha cliente e valor da venda');
      return;
    }

    setPontuando(true);
    try {
      const { data: settingsData } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      const settings = settingsData || {
        percentual_cashback: 15,
        prazo_liberacao_dias: 2,
        prazo_expiracao_dias: 30,
      };

      const valorVendaNum = parseFloat(valorVenda);
      const cashbackAmount = (valorVendaNum * Number(settings.percentual_cashback)) / 100;

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
          cliente_id: selectedClientePontuar,
          tiny_order_id: null, // Lançamento manual via loja
          transaction_type: 'EARNED',
          amount: cashbackAmount,
          description: `Pontos sobre venda de ${formatCurrency(valorVendaNum)}`,
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
        });

      if (error) throw error;

      toast.success(`✅ Cashback de ${formatCurrency(cashbackAmount)} gerado com sucesso!`);
      setSelectedClientePontuar('');
      setValorVenda('');
      setSearchClientePontuar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao pontuar:', error);
      toast.error('Erro ao gerar pontos: ' + error.message);
    } finally {
      setPontuando(false);
    }
  };

  // Lógica de Resgatar
  const handleResgatar = async () => {
    if (!selectedClienteResgatar || !valorResgatar || parseFloat(valorResgatar) <= 0) {
      toast.error('Preencha cliente e valor do resgate');
      return;
    }

    setResgatando(true);
    try {
      const valorNum = parseFloat(valorResgatar);
      const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);

      if (!cliente || cliente.saldo_disponivel < valorNum) {
        toast.error(`Saldo insuficiente. Disponível: ${formatCurrency(cliente?.saldo_disponivel || 0)}`);
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
          description: descricaoResgatar || 'Resgate em loja',
        });

      if (error) throw error;

      toast.success(`✅ Resgate de ${formatCurrency(valorNum)} realizado!`);
      setSelectedClienteResgatar('');
      setValorResgatar('');
      setDescricaoResgatar('');
      setSearchClienteResgatar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao resgatar:', error);
      toast.error('Erro ao resgatar: ' + error.message);
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

  // Filtros
  const clientesFiltradosPontuar = useMemo(() => {
    if (!searchClientePontuar) return [];
    const term = searchClientePontuar.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.cpf_cnpj?.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [clientes, searchClientePontuar]);

  const clientesFiltradosResgatar = useMemo(() => {
    if (!searchClienteResgatar) return [];
    const term = searchClienteResgatar.toLowerCase();
    return clientesComSaldo
      .filter(c => c.saldo_disponivel > 0)
      .filter(({ cliente }) =>
        cliente.nome.toLowerCase().includes(term) ||
        cliente.cpf_cnpj?.toLowerCase().includes(term)
      ).slice(0, 10);
  }, [clientesComSaldo, searchClienteResgatar]);

  const clientesLista = useMemo(() => {
    if (!searchTerm) return clientesComSaldo;
    const term = searchTerm.toLowerCase();
    return clientesComSaldo.filter(({ cliente }) =>
      cliente.nome.toLowerCase().includes(term) ||
      cliente.cpf_cnpj?.toLowerCase().includes(term)
    );
  }, [clientesComSaldo, searchTerm]);

  const historicoFiltrado = useMemo(() => {
    if (filtroHistorico === 'todos') return historicoGeral;
    if (filtroHistorico === 'ganhou') return historicoGeral.filter(t => t.transaction_type === 'EARNED');
    if (filtroHistorico === 'resgatou') return historicoGeral.filter(t => t.transaction_type === 'REDEEMED');
    return historicoGeral;
  }, [historicoGeral, filtroHistorico]);

  const cashbackPrevisto = useMemo(() => {
    if (!valorVenda) return 0;
    return (parseFloat(valorVenda) * percentualCashback) / 100;
  }, [valorVenda, percentualCashback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              A Vencer (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.a_vencer_7d)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operacoes">Operações (Pontuar/Resgatar)</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* TAB 1: OPERAÇÕES (LADO A LADO) */}
        <TabsContent value="operacoes" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* COLUNA ESQUERDA: PONTUAR (LANÇAR) */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <ShoppingBag className="h-5 w-5" />
                  Pontuar Cliente (Venda)
                </CardTitle>
                <CardDescription>Lance o valor da venda para gerar cashback</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Buscar Cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome ou CPF..."
                      value={searchClientePontuar}
                      onChange={(e) => {
                        setSearchClientePontuar(e.target.value);
                        if (!e.target.value) setSelectedClientePontuar('');
                      }}
                      className="pl-10"
                    />
                  </div>
                  {searchClientePontuar && clientesFiltradosPontuar.length > 0 && !selectedClientePontuar && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto bg-white absolute z-10 w-full shadow-lg">
                      {clientesFiltradosPontuar.map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedClientePontuar(c.id);
                            setSearchClientePontuar(c.nome);
                          }}
                          className="p-3 cursor-pointer hover:bg-muted border-b last:border-0"
                        >
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">{c.cpf_cnpj}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Valor da Venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorVenda}
                    onChange={(e) => setValorVenda(e.target.value)}
                    className="text-lg font-semibold"
                  />
                </div>

                {valorVenda && (
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-700">Cashback a gerar ({percentualCashback}%):</span>
                      <span className="font-bold text-lg text-blue-700">{formatCurrency(cashbackPrevisto)}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handlePontuar}
                  disabled={pontuando || !selectedClientePontuar || !valorVenda}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {pontuando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4 mr-2" />
                      Confirmar Pontuação
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* COLUNA DIREITA: RESGATAR */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Wallet className="h-5 w-5" />
                  Resgatar Cashback
                </CardTitle>
                <CardDescription>Utilize o saldo do cliente como desconto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Buscar Cliente (com saldo)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome ou CPF..."
                      value={searchClienteResgatar}
                      onChange={(e) => {
                        setSearchClienteResgatar(e.target.value);
                        if (!e.target.value) setSelectedClienteResgatar('');
                      }}
                      className="pl-10"
                    />
                  </div>
                  {searchClienteResgatar && clientesFiltradosResgatar.length > 0 && !selectedClienteResgatar && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto bg-white absolute z-10 w-full shadow-lg">
                      {clientesFiltradosResgatar.map(({ cliente, saldo_disponivel }) => (
                        <div
                          key={cliente.id}
                          onClick={() => {
                            setSelectedClienteResgatar(cliente.id);
                            setSearchClienteResgatar(cliente.nome);
                          }}
                          className="p-3 cursor-pointer hover:bg-muted border-b last:border-0"
                        >
                          <div className="font-medium">{cliente.nome}</div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</span>
                            <span className="text-sm font-bold text-green-600">{formatCurrency(saldo_disponivel)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Valor do Resgate (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorResgatar}
                    onChange={(e) => setValorResgatar(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  {selectedClienteResgatar && (
                    <p className="text-xs text-right text-muted-foreground">
                      Disponível: <span className="font-bold text-green-600">
                        {formatCurrency(clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar)?.saldo_disponivel || 0)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Descrição (Opcional)</Label>
                  <Input
                    placeholder="Ex: Desconto na compra"
                    value={descricaoResgatar}
                    onChange={(e) => setDescricaoResgatar(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleResgatar}
                  disabled={resgatando || !selectedClienteResgatar || !valorResgatar}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {resgatando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Confirmar Resgate
                    </>
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
              <CardTitle>Lista de Clientes</CardTitle>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {clientesLista.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</p>
                ) : (
                  clientesLista.slice(0, 50).map(({ cliente, saldo_disponivel, saldo_pendente, transactions }) => (
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
                              {cliente.categoria && (
                                <Badge variant="outline" className="mt-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  {cliente.categoria}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              💰 {formatCurrency(saldo_disponivel)}
                            </div>
                            {saldo_pendente > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Pendente: {formatCurrency(saldo_pendente)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 border-t pt-4 px-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transactions.slice(0, 5).map(t => (
                                <TableRow key={t.id}>
                                  <TableCell className="text-xs">
                                    {format(new Date(t.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      t.transaction_type === 'EARNED' ? 'bg-green-50 text-green-700' :
                                        t.transaction_type === 'REDEEMED' ? 'bg-orange-50 text-orange-700' :
                                          'bg-red-50 text-red-700'
                                    }>
                                      {t.transaction_type === 'EARNED' ? 'Ganhou' :
                                        t.transaction_type === 'REDEEMED' ? 'Resgatou' : 'Expirou'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(t.amount)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HISTÓRICO */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoFiltrado.slice(0, 50).map(t => {
                    const cliente = clientes.find(c => c.id === t.cliente_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">
                          {format(new Date(t.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{cliente?.nome || 'Desconhecido'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            t.transaction_type === 'EARNED' ? 'bg-green-50 text-green-700' :
                              t.transaction_type === 'REDEEMED' ? 'bg-orange-50 text-orange-700' :
                                'bg-red-50 text-red-700'
                          }>
                            {t.transaction_type === 'EARNED' ? 'Ganhou' :
                              t.transaction_type === 'REDEEMED' ? 'Resgatou' : 'Expirou'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(t.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
