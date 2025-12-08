/**
 * Página de Relatórios ERP
 * 
 * Múltiplas visões de relatórios de vendas:
 * - Por Categorias
 * - Por Produtos
 * - Por Marcas
 * - Por Vendedores
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Calendar, Store, TrendingUp, DollarSign, ArrowLeft, Package, Tag, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface CategoryReport {
  categoria: string;
  subcategoria: string | null;
  total_vendas: number;
  quantidade_pedidos: number;
  quantidade_itens: number;
  ticket_medio: number;
}

interface ProductSale {
  produto_id: string | null;
  codigo: string | null;
  descricao: string | null;
  categoria: string | null;
  marca: string | null;
  quantidade: number;
  valor_total: number;
  cliente_nome: string | null;
  numero_pedido: string | null;
  data_pedido: string | null;
  order_id: string;
}

interface ProductReport {
  produto_id: string | null;
  codigo: string | null;
  descricao: string | null;
  categoria: string | null;
  marca: string | null;
  total_vendas: number;
  quantidade_vendida: number;
  vendas: ProductSale[]; // Lista de vendas individuais
}

interface BrandReport {
  marca: string;
  total_vendas: number;
  quantidade_vendida: number;
  quantidade_pedidos: number;
  ticket_medio: number;
}

interface SellerReport {
  vendedor_nome: string | null;
  colaboradora_id: string | null;
  total_vendas: number;
  quantidade_pedidos: number;
  ticket_medio: number;
}

export default function CategoryReports() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categorias');
  
  // Dados
  const [categoryReports, setCategoryReports] = useState<CategoryReport[]>([]);
  const [productReports, setProductReports] = useState<ProductReport[]>([]);
  const [allProductSalesSorted, setAllProductSalesSorted] = useState<ProductSale[]>([]); // Lista plana ordenada
  const [brandReports, setBrandReports] = useState<BrandReport[]>([]);
  const [sellerReports, setSellerReports] = useState<SellerReport[]>([]);
  
  // Filtros
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
  }, [selectedStore, dateStart, dateEnd, stores, activeTab]);

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
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);

      console.log('[Relatórios] 🔍 Iniciando busca de relatórios...', {
        selectedStore,
        dateStart,
        dateEnd,
      });

      // Primeiro, verificar se há pedidos no banco (sem filtros de data para diagnóstico)
      const { count: totalOrdersCount, error: totalError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('[Relatórios] ❌ Erro ao contar pedidos totais:', totalError);
      } else {
        console.log(`[Relatórios] 📊 Total de pedidos no banco: ${totalOrdersCount || 0}`);
      }

      // Buscar pedidos no período
      // ✅ IMPORTANTE: Selecionar todos os campos necessários, incluindo numero_pedido e cliente_nome
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('id, valor_total, itens, data_pedido, numero_pedido, cliente_nome, vendedor_nome, colaboradora_id, store_id');

      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
        console.log(`[Relatórios] 🔍 Filtrando por loja: ${selectedStore}`);
      }

      if (dateStart) {
        const dateStartFormatted = `${dateStart}T00:00:00`;
        query = query.gte('data_pedido', dateStartFormatted);
        console.log(`[Relatórios] 🔍 Data início: ${dateStartFormatted}`);
      }

      if (dateEnd) {
        const dateEndFormatted = `${dateEnd}T23:59:59`;
        query = query.lte('data_pedido', dateEndFormatted);
        console.log(`[Relatórios] 🔍 Data fim: ${dateEndFormatted}`);
      }

      console.log('[Relatórios] 🔍 Executando query...');
      const { data: orders, error } = await query;

      if (error) throw error;

      console.log(`[Relatórios] 📊 Total de pedidos encontrados: ${orders?.length || 0}`);
      
      if (orders && orders.length > 0) {
        const primeiroPedido = orders[0];
        console.log(`[Relatórios] 📦 Primeiro pedido (exemplo):`, {
          id: primeiroPedido.id,
          valor_total: primeiroPedido.valor_total,
          data_pedido: primeiroPedido.data_pedido,
          itens_tipo: typeof primeiroPedido.itens,
          itens_is_null: primeiroPedido.itens === null,
          itens_is_undefined: primeiroPedido.itens === undefined,
          itens_length: primeiroPedido.itens ? (typeof primeiroPedido.itens === 'string' ? primeiroPedido.itens.length : Array.isArray(primeiroPedido.itens) ? primeiroPedido.itens.length : 'não é string nem array') : 'null/undefined',
          itens_preview: typeof primeiroPedido.itens === 'string' 
            ? primeiroPedido.itens.substring(0, 500) 
            : Array.isArray(primeiroPedido.itens)
            ? JSON.stringify(primeiroPedido.itens.slice(0, 2), null, 2)
            : JSON.stringify(primeiroPedido.itens).substring(0, 500),
        });
        
        // Tentar parsear e mostrar estrutura
        try {
          const itensParsed = typeof primeiroPedido.itens === 'string' 
            ? JSON.parse(primeiroPedido.itens) 
            : primeiroPedido.itens;
          
          if (Array.isArray(itensParsed) && itensParsed.length > 0) {
            console.log(`[Relatórios] 🔍 Primeiro item parseado:`, {
              keys: Object.keys(itensParsed[0]),
              item_completo: JSON.stringify(itensParsed[0], null, 2),
            });
          }
        } catch (e) {
          console.error('[Relatórios] ❌ Erro ao parsear itens:', e);
        }
      } else {
        console.warn('[Relatórios] ⚠️ Nenhum pedido retornado da query');
      }

      if (!orders || orders.length === 0) {
        console.warn('[Relatórios] ⚠️ Nenhum pedido encontrado para o período');
        setCategoryReports([]);
        setProductReports([]);
        setBrandReports([]);
        setSellerReports([]);
        return;
      }

      // Processar itens de todos os pedidos
      const allItems: any[] = [];
      const orderMap = new Map<string, number>(); // Para contar pedidos únicos

      orders.forEach((order) => {
        try {
          const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
          
          if (!Array.isArray(itens)) {
            console.warn('[Relatórios] ⚠️ Itens não é um array:', typeof itens, itens);
            return;
          }

          console.log(`[Relatórios] 📦 Pedido ${order.id}: ${itens.length} itens`);
          
          itens.forEach((item: any, index: number) => {
            // Log detalhado do primeiro item do primeiro pedido
            if (order.id === orders[0]?.id && index === 0) {
              console.log('[Relatórios] 🔍 Estrutura do primeiro item:', {
                keys: Object.keys(item),
                categoria: item.categoria,
                categoria_tipo: typeof item.categoria,
                categoria_nome: item.categoria?.nome,
                subcategoria: item.subcategoria,
                marca: item.marca,
                marca_tipo: typeof item.marca,
                marca_nome: item.marca?.nome,
                produto_id: item.produto_id,
                codigo: item.codigo,
                descricao: item.descricao,
                quantidade: item.quantidade,
                valorUnitario: item.valorUnitario,
                valor_total: item.valor_total,
                item_completo: JSON.stringify(item).substring(0, 500),
              });
            }

            // ✅ CORREÇÃO: Os dados já devem vir separados do banco (categoria e subcategoria)
            // Se não vierem separados, tentar extrair do caminhoCompleto como fallback
            let categoria: string | null = null;
            let subcategoria: string | null = null;
            
            // PRIORIDADE 1: Dados já separados (como devem estar salvos no banco)
            if (typeof item.categoria === 'string' && item.categoria.trim()) {
              categoria = item.categoria.trim();
            } else if (item.categoria?.nome) {
              categoria = item.categoria.nome;
            } else if (item.categoria?.descricao) {
              categoria = item.categoria.descricao;
            }
            
            if (typeof item.subcategoria === 'string' && item.subcategoria.trim()) {
              subcategoria = item.subcategoria.trim();
            } else if (item.subcategoria?.nome) {
              subcategoria = item.subcategoria.nome;
            }
            
            // PRIORIDADE 2: Se não temos categoria/subcategoria separadas, tentar extrair do caminhoCompleto
            if ((!categoria || !subcategoria) && item.categoria?.caminhoCompleto) {
              const caminhoCompletoStr = String(item.categoria.caminhoCompleto).trim();
              const caminho = caminhoCompletoStr.split(' > ').map(s => s.trim()).filter(s => s.length > 0);
              
              if (caminho.length > 1) {
                // Se não temos categoria, pegar tudo antes do último ">"
                if (!categoria) {
                  categoria = caminho.slice(0, -1).join(' > ');
                }
                // Se não temos subcategoria, pegar o último item
                if (!subcategoria) {
                  subcategoria = caminho[caminho.length - 1];
                }
              } else if (caminho.length === 1 && !categoria) {
                categoria = caminho[0];
              }
            }
            
            // PRIORIDADE 3: Fallback para produto_completo
            if (!categoria && item.produto_completo?.categoria?.nome) {
              categoria = item.produto_completo.categoria.nome;
            }
            if (!categoria && item.produto_original?.categoria?.nome) {
              categoria = item.produto_original.categoria.nome;
            }
            
            // Se ainda temos caminhoCompleto no produto_completo, tentar extrair
            if ((!categoria || !subcategoria) && item.produto_completo?.categoria?.caminhoCompleto) {
              const caminhoCompletoStr = String(item.produto_completo.categoria.caminhoCompleto).trim();
              const caminho = caminhoCompletoStr.split(' > ').map(s => s.trim()).filter(s => s.length > 0);
              
              if (caminho.length > 1) {
                if (!categoria) {
                  categoria = caminho.slice(0, -1).join(' > ');
                }
                if (!subcategoria) {
                  subcategoria = caminho[caminho.length - 1];
                }
              } else if (caminho.length === 1 && !categoria) {
                categoria = caminho[0];
              }
            }

            // Extrair marca (pode vir como string ou objeto)
            let marca: string | null = null;
            if (typeof item.marca === 'string' && item.marca.trim()) {
              marca = item.marca.trim();
            } else if (item.marca?.nome) {
              marca = item.marca.nome;
            } else if (item.marca?.descricao) {
              marca = item.marca.descricao;
            } else if (item.produto_completo?.marca?.nome) {
              marca = item.produto_completo.marca.nome;
            } else if (item.produto_original?.marca?.nome) {
              marca = item.produto_original.marca.nome;
            }

            // Extrair quantidade e valores (pode vir de diferentes campos)
            const quantidade = Number(item.quantidade) || Number(item.qtd) || 0;
            const valorUnitario = Number(item.valorUnitario) || Number(item.preco) || Number(item.valor_unitario) || 0;
            const valorItem = Number(item.valor_total) || Number(item.total) || (quantidade * valorUnitario);
            
            // Extrair código e descrição
            const codigo = item.codigo || item.sku || item.produto?.sku || item.produto?.codigo || null;
            const descricao = item.descricao || item.produto?.descricao || item.produto?.nome || 'Sem Descrição';
            const produto_id = item.produto_id || item.produto?.id || item.produto_id || null;

            allItems.push({
              ...item,
              categoria: categoria || 'Sem Categoria',
              subcategoria,
              marca: marca || 'Sem Marca',
              produto_id,
              codigo,
              descricao,
              quantidade,
              valorUnitario,
              valor_total: valorItem,
              order_id: order.id,
              vendedor_nome: order.vendedor_nome,
              colaboradora_id: order.colaboradora_id,
              // Dados do pedido para relatório de produtos
              order_data_pedido: order.data_pedido,
              order_numero_pedido: order.numero_pedido,
              order_cliente_nome: order.cliente_nome,
            });

            orderMap.set(order.id, (orderMap.get(order.id) || 0) + 1);
          });
        } catch (error) {
          console.error('[Relatórios] ❌ Erro ao processar itens do pedido:', order.id, error);
        }
      });

      console.log(`[Relatórios] ✅ Total de itens processados: ${allItems.length}`);
      console.log(`[Relatórios] 📊 Pedidos únicos: ${orderMap.size}`);

      // Agrupar por categoria
      const categoryMap = new Map<string, CategoryReport>();
      allItems.forEach((item) => {
        const key = `${item.categoria}|${item.subcategoria || 'null'}`;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            categoria: item.categoria,
            subcategoria: item.subcategoria,
            total_vendas: 0,
            quantidade_pedidos: 0,
            quantidade_itens: 0,
            ticket_medio: 0,
          });
        }
        const report = categoryMap.get(key)!;
        report.total_vendas += item.valor_total;
        report.quantidade_itens += item.quantidade;
      });
      // Contar pedidos únicos por categoria
      const categoryOrders = new Map<string, Set<string>>();
      allItems.forEach((item) => {
        const key = `${item.categoria}|${item.subcategoria || 'null'}`;
        if (!categoryOrders.has(key)) {
          categoryOrders.set(key, new Set());
        }
        categoryOrders.get(key)!.add(item.order_id);
      });
      categoryOrders.forEach((orderSet, key) => {
        const report = categoryMap.get(key);
        if (report) {
          report.quantidade_pedidos = orderSet.size;
          report.ticket_medio = report.quantidade_itens > 0 ? report.total_vendas / report.quantidade_itens : 0;
        }
      });
      setCategoryReports(Array.from(categoryMap.values()).sort((a, b) => b.total_vendas - a.total_vendas));

      // Agrupar por produto - mas manter vendas individuais
      const productMap = new Map<string, ProductReport>();
      
      allItems.forEach((item) => {
        const key = item.produto_id || item.codigo || item.descricao || 'unknown';
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            produto_id: item.produto_id,
            codigo: item.codigo,
            descricao: item.descricao,
            categoria: item.categoria,
            marca: item.marca,
            total_vendas: 0,
            quantidade_vendida: 0,
            vendas: [],
          });
        }
        
        const report = productMap.get(key)!;
        
        // Usar dados do pedido que já foram adicionados ao item
        // Adicionar venda individual
        report.vendas.push({
          produto_id: item.produto_id,
          codigo: item.codigo,
          descricao: item.descricao,
          categoria: item.categoria,
          marca: item.marca,
          quantidade: item.quantidade,
          valor_total: item.valor_total,
          cliente_nome: item.order_cliente_nome || null,
          numero_pedido: item.order_numero_pedido || null,
          data_pedido: item.order_data_pedido || null,
          order_id: item.order_id,
        });
        
        report.total_vendas += item.valor_total;
        report.quantidade_vendida += item.quantidade;
      });
      
      // ✅ NOVA ORDENAÇÃO: Criar lista plana de todas as vendas e ordenar por data e número de pedido
      // Isso agrupa peças da mesma venda juntas e ordena por data (mais recente primeiro)
      const allProductSales: ProductSale[] = [];
      
      productMap.forEach((report) => {
        // Adicionar todas as vendas do produto à lista plana
        report.vendas.forEach((venda) => {
          allProductSales.push({
            ...venda,
            // Manter referência ao produto para exibição
            produto_id: report.produto_id,
            codigo: report.codigo,
            descricao: report.descricao,
            categoria: report.categoria,
            marca: report.marca,
          });
        });
      });
      
      // Ordenar TODAS as vendas por:
      // 1. Data (mais recente primeiro)
      // 2. Número do pedido (maior primeiro, para agrupar peças da mesma venda)
      allProductSales.sort((a, b) => {
        // Primeiro por data (mais recente primeiro)
        const dateA = a.data_pedido ? new Date(a.data_pedido).getTime() : 0;
        const dateB = b.data_pedido ? new Date(b.data_pedido).getTime() : 0;
        if (dateB !== dateA) {
          return dateB - dateA; // Mais recente primeiro
        }
        // Se mesma data, ordenar por número do pedido (maior primeiro)
        // Isso agrupa peças da mesma venda juntas
        const numA = parseInt(a.numero_pedido || '0', 10);
        const numB = parseInt(b.numero_pedido || '0', 10);
        if (numB !== numA) {
          return numB - numA; // Maior número primeiro (peças da mesma venda juntas)
        }
        // Se mesmo pedido, manter ordem original (já estão juntas)
        return 0;
      });
      
      // Salvar lista plana ordenada para exibição
      setAllProductSalesSorted(allProductSales);
      
      // Reorganizar produtos mantendo a estrutura para estatísticas
      // Criar um novo mapa de produtos com vendas já ordenadas globalmente
      const sortedProductMap = new Map<string, ProductReport>();
      
      allProductSales.forEach((venda) => {
        const key = venda.produto_id || venda.codigo || venda.descricao || 'unknown';
        
        if (!sortedProductMap.has(key)) {
          sortedProductMap.set(key, {
            produto_id: venda.produto_id,
            codigo: venda.codigo,
            descricao: venda.descricao,
            categoria: venda.categoria,
            marca: venda.marca,
            total_vendas: 0,
            quantidade_vendida: 0,
            vendas: [],
          });
        }
        
        const report = sortedProductMap.get(key)!;
        report.vendas.push(venda);
        report.total_vendas += venda.valor_total;
        report.quantidade_vendida += venda.quantidade;
      });
      
      // Ordenar produtos pela data da venda mais recente (não por total de vendas)
      const sortedProducts = Array.from(sortedProductMap.values()).sort((a, b) => {
        // Pegar a data mais recente de cada produto
        const dateA = a.vendas.length > 0 && a.vendas[0].data_pedido 
          ? new Date(a.vendas[0].data_pedido).getTime() 
          : 0;
        const dateB = b.vendas.length > 0 && b.vendas[0].data_pedido 
          ? new Date(b.vendas[0].data_pedido).getTime() 
          : 0;
        return dateB - dateA; // Mais recente primeiro
      });
      
      setProductReports(sortedProducts);

      // Agrupar por marca
      const brandMap = new Map<string, BrandReport>();
      allItems.forEach((item) => {
        const key = item.marca;
        if (!brandMap.has(key)) {
          brandMap.set(key, {
            marca: item.marca,
            total_vendas: 0,
            quantidade_vendida: 0,
            quantidade_pedidos: 0,
            ticket_medio: 0,
          });
        }
        const report = brandMap.get(key)!;
        report.total_vendas += item.valor_total;
        report.quantidade_vendida += item.quantidade;
      });
      const brandOrders = new Map<string, Set<string>>();
      allItems.forEach((item) => {
        const key = item.marca;
        if (!brandOrders.has(key)) {
          brandOrders.set(key, new Set());
        }
        brandOrders.get(key)!.add(item.order_id);
      });
      brandOrders.forEach((orderSet, key) => {
        const report = brandMap.get(key);
        if (report) {
          report.quantidade_pedidos = orderSet.size;
          report.ticket_medio = report.quantidade_vendida > 0 ? report.total_vendas / report.quantidade_vendida : 0;
        }
      });
      setBrandReports(Array.from(brandMap.values()).sort((a, b) => b.total_vendas - a.total_vendas));

      // Agrupar por vendedor
      const sellerMap = new Map<string, SellerReport>();
      orders.forEach((order) => {
        const key = order.vendedor_nome || order.colaboradora_id || 'Sem Vendedor';
        if (!sellerMap.has(key)) {
          sellerMap.set(key, {
            vendedor_nome: order.vendedor_nome,
            colaboradora_id: order.colaboradora_id,
            total_vendas: 0,
            quantidade_pedidos: 0,
            ticket_medio: 0,
          });
        }
        const report = sellerMap.get(key)!;
        report.total_vendas += Number(order.valor_total) || 0;
        report.quantidade_pedidos += 1;
      });
      sellerMap.forEach((report) => {
        report.ticket_medio = report.quantidade_pedidos > 0 ? report.total_vendas / report.quantidade_pedidos : 0;
      });
      setSellerReports(Array.from(sellerMap.values()).sort((a, b) => b.total_vendas - a.total_vendas));

      console.log('[Relatórios] ✅ Relatórios processados com sucesso');
    } catch (error: any) {
      console.error('[Relatórios] ❌ Erro ao buscar relatórios:', error);
      toast.error('Erro ao carregar relatórios: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const getTotalVendas = () => {
    switch (activeTab) {
      case 'categorias':
        return categoryReports.reduce((sum, r) => sum + r.total_vendas, 0);
      case 'produtos':
        return productReports.reduce((sum, r) => sum + r.total_vendas, 0);
      case 'marcas':
        return brandReports.reduce((sum, r) => sum + r.total_vendas, 0);
      case 'vendedores':
        return sellerReports.reduce((sum, r) => sum + r.total_vendas, 0);
      default:
        return 0;
    }
  };

  const totalGeral = getTotalVendas();

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/erp/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">
              Análise completa de vendas com múltiplas visões
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Registros</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTab === 'categorias' && categoryReports.length}
              {activeTab === 'produtos' && productReports.length}
              {activeTab === 'marcas' && brandReports.length}
              {activeTab === 'vendedores' && sellerReports.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {format(new Date(dateStart), 'dd/MM/yyyy', { locale: ptBR })} - {format(new Date(dateEnd), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com diferentes visões */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger value="categorias" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[80px] justify-center">
            <Tag className="h-3 w-3 mr-1" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="produtos" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] justify-center">
            <Package className="h-3 w-3 mr-1" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="marcas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            Marcas
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[80px] justify-center">
            <User className="h-3 w-3 mr-1" />
            Vendedores
          </TabsTrigger>
        </TabsList>

        {/* Visão: Categorias */}
        <TabsContent value="categorias">
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
              ) : categoryReports.length === 0 ? (
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
                        <TableHead className="text-right">Qtd. Pedidos</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryReports.map((report, index) => {
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
                              {report.quantidade_pedidos.toLocaleString('pt-BR')}
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
        </TabsContent>

        {/* Visão: Produtos */}
        <TabsContent value="produtos">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Produto</CardTitle>
              <CardDescription>
                Ranking de produtos mais vendidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : productReports.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum dado encontrado para o período selecionado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Categoria</TableHead>
                        <TableHead className="text-xs">Marca</TableHead>
                        <TableHead className="text-xs text-right">Qtd.</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Nº Venda</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allProductSalesSorted.slice(0, 100).map((venda, index) => (
                        <TableRow key={`${venda.order_id}-${index}`}>
                          <TableCell className="text-xs font-medium">{venda.descricao}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{venda.codigo || '-'}</TableCell>
                          <TableCell className="text-xs">{venda.categoria || '-'}</TableCell>
                          <TableCell className="text-xs">{venda.marca || '-'}</TableCell>
                          <TableCell className="text-xs text-right">
                            {venda.quantidade.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {formatCurrency(venda.valor_total)}
                          </TableCell>
                          <TableCell className="text-xs">{venda.cliente_nome || '-'}</TableCell>
                          <TableCell className="text-xs">{venda.numero_pedido || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {venda.data_pedido 
                              ? format(new Date(venda.data_pedido), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visão: Marcas */}
        <TabsContent value="marcas">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Marca</CardTitle>
              <CardDescription>
                Performance de vendas por marca
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : brandReports.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum dado encontrado para o período selecionado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead className="text-right">Total Vendas</TableHead>
                        <TableHead className="text-right">Qtd. Vendida</TableHead>
                        <TableHead className="text-right">Qtd. Pedidos</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandReports.map((report, index) => {
                        const percentual = totalGeral > 0 ? (report.total_vendas / totalGeral) * 100 : 0;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{report.marca}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(report.total_vendas)}
                            </TableCell>
                            <TableCell className="text-right">
                              {report.quantidade_vendida.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right">
                              {report.quantidade_pedidos.toLocaleString('pt-BR')}
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
        </TabsContent>

        {/* Visão: Vendedores */}
        <TabsContent value="vendedores">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Vendedor</CardTitle>
              <CardDescription>
                Performance de vendas por vendedor/colaboradora
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sellerReports.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum dado encontrado para o período selecionado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Total Vendas</TableHead>
                        <TableHead className="text-right">Qtd. Pedidos</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellerReports.map((report, index) => {
                        const percentual = totalGeral > 0 ? (report.total_vendas / totalGeral) * 100 : 0;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {report.vendedor_nome || 'Sem Nome'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(report.total_vendas)}
                            </TableCell>
                            <TableCell className="text-right">
                              {report.quantidade_pedidos.toLocaleString('pt-BR')}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
