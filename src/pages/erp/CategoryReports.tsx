/**
 * Página de Relatórios por Categorias
 * Passo 13: Criar página de relatórios por categorias
 * 
 * Agrupa vendas por categoria/subcategoria e mostra totais, quantidades, ticket médio
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 * 
 * Fix: DollarSign import corrigido
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Calendar, Store, TrendingUp, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CategoryReport {
  categoria: string;
  subcategoria: string | null;
  total_vendas: number;
  quantidade_pedidos: number;
  quantidade_itens: number;
  ticket_medio: number;
}

export default function CategoryReports() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<CategoryReport[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [dateStart, setDateStart] = useState<string>(
    format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  );
  const [dateEnd, setDateEnd] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

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
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (stores.length > 0) {
      fetchReports();
    }
  }, [selectedStore, dateStart, dateEnd, stores]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);

      // Buscar pedidos no período
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('id, valor_total, itens, data_pedido');

      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }

      if (dateStart) {
        query = query.gte('data_pedido', `${dateStart}T00:00:00`);
      }

      if (dateEnd) {
        query = query.lte('data_pedido', `${dateEnd}T23:59:59`);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Processar itens e agrupar por categoria/subcategoria
      const categoryMap = new Map<string, CategoryReport>();

      orders?.forEach((order) => {
        try {
          const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
          const valorTotal = Number(order.valor_total) || 0;

          itens.forEach((item: any) => {
            const categoria = item.categoria || 'Sem Categoria';
            const subcategoria = item.subcategoria || null;
            const key = `${categoria}|${subcategoria || 'null'}`;
            const quantidade = Number(item.quantidade) || 0;
            const valorItem = Number(item.valor_total) || 0;

            if (!categoryMap.has(key)) {
              categoryMap.set(key, {
                categoria,
                subcategoria,
                total_vendas: 0,
                quantidade_pedidos: 0,
                quantidade_itens: 0,
                ticket_medio: 0,
              });
            }

            const report = categoryMap.get(key)!;
            report.total_vendas += valorItem;
            report.quantidade_itens += quantidade;
            if (!report.quantidade_pedidos) {
              report.quantidade_pedidos = 1;
            }
          });
        } catch (error) {
          console.error('Erro ao processar itens do pedido:', error);
        }
      });

      // Calcular ticket médio e ordenar
      const reportsArray = Array.from(categoryMap.values()).map((report) => ({
        ...report,
        ticket_medio: report.quantidade_itens > 0 ? report.total_vendas / report.quantidade_itens : 0,
      }));

      reportsArray.sort((a, b) => b.total_vendas - a.total_vendas);
      setReports(reportsArray);
    } catch (error: any) {
      console.error('Erro ao buscar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalGeral = reports.reduce((sum, r) => sum + r.total_vendas, 0);
  const totalItens = reports.reduce((sum, r) => sum + r.quantidade_itens, 0);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios por Categorias</h1>
          <p className="text-muted-foreground">
            Análise de vendas agrupadas por categoria e subcategoria
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Loja</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGeral)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItens.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Categoria</CardTitle>
          <CardDescription>
            Detalhamento de vendas agrupadas por categoria e subcategoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead className="text-right">Total Vendas</TableHead>
                    <TableHead className="text-right">Qtd. Itens</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report, index) => {
                    const percentual = totalGeral > 0 ? (report.total_vendas / totalGeral) * 100 : 0;
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{report.categoria}</TableCell>
                        <TableCell>
                          {report.subcategoria ? (
                            <Badge variant="outline">{report.subcategoria}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(report.total_vendas)}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.quantidade_itens.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(report.ticket_medio)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{percentual.toFixed(1)}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

