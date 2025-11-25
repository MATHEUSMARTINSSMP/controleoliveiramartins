/**
 * Sistema de Relatórios Inteligentes de Vendas de Produtos
 * 
 * Análise avançada de produtos vendidos com dezenas de filtros e visualizações
 * Foco: Produtos vendidos (não estoque)
 * 
 * Funcionalidades:
 * - Marca mais vendida
 * - Tamanho mais vendido por categoria/marca
 * - Cor mais vendida
 * - Análise por múltiplos períodos
 * - Dezenas de filtros combináveis
 * - Visualizações intuitivas
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Package, Filter, BarChart3, PieChart, Calendar, Store, User, Search } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ProductSale {
  id: string;
  categoria: string | null;
  subcategoria: string | null;
  marca: string | null;
  tamanho: string | null;
  cor: string | null;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  data_pedido: string;
  store_id: string;
  colaboradora_id: string | null;
  vendedor_nome: string | null;
}

interface AggregatedProduct {
  categoria: string;
  subcategoria: string | null;
  marca: string | null;
  tamanho: string | null;
  cor: string | null;
  codigo: string | null;
  descricao: string | null;
  total_vendas: number;
  quantidade_vendida: number;
  quantidade_pedidos: number;
  ticket_medio: number;
  primeiro_vendido: string | null;
  ultimo_vendido: string | null;
}

type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';

export default function ProductSalesIntelligence() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rawSales, setRawSales] = useState<ProductSale[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [colaboradoras, setColaboradoras] = useState<Array<{ id: string; name: string }>>([]);
  
  // Filtros
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last30');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros de produto
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>('all');
  const [filterMarca, setFilterMarca] = useState<string>('all');
  const [filterTamanho, setFilterTamanho] = useState<string>('all');
  const [filterCor, setFilterCor] = useState<string>('all');
  const [filterGenero, setFilterGenero] = useState<string>('all');
  
  // Opções únicas para filtros
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [uniqueSubcategories, setUniqueSubcategories] = useState<string[]>([]);
  const [uniqueMarcas, setUniqueMarcas] = useState<string[]>([]);
  const [uniqueTamanhos, setUniqueTamanhos] = useState<string[]>([]);
  const [uniqueCores, setUniqueCores] = useState<string[]>([]);
  const [uniqueGeneros, setUniqueGeneros] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      navigate('/erp/login');
      return;
    }

    // Apenas ADMIN e LOJA podem acessar ERP
    if (profile.role !== 'ADMIN' && profile.role !== 'LOJA') {
      navigate('/erp/login');
      return;
    }

    fetchStores();
    fetchColaboradoras();
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (periodPreset !== 'custom') {
      updateDatesFromPreset();
    }
  }, [periodPreset]);

  useEffect(() => {
    if (dateStart && dateEnd) {
      fetchSales();
    }
  }, [selectedStore, selectedColaboradora, dateStart, dateEnd]);

  useEffect(() => {
    if (rawSales.length > 0) {
      extractUniqueValues();
    }
  }, [rawSales]);

  const updateDatesFromPreset = () => {
    const today = new Date();
    let start: Date, end: Date = today;

    switch (periodPreset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        start = subDays(today, 1);
        end = subDays(today, 1);
        break;
      case 'last7':
        start = subDays(today, 7);
        end = today;
        break;
      case 'last30':
        start = subDays(today, 30);
        end = today;
        break;
      case 'last90':
        start = subDays(today, 90);
        end = today;
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(today, 1));
        end = endOfMonth(subMonths(today, 1));
        break;
      case 'thisYear':
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case 'lastYear':
        start = startOfYear(subMonths(today, 12));
        end = endOfYear(subMonths(today, 12));
        break;
      default:
        return;
    }

    setDateStart(format(start, 'yyyy-MM-dd'));
    setDateEnd(format(end, 'yyyy-MM-dd'));
  };

  const fetchStores = async () => {
    try {
      let query = supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (profile?.role === 'LOJA' && profile.store_id) {
        query = query.eq('id', profile.store_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
    }
  };

  const fetchColaboradoras = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .eq('role', 'COLABORADORA')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setColaboradoras(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar colaboradoras:', error);
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('id, store_id, data_pedido, itens, colaboradora_id, vendedor_nome')
        .gte('data_pedido', `${dateStart}T00:00:00`)
        .lte('data_pedido', `${dateEnd}T23:59:59`);

      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      // Processar itens de todos os pedidos
      const allSales: ProductSale[] = [];

      orders?.forEach((order) => {
        try {
          const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
          
          itens.forEach((item: any) => {
            const quantidade = Number(item.quantidade) || 0;
            const valorUnitario = Number(item.valor_unitario) || 0;
            const valorTotal = Number(item.valor_total) || quantidade * valorUnitario;

            allSales.push({
              id: `${order.id}-${item.codigo || Math.random()}`,
              categoria: item.categoria || 'Sem Categoria',
              subcategoria: item.subcategoria || null,
              marca: item.marca || null,
              tamanho: item.tamanho || null,
              cor: item.cor || null,
              codigo: item.codigo || null,
              descricao: item.descricao || null,
              quantidade,
              valor_unitario: valorUnitario,
              valor_total: valorTotal,
              data_pedido: order.data_pedido,
              store_id: order.store_id,
              colaboradora_id: order.colaboradora_id,
              vendedor_nome: order.vendedor_nome,
            });
          });
        } catch (error) {
          console.error('Erro ao processar itens do pedido:', error);
        }
      });

      setRawSales(allSales);
    } catch (error: any) {
      console.error('Erro ao buscar vendas:', error);
      toast.error('Erro ao carregar dados de vendas');
    } finally {
      setLoading(false);
    }
  };

  const extractUniqueValues = () => {
    const categories = new Set<string>();
    const subcategories = new Set<string>();
    const marcas = new Set<string>();
    const tamanhos = new Set<string>();
    const cores = new Set<string>();
    const generos = new Set<string>();

    rawSales.forEach((sale) => {
      if (sale.categoria) categories.add(sale.categoria);
      if (sale.subcategoria) subcategories.add(sale.subcategoria);
      if (sale.marca) marcas.add(sale.marca);
      if (sale.tamanho) tamanhos.add(sale.tamanho);
      if (sale.cor) cores.add(sale.cor);
    });

    setUniqueCategories(Array.from(categories).sort());
    setUniqueSubcategories(Array.from(subcategories).sort());
    setUniqueMarcas(Array.from(marcas).sort());
    setUniqueTamanhos(Array.from(tamanhos).sort());
    setUniqueCores(Array.from(cores).sort());
    setUniqueGeneros(Array.from(generos).sort());
  };

  // Filtrar e agregar vendas
  const filteredAndAggregated = useMemo(() => {
    let filtered = [...rawSales];

    // Filtros básicos
    if (selectedStore !== 'all') {
      filtered = filtered.filter((s) => s.store_id === selectedStore);
    }

    if (selectedColaboradora !== 'all') {
      filtered = filtered.filter((s) => s.colaboradora_id === selectedColaboradora);
    }

    // Filtros de produto
    if (filterCategoria !== 'all') {
      filtered = filtered.filter((s) => s.categoria === filterCategoria);
    }

    if (filterSubcategoria !== 'all') {
      filtered = filtered.filter((s) => s.subcategoria === filterSubcategoria);
    }

    if (filterMarca !== 'all') {
      filtered = filtered.filter((s) => s.marca === filterMarca);
    }

    if (filterTamanho !== 'all') {
      filtered = filtered.filter((s) => s.tamanho === filterTamanho);
    }

    if (filterCor !== 'all') {
      filtered = filtered.filter((s) => s.cor === filterCor);
    }

    // Busca por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.descricao?.toLowerCase().includes(term) ||
          s.codigo?.toLowerCase().includes(term) ||
          s.marca?.toLowerCase().includes(term) ||
          s.categoria?.toLowerCase().includes(term)
      );
    }

    // Agregar por produto
    const aggregated = new Map<string, AggregatedProduct>();

    filtered.forEach((sale) => {
      const key = `${sale.codigo || sale.descricao || 'unknown'}-${sale.marca || 'no-brand'}-${sale.tamanho || 'no-size'}-${sale.cor || 'no-color'}`;
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          categoria: sale.categoria || 'Sem Categoria',
          subcategoria: sale.subcategoria,
          marca: sale.marca,
          tamanho: sale.tamanho,
          cor: sale.cor,
          codigo: sale.codigo,
          descricao: sale.descricao,
          total_vendas: 0,
          quantidade_vendida: 0,
          quantidade_pedidos: 0,
          ticket_medio: 0,
          primeiro_vendido: sale.data_pedido,
          ultimo_vendido: sale.data_pedido,
        });
      }

      const agg = aggregated.get(key)!;
      agg.total_vendas += sale.valor_total;
      agg.quantidade_vendida += sale.quantidade;
      agg.quantidade_pedidos += 1;
      if (sale.data_pedido < agg.primeiro_vendido!) {
        agg.primeiro_vendido = sale.data_pedido;
      }
      if (sale.data_pedido > agg.ultimo_vendido!) {
        agg.ultimo_vendido = sale.data_pedido;
      }
    });

    // Calcular ticket médio
    Array.from(aggregated.values()).forEach((agg) => {
      agg.ticket_medio = agg.quantidade_vendida > 0 ? agg.total_vendas / agg.quantidade_vendida : 0;
    });

    return Array.from(aggregated.values()).sort((a, b) => b.total_vendas - a.total_vendas);
  }, [rawSales, selectedStore, selectedColaboradora, filterCategoria, filterSubcategoria, filterMarca, filterTamanho, filterCor, searchTerm]);

  // Análises inteligentes
  const topMarcas = useMemo(() => {
    const marcaMap = new Map<string, { total: number; quantidade: number }>();
    filteredAndAggregated.forEach((agg) => {
      if (!agg.marca) return;
      if (!marcaMap.has(agg.marca)) {
        marcaMap.set(agg.marca, { total: 0, quantidade: 0 });
      }
      const m = marcaMap.get(agg.marca)!;
      m.total += agg.total_vendas;
      m.quantidade += agg.quantidade_vendida;
    });
    return Array.from(marcaMap.entries())
      .map(([marca, data]) => ({ marca, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredAndAggregated]);

  const topTamanhos = useMemo(() => {
    const tamanhoMap = new Map<string, { total: number; quantidade: number }>();
    filteredAndAggregated.forEach((agg) => {
      if (!agg.tamanho) return;
      if (!tamanhoMap.has(agg.tamanho)) {
        tamanhoMap.set(agg.tamanho, { total: 0, quantidade: 0 });
      }
      const t = tamanhoMap.get(agg.tamanho)!;
      t.total += agg.total_vendas;
      t.quantidade += agg.quantidade_vendida;
    });
    return Array.from(tamanhoMap.entries())
      .map(([tamanho, data]) => ({ tamanho, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredAndAggregated]);

  const topCores = useMemo(() => {
    const corMap = new Map<string, { total: number; quantidade: number }>();
    filteredAndAggregated.forEach((agg) => {
      if (!agg.cor) return;
      if (!corMap.has(agg.cor)) {
        corMap.set(agg.cor, { total: 0, quantidade: 0 });
      }
      const c = corMap.get(agg.cor)!;
      c.total += agg.total_vendas;
      c.quantidade += agg.quantidade_vendida;
    });
    return Array.from(corMap.entries())
      .map(([cor, data]) => ({ cor, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredAndAggregated]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalGeral = filteredAndAggregated.reduce((sum, a) => sum + a.total_vendas, 0);
  const totalQuantidade = filteredAndAggregated.reduce((sum, a) => sum + a.quantidade_vendida, 0);

  if (loading && rawSales.length === 0) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inteligência de Vendas de Produtos</h1>
          <p className="text-muted-foreground">
            Análise avançada e inteligente de produtos vendidos
          </p>
        </div>
      </div>

      {/* Filtros Principais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="last90">Últimos 90 dias</SelectItem>
                  <SelectItem value="thisMonth">Este mês</SelectItem>
                  <SelectItem value="lastMonth">Mês passado</SelectItem>
                  <SelectItem value="thisYear">Este ano</SelectItem>
                  <SelectItem value="lastYear">Ano passado</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodPreset === 'custom' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Data Início</label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Data Fim</label>
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Loja</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Vendedor</label>
              <Select value={selectedColaboradora} onValueChange={setSelectedColaboradora}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {colaboradoras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros de Produto */}
          <div className="mt-4 grid gap-4 md:grid-cols-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Categoria</label>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Subcategoria</label>
              <Select value={filterSubcategoria} onValueChange={setFilterSubcategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueSubcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Marca</label>
              <Select value={filterMarca} onValueChange={setFilterMarca}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueMarcas.map((marca) => (
                    <SelectItem key={marca} value={marca}>
                      {marca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tamanho</label>
              <Select value={filterTamanho} onValueChange={setFilterTamanho}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueTamanhos.map((tamanho) => (
                    <SelectItem key={tamanho} value={tamanho}>
                      {tamanho}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cor</label>
              <Select value={filterCor} onValueChange={setFilterCor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueCores.map((cor) => (
                    <SelectItem key={cor} value={cor}>
                      {cor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Código, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGeral)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredAndAggregated.length} produtos únicos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade Vendida</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantidade.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">unidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuantidade > 0 ? formatCurrency(totalGeral / totalQuantidade) : 'R$ 0,00'}
            </div>
            <p className="text-xs text-muted-foreground">por unidade</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Únicos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAndAggregated.length}</div>
            <p className="text-xs text-muted-foreground">diferentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Análises Inteligentes */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
          <TabsTrigger value="colors">Cores</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>
                Ranking completo de produtos por valor total de vendas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead className="text-right">Qtd. Vendida</TableHead>
                      <TableHead className="text-right">Total Vendas</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndAggregated.slice(0, 50).map((agg, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{agg.descricao || agg.codigo || 'Sem descrição'}</div>
                            {agg.codigo && (
                              <div className="text-xs text-muted-foreground">Cód: {agg.codigo}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{agg.categoria}</Badge>
                          {agg.subcategoria && (
                            <Badge variant="secondary" className="ml-1">{agg.subcategoria}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{agg.marca || '-'}</TableCell>
                        <TableCell>{agg.tamanho || '-'}</TableCell>
                        <TableCell>{agg.cor || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {agg.quantidade_vendida.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(agg.total_vendas)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(agg.ticket_medio)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Marcas Mais Vendidas</CardTitle>
              <CardDescription>
                Análise de vendas por marca
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Total Vendas</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topMarcas.map((marca, index) => (
                      <TableRow key={marca.marca}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell className="font-medium">{marca.marca}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(marca.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {marca.quantidade.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(marca.quantidade > 0 ? marca.total / marca.quantidade : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sizes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tamanhos Mais Vendidos</CardTitle>
              <CardDescription>
                Análise de vendas por tamanho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Total Vendas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topTamanhos.map((tamanho, index) => (
                      <TableRow key={tamanho.tamanho}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell className="font-medium">{tamanho.tamanho}</TableCell>
                        <TableCell className="text-right font-medium">
                          {tamanho.quantidade.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(tamanho.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cores Mais Vendidas</CardTitle>
              <CardDescription>
                Análise de vendas por cor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Total Vendas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCores.map((cor, index) => (
                      <TableRow key={cor.cor}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell className="font-medium">{cor.cor}</TableCell>
                        <TableCell className="text-right font-medium">
                          {cor.quantidade.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(cor.total)}
                        </TableCell>
                      </TableRow>
                    ))}
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

