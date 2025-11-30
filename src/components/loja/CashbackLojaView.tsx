/**
 * Componente de Cashback para Visão Loja
 * Layout IDÊNTICO ao ERP, mas sem Bonificar e Configurações
 * 3 Tabs: Lançar, Clientes, Histórico Geral
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
  Filter,
  Calendar,
  X,
  Plus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  // Estados para Lançar
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteLancar, setSelectedClienteLancar] = useState('');
  const [valorLancar, setValorLancar] = useState('');
  const [descricaoLancar, setDescricaoLancar] = useState('');
  const [lancando, setLancando] = useState(false);
  const [searchClienteLancar, setSearchClienteLancar] = useState('');

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
  const [filterClientSearch, setFilterClientSearch] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Estados para filtros avançados de clientes
  interface FiltroCliente {
    tipo: 'categoria' | 'com_saldo' | 'sem_saldo';
    categoria?: string;
  }
  const [filtrosClientes, setFiltrosClientes] = useState<FiltroCliente[]>([]);
  const [modoFiltro, setModoFiltro] = useState<'AND' | 'OR'>('AND');

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
          tiny_order:tiny_order_id (numero_pedido)
        `)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Buscar pedidos desta loja para calcular categoria
      const parseMoney = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        if (typeof val === 'string') {
          const clean = val.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      // Buscar pedidos para calcular categoria
      const { data: ordersData, error: ordersError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, valor_total');

      if (ordersError) console.error('Erro ao buscar pedidos:', ordersError);

      // Calcular total de compras por cliente NESTA loja
      const totalComprasPorCliente = new Map<string, number>();
      ordersData?.forEach((order: any) => {
        if (order.cliente_id && order.valor_total) {
          const valor = parseMoney(order.valor_total);
          if (valor > 0) {
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
        total_gerado: totalGerado,
        total_clientes: allClientes?.length || 0,
        total_resgatado: totalResgatado,
        a_vencer_7d: aVencer,
      });

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Lançar
  const handleLancar = async () => {
    if (!selectedClienteLancar || !valorLancar || parseFloat(valorLancar) <= 0) {
      toast.error('Preencha cliente e valor da compra');
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
        percentual_cashback: 15,
        prazo_liberacao_dias: 2,
        prazo_expiracao_dias: 30,
      };

      const valorCompra = parseFloat(valorLancar);
      // Arredondar para cima (sem centavos) - Exemplo: 152.15 -> 153 | 77.07 -> 78
      const cashbackAmount = Math.ceil((valorCompra * Number(settings.percentual_cashback)) / 100);

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
          amount: cashbackAmount,
          description: descricaoLancar || 'Lançamento manual',
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
        });

      if (error) throw error;

      toast.success(`✅ Cashback de ${formatCurrency(cashbackAmount)} lançado com sucesso!`);
      setSelectedClienteLancar('');
      setValorLancar('');
      setDescricaoLancar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao lançar:', error);
      toast.error('Erro ao lançar cashback: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLancando(false);
    }
  };

  // Lógica de Resgatar
  const handleResgatar = async () => {
    if (!selectedClienteResgatar || !valorResgatar || parseFloat(valorResgatar) <= 0) {
      toast.error('Preencha cliente e valor a resgatar');
      return;
    }

    const clienteSaldo = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
    const saldoDisponivel = clienteSaldo?.saldo_disponivel || 0;
    const valorResgate = parseFloat(valorResgatar);

    if (valorResgate > saldoDisponivel) {
      toast.error(`Saldo insuficiente. Disponível: ${formatCurrency(saldoDisponivel)}`);
      return;
    }

    setResgatando(true);
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteResgatar,
          tiny_order_id: null,
          transaction_type: 'REDEEMED',
          amount: valorResgate,
          description: descricaoResgatar || 'Resgate manual',
          data_liberacao: null,
          data_expiracao: null,
        });

      if (error) throw error;

      toast.success(`✅ ${formatCurrency(valorResgate)} resgatado com sucesso!`);
      setSelectedClienteResgatar('');
      setValorResgatar('');
      setDescricaoResgatar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao resgatar:', error);
      toast.error('Erro ao resgatar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setResgatando(false);
    }
  };

  // Filtros
  const filteredClientesLancar = useMemo(() => {
    if (!searchClienteLancar) return [];
    const term = searchClienteLancar.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.cpf_cnpj?.toLowerCase().includes(term) ||
      c.telefone?.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [searchClienteLancar, clientes]);

  const filteredClientesResgatar = useMemo(() => {
    if (!searchClienteResgatar) return [];
    const term = searchClienteResgatar.toLowerCase();
    return clientes
      .filter(c =>
        c.nome.toLowerCase().includes(term) ||
        c.cpf_cnpj?.toLowerCase().includes(term) ||
        c.telefone?.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [searchClienteResgatar, clientes]);

  const clientesFiltrados = useMemo(() => {
    let filtered = clientesComSaldo;

    // Filtro por busca de texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cs =>
        cs.cliente.nome.toLowerCase().includes(term) ||
        cs.cliente.cpf_cnpj?.toLowerCase().includes(term) ||
        cs.cliente.telefone?.toLowerCase().includes(term)
      );
    }

    // Aplicar filtros avançados
    if (filtrosClientes.length > 0) {
      if (modoFiltro === 'AND') {
        // Todos os filtros devem ser satisfeitos
        filtrosClientes.forEach(filtro => {
          switch (filtro.tipo) {
            case 'categoria':
              if (filtro.categoria) {
                filtered = filtered.filter(cs => cs.cliente.categoria === filtro.categoria);
              }
              break;
            case 'com_saldo':
              filtered = filtered.filter(cs => cs.saldo_disponivel > 0);
              break;
            case 'sem_saldo':
              filtered = filtered.filter(cs => cs.saldo_disponivel === 0);
              break;
          }
        });
      } else {
        // Pelo menos um filtro deve ser satisfeito (OR)
        const resultSets: ClienteComSaldo[][] = [];
        filtrosClientes.forEach(filtro => {
          let tempFiltered = clientesComSaldo;
          switch (filtro.tipo) {
            case 'categoria':
              if (filtro.categoria) {
                tempFiltered = tempFiltered.filter(cs => cs.cliente.categoria === filtro.categoria);
              }
              break;
            case 'com_saldo':
              tempFiltered = tempFiltered.filter(cs => cs.saldo_disponivel > 0);
              break;
            case 'sem_saldo':
              tempFiltered = tempFiltered.filter(cs => cs.saldo_disponivel === 0);
              break;
          }
          resultSets.push(tempFiltered);
        });
        // União de todos os resultados
        const uniqueIds = new Set<string>();
        resultSets.forEach(set => {
          set.forEach(cs => uniqueIds.add(cs.cliente.id));
        });
        filtered = clientesComSaldo.filter(cs => uniqueIds.has(cs.cliente.id));
      }
    }

    return filtered;
  }, [searchTerm, clientesComSaldo, filtrosClientes, modoFiltro]);

  const historicoFiltrado = useMemo(() => {
    let filtered = historicoGeral;

    // Filtro por tipo
    if (filtroHistorico === 'ganhou') {
      filtered = filtered.filter(t => t.transaction_type === 'EARNED');
    } else if (filtroHistorico === 'resgatou') {
      filtered = filtered.filter(t => t.transaction_type === 'REDEEMED');
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

    // Filtro por data
    if (filterDateStart) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.created_at) <= endDate);
    }

    return filtered;
  }, [filtroHistorico, historicoGeral, filterClientSearch, filterDateStart, filterDateEnd, clientes]);

  const cashbackPreview = useMemo(() => {
    if (!valorLancar || parseFloat(valorLancar) <= 0) return 0;
    return (parseFloat(valorLancar) * 15) / 100; // Padrão 15%
  }, [valorLancar]);

  const saldoClienteResgatar = useMemo(() => {
    if (!selectedClienteResgatar) return 0;
    const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
    return cliente?.saldo_disponivel || 0;
  }, [selectedClienteResgatar, clientesComSaldo]);

  const toggleClientExpansion = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  // Funções para gerenciar filtros de clientes
  const adicionarFiltro = () => {
    setFiltrosClientes([...filtrosClientes, { tipo: 'com_saldo' }]);
  };

  const removerFiltro = (index: number) => {
    setFiltrosClientes(filtrosClientes.filter((_, i) => i !== index));
  };

  const atualizarFiltro = (index: number, updates: Partial<FiltroCliente>) => {
    const novosFiltros = [...filtrosClientes];
    novosFiltros[index] = { ...novosFiltros[index], ...updates };
    setFiltrosClientes(novosFiltros);
  };

  const limparFiltros = () => {
    setFiltrosClientes([]);
    setFilterClientSearch('');
    setFilterDateStart('');
    setFilterDateEnd('');
  };

  const getCategoriaColor = (categoria: string | null | undefined) => {
    switch (categoria) {
      case 'BLACK': return 'bg-black text-white';
      case 'PLATINUM': return 'bg-gray-400 text-white';
      case 'VIP': return 'bg-yellow-500 text-white';
      case 'REGULAR': return 'bg-blue-500 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Gift className="h-8 w-8 text-primary" />
          Gestão de Cashback
        </h1>
        <p className="text-muted-foreground">Gerencie o programa de cashback dos seus clientes</p>
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
                  {!selectedClienteLancar ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cliente-lancar"
                          placeholder="Digite nome, CPF ou telefone..."
                          value={searchClienteLancar}
                          onChange={(e) => setSearchClienteLancar(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchClienteLancar && filteredClientesLancar.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          {filteredClientesLancar.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClienteLancar(c.id);
                                setSearchClienteLancar('');
                              }}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-sm text-muted-foreground">{c.cpf_cnpj}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchClienteLancar && filteredClientesLancar.length === 0 && (
                        <div className="text-sm text-muted-foreground p-2">Nenhum cliente encontrado</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{clientes.find(c => c.id === selectedClienteLancar)?.nome}</div>
                        <div className="text-sm text-muted-foreground">{clientes.find(c => c.id === selectedClienteLancar)?.cpf_cnpj}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClienteLancar('')}
                      >
                        Alterar
                      </Button>
                    </div>
                  )}
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
                  {!selectedClienteResgatar ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cliente-resgatar"
                          placeholder="Digite nome, CPF ou telefone..."
                          value={searchClienteResgatar}
                          onChange={(e) => setSearchClienteResgatar(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchClienteResgatar && filteredClientesResgatar.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          {filteredClientesResgatar.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClienteResgatar(c.id);
                                setSearchClienteResgatar('');
                              }}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-sm text-muted-foreground">{c.cpf_cnpj}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchClienteResgatar && filteredClientesResgatar.length === 0 && (
                        <div className="text-sm text-muted-foreground p-2">Nenhum cliente encontrado</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{clientes.find(c => c.id === selectedClienteResgatar)?.nome}</div>
                        <div className="text-sm text-muted-foreground">{clientes.find(c => c.id === selectedClienteResgatar)?.cpf_cnpj}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClienteResgatar('')}
                      >
                        Alterar
                      </Button>
                    </div>
                  )}
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

                <div className="p-3 bg-orange-50 rounded-lg space-y-1">
                  <p className="text-sm text-orange-800">
                    Saldo disponível: <strong>{formatCurrency(saldoClienteResgatar)}</strong>
                  </p>
                  {selectedClienteResgatar && (() => {
                    const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
                    const saldoPendente = cliente?.saldo_pendente || 0;
                    if (saldoPendente > 0) {
                      return (
                        <p className="text-xs text-orange-700">
                          ⏳ Pendente: {formatCurrency(saldoPendente)} (será liberado em até 2 dias)
                        </p>
                      );
                    }
                    return null;
                  })()}
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
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filtros Avançados */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filtros Avançados
                    </Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Modo:</Label>
                      <Select
                        value={modoFiltro}
                        onValueChange={(v: 'AND' | 'OR') => setModoFiltro(v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">E (AND)</SelectItem>
                          <SelectItem value="OR">OU (OR)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={adicionarFiltro} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Filtros */}
                  {filtrosClientes.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum filtro adicionado. Clique em "Adicionar" para começar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtrosClientes.map((filtro, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                          <Select
                            value={filtro.tipo}
                            onValueChange={(v: any) => atualizarFiltro(index, { tipo: v })}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="categoria">Categoria</SelectItem>
                              <SelectItem value="com_saldo">Com Saldo</SelectItem>
                              <SelectItem value="sem_saldo">Sem Saldo</SelectItem>
                            </SelectContent>
                          </Select>

                          {filtro.tipo === 'categoria' && (
                            <Select
                              value={filtro.categoria || ''}
                              onValueChange={(v) => atualizarFiltro(index, { categoria: v })}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BLACK">BLACK</SelectItem>
                                <SelectItem value="PLATINUM">PLATINUM</SelectItem>
                                <SelectItem value="VIP">VIP</SelectItem>
                                <SelectItem value="REGULAR">REGULAR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerFiltro(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lista de Clientes */}
                <div className="space-y-2">
                  {clientesFiltrados.map(cs => (
                    <Collapsible key={cs.cliente.id}>
                      <div className="border rounded-lg p-4">
                        <CollapsibleTrigger
                          onClick={() => toggleClientExpansion(cs.cliente.id)}
                          className="w-full"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {expandedClients.has(cs.cliente.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <div className="text-left">
                                <div className="font-medium">{cs.cliente.nome}</div>
                                <div className="text-sm text-muted-foreground">{cs.cliente.cpf_cnpj}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {cs.cliente.categoria && (
                                <Badge className={getCategoriaColor(cs.cliente.categoria)}>
                                  {cs.cliente.categoria}
                                </Badge>
                              )}
                              <div className="text-right">
                                <div className="text-sm font-medium text-green-600">
                                  {formatCurrency(cs.saldo_disponivel)}
                                </div>
                                {cs.saldo_pendente > 0 && (
                                  <div className="text-xs text-orange-600">
                                    +{formatCurrency(cs.saldo_pendente)} pendente
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="font-semibold mb-2">Histórico de Transações</h4>
                            {cs.transactions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma transação</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Descrição</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cs.transactions.slice(0, 5).map(t => (
                                    <TableRow key={t.id}>
                                      <TableCell className="text-sm">
                                        {format(new Date(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                                      </TableCell>
                                      <TableCell>
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
                                      </TableCell>
                                      <TableCell className={t.transaction_type === 'EARNED' ? 'text-green-600' : 'text-orange-600'}>
                                        {t.transaction_type === 'EARNED' ? '+' : '-'}{formatCurrency(t.amount)}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {t.description || '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
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
                {/* Filtros Avançados */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                  {/* Filtros de Tipo */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Tipo
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant={filtroHistorico === 'todos' ? 'default' : 'outline'}
                        onClick={() => setFiltroHistorico('todos')}
                        size="sm"
                        className="flex-1"
                      >
                        Todos
                      </Button>
                      <Button
                        variant={filtroHistorico === 'ganhou' ? 'default' : 'outline'}
                        onClick={() => setFiltroHistorico('ganhou')}
                        size="sm"
                        className="flex-1"
                      >
                        Ganhou
                      </Button>
                      <Button
                        variant={filtroHistorico === 'resgatou' ? 'default' : 'outline'}
                        onClick={() => setFiltroHistorico('resgatou')}
                        size="sm"
                        className="flex-1"
                      >
                        Resgatou
                      </Button>
                    </div>
                  </div>

                  {/* Busca por Cliente */}
                  <div className="space-y-2">
                    <Label htmlFor="filter-client" className="text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Cliente
                    </Label>
                    <div className="relative">
                      <Input
                        id="filter-client"
                        placeholder="Nome ou CPF..."
                        value={filterClientSearch}
                        onChange={(e) => setFilterClientSearch(e.target.value)}
                        className="pr-8"
                      />
                      {filterClientSearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-2"
                          onClick={() => setFilterClientSearch('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Data Início */}
                  <div className="space-y-2">
                    <Label htmlFor="filter-date-start" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data Início
                    </Label>
                    <Input
                      id="filter-date-start"
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                    />
                  </div>

                  {/* Data Fim */}
                  <div className="space-y-2">
                    <Label htmlFor="filter-date-end" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data Fim
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="filter-date-end"
                        type="date"
                        value={filterDateEnd}
                        onChange={(e) => setFilterDateEnd(e.target.value)}
                        className="flex-1"
                      />
                      {(filterClientSearch || filterDateStart || filterDateEnd) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={limparFiltros}
                          className="px-3"
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
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
                      <TableHead>Validade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoFiltrado.slice(0, 50).map(t => {
                      const cliente = clientes.find(c => c.id === t.cliente_id);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">
                            {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{cliente?.nome || 'Cliente não encontrado'}</div>
                            <div className="text-sm text-muted-foreground">{cliente?.cpf_cnpj}</div>
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell className={t.transaction_type === 'EARNED' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                            {t.transaction_type === 'EARNED' ? '+' : '-'}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.data_expiracao ? format(new Date(t.data_expiracao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
