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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, Package, Filter, BarChart3, PieChart, Calendar, Store, User, Search, Clock, Target, ArrowLeft, DollarSign, Columns } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
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
  hora_pedido?: number; // Hora do dia (0-23)
}

interface AggregatedProduct {
  categoria: string;
  subcategoria: string | null;
  marca: string | null;
  tamanho: string | null;
  cor: string | null;
  codigo: string | null;
  descricao: string | null;
  vendedor_nome: string | null; // ✅ CORREÇÃO: Campo adicionado para análises de vendedores
  total_vendas: number;
  quantidade_vendida: number;
  quantidade_pedidos: number;
  ticket_medio: number;
  primeiro_vendido: string | null;
  ultimo_vendido: string | null;
}

type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';

// ✅ TAMANHOS VÁLIDOS PARA NORMALIZAÇÃO (sempre em MAIÚSCULA)
const TAMANHOS_VALIDOS = [
  'PP', 'P', 'M', 'G', 'GG', 'XGG', 'XXXG', 'XXXXG',
  '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54',
  'U', 'UNICO', 'ÚNICO', 'UNIDADE'
];

// ✅ FUNÇÃO PARA NORMALIZAR TAMANHOS (SEMPRE EM MAIÚSCULA)
function normalizeTamanho(tamanho: string | null | undefined): string | null {
  if (!tamanho) return null;

  // Converter para maiúscula e remover espaços
  const normalized = String(tamanho)
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, ''); // Remove caracteres especiais, mantém apenas letras maiúsculas e números

  // Verificar se está na lista de tamanhos válidos (comparação case-insensitive)
  const match = TAMANHOS_VALIDOS.find(t =>
    normalized === t ||
    normalized.includes(t) ||
    t.includes(normalized) ||
    normalized.replace(/[^A-Z0-9]/g, '') === t.replace(/[^A-Z0-9]/g, '')
  );

  if (match) {
    // Retornar o tamanho normalizado padrão em MAIÚSCULA
    if (match === 'UNICO' || match === 'ÚNICO') return 'U';
    if (match === 'UNIDADE') return 'U';
    return match.toUpperCase();
  }

  // Se não encontrou match exato, retornar o tamanho original em MAIÚSCULA
  // Pode ser um tamanho não padrão, mas sempre em maiúscula
  return String(tamanho).trim().toUpperCase();
}

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

  // ✅ CORREÇÃO: Inicializar datas com valores padrão (últimos 30 dias)
  const getInitialDates = () => {
    const today = new Date();
    const start = subDays(today, 30);
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  };

  const initialDates = getInitialDates();
  const [dateStart, setDateStart] = useState<string>(initialDates.start);
  const [dateEnd, setDateEnd] = useState<string>(initialDates.end);
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

  // ✅ Controle de visibilidade de colunas na tabela de produtos
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rank: true,
    descricao: true,
    categoria: true,
    marca: true,
    tamanho: true,
    cor: true,
    quantidade: true,
    totalVendas: true,
    ticketMedio: true,
  });

  // ✅ Estado para agrupamento na tabela principal
  const [groupBy, setGroupBy] = useState<'product' | 'brand' | 'category' | 'seller'>('product');

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
            // ✅ CORREÇÃO: Tentar múltiplas formas de extrair valor
            // ✅ CORREÇÃO: Função auxiliar para converter valores monetários
            const parseMoney = (val: any): number => {
              if (typeof val === 'number') return val;
              if (!val) return 0;
              if (typeof val === 'string') {
                // Remover R$, espaços e substituir vírgula por ponto
                const clean = val.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
              }
              return 0;
            };

            const valorUnitario = parseMoney(
              item.valor_unitario
              || item.valorUnitario
              || item.valor_unit
              || item.valorUnit
              || item.preco
              || item.preco_unitario
            );

            const valorTotal = parseMoney(
              item.valor_total
              || item.valorTotal
              || item.valor
              || item.total
              || item.subtotal
            ) || (quantidade * valorUnitario);

            // Log para debug se valor for zero
            if (valorTotal === 0 && quantidade > 0) {
              console.warn(`[ProductIntelligence] ⚠️ Item sem valor:`, {
                codigo: item.codigo,
                descricao: item.descricao?.substring(0, 50),
                quantidade,
                valorUnitario,
                valor_total_item: item.valor_total,
                valorTotal_item: item.valorTotal,
                todas_chaves: Object.keys(item),
              });
            }

            // ✅ CORREÇÃO CRÍTICA: Extrair hora do pedido de forma robusta
            // O problema: data_pedido pode vir apenas com data (00:00:00) ou com hora completa
            // Precisamos buscar a hora real do pedido, não apenas da data de criação
            let horaPedido: number | undefined = undefined;
            if (order.data_pedido) {
              try {
                const dataStr = String(order.data_pedido);
                console.log(`[ProductIntelligence] 🔍 Analisando data_pedido para extrair hora:`, {
                  data_original: dataStr,
                  pedido_id: order.id,
                });

                // ✅ ESTRATÉGIA 1: Tentar extrair diretamente da string ISO
                // Formatos possíveis:
                // - "2025-11-26T14:30:00-03:00" -> hora = 14
                // - "2025-11-26T14:30:00" -> hora = 14
                // - "2025-11-26T14:30:00Z" -> converter UTC para BRT (-3)
                // - "2025-11-26 14:30:00" -> hora = 14
                // - "2025-11-26T00:00:00" -> PODE SER QUE NÃO TENHA HORA, buscar no item ou pedido completo

                if (dataStr.includes('T')) {
                  // Extrair parte da hora: "2025-11-26T14:30:00-03:00" -> "14:30:00"
                  const horaPart = dataStr.split('T')[1]?.split(/[+\-Z]/)[0]?.trim();

                  if (horaPart) {
                    const partesHora = horaPart.split(':');
                    if (partesHora.length >= 1) {
                      const hora = parseInt(partesHora[0], 10);

                      if (!isNaN(hora) && hora >= 0 && hora <= 23) {
                        // Se a hora é 00:00:00, pode ser que não tenhamos a hora real
                        // Nesse caso, tentar buscar do item ou assumir que é meia-noite mesmo

                        if (hora === 0 && horaPart.startsWith('00:00:00')) {
                          // Hora é 00:00:00 - pode ser que não temos hora real
                          // Verificar se o item tem alguma informação de hora
                          console.log(`[ProductIntelligence] ⚠️ Hora é 00:00:00, pode não ser a hora real do pedido`);

                          // Tentar buscar hora do item se disponível
                          if (item.data_venda && typeof item.data_venda === 'string') {
                            const dataVendaStr = String(item.data_venda);
                            if (dataVendaStr.includes('T')) {
                              const horaVenda = dataVendaStr.split('T')[1]?.split(/[+\-Z]/)[0]?.split(':')[0];
                              if (horaVenda) {
                                const horaItem = parseInt(horaVenda, 10);
                                if (!isNaN(horaItem) && horaItem >= 0 && horaItem <= 23 && horaItem !== 0) {
                                  horaPedido = horaItem;
                                  console.log(`[ProductIntelligence] ✅ Hora encontrada no item: ${horaItem}`);
                                }
                              }
                            }
                          }

                          // Se não encontrou, usar 00 mesmo (ou tentar inferir de outro campo)
                          if (horaPedido === undefined) {
                            horaPedido = 0;
                          }
                        } else {
                          // Hora válida e não é 00:00:00
                          // Ajustar timezone se necessário
                          if (dataStr.endsWith('Z') || dataStr.includes('+00:00')) {
                            // UTC -> BRT: subtrair 3 horas
                            horaPedido = (hora - 3 + 24) % 24;
                          } else if (dataStr.includes('-03:00') || dataStr.includes('-03')) {
                            // Já está em horário de Brasília
                            horaPedido = hora;
                          } else {
                            // Sem timezone explícito, assumir horário local
                            horaPedido = hora;
                          }
                        }
                      }
                    }
                  }
                } else if (dataStr.includes(' ')) {
                  // Formato alternativo: "2025-11-26 14:30:00"
                  const horaPart = dataStr.split(' ')[1]?.split(':')[0];
                  if (horaPart) {
                    const hora = parseInt(horaPart, 10);
                    if (!isNaN(hora) && hora >= 0 && hora <= 23) {
                      horaPedido = hora;
                    }
                  }
                }

                // ✅ ESTRATÉGIA 2: Se ainda não tem hora, tentar usar Date (pode ter problemas de timezone)
                if (horaPedido === undefined) {
                  const dataPedido = new Date(dataStr);
                  if (!isNaN(dataPedido.getTime())) {
                    // Pegar hora no timezone local do navegador
                    let horaLocal = dataPedido.getHours();

                    // Ajustar se estiver em UTC
                    if (dataStr.endsWith('Z') || dataStr.includes('+00:00')) {
                      // Converter UTC para horário de Brasília (UTC-3)
                      horaLocal = (horaLocal - 3 + 24) % 24;
                    }

                    horaPedido = horaLocal;
                    console.log(`[ProductIntelligence] 📅 Hora extraída via Date: ${horaPedido} (data original: ${dataStr})`);
                  }
                }

                // Log detalhado para debug
                if (horaPedido !== undefined) {
                  console.log(`[ProductIntelligence] ✅ Hora final extraída:`, {
                    pedido_id: order.id,
                    data_original: order.data_pedido,
                    hora_extraida: horaPedido,
                    hora_formatada: `${horaPedido.toString().padStart(2, '0')}:00`,
                  });
                } else {
                  console.warn(`[ProductIntelligence] ⚠️ Não foi possível extrair hora do pedido:`, {
                    pedido_id: order.id,
                    data_original: order.data_pedido,
                  });
                }
              } catch (e) {
                console.error(`[ProductIntelligence] ❌ Erro ao extrair hora do pedido:`, e, {
                  pedido_id: order.id,
                  data_pedido: order.data_pedido,
                });
              }
            }

            allSales.push({
              id: `${order.id}-${item.codigo || Math.random()}`,
              categoria: item.categoria || 'Sem Categoria',
              subcategoria: item.subcategoria || null,
              marca: item.marca || null,
              tamanho: item.tamanho ? normalizeTamanho(item.tamanho) : null, // ✅ Usar tamanho normalizado (já vem do banco)
              cor: item.cor ? String(item.cor).trim().toUpperCase() : null, // ✅ Cor em maiúscula (já vem do banco)
              codigo: item.codigo || null,
              descricao: item.descricao || null,
              quantidade,
              valor_unitario: valorUnitario,
              valor_total: valorTotal,
              data_pedido: order.data_pedido,
              store_id: order.store_id,
              colaboradora_id: order.colaboradora_id,
              vendedor_nome: order.vendedor_nome,
              hora_pedido: horaPedido,
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
          vendedor_nome: sale.vendedor_nome, // ✅ CORREÇÃO: Incluir vendedor_nome na agregação
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

  // ✅ ANÁLISES AVANÇADAS - TODAS AS ANÁLISES SOLICITADAS
  const tamanhoPorMarca = useMemo(() => {
    const marcaTamanhoMap = new Map<string, Map<string, { quantidade: number; total: number }>>();

    filteredAndAggregated.forEach((agg) => {
      if (!agg.marca || !agg.tamanho) return;

      if (!marcaTamanhoMap.has(agg.marca)) {
        marcaTamanhoMap.set(agg.marca, new Map());
      }

      const tamanhos = marcaTamanhoMap.get(agg.marca)!;
      if (!tamanhos.has(agg.tamanho)) {
        tamanhos.set(agg.tamanho, { quantidade: 0, total: 0 });
      }

      const dados = tamanhos.get(agg.tamanho)!;
      dados.quantidade += agg.quantidade_vendida;
      dados.total += agg.total_vendas;
    });

    return Array.from(marcaTamanhoMap.entries()).map(([marca, tamanhos]) => {
      let maiorTamanho = '';
      let maiorQuantidade = 0;
      let maiorTotal = 0;

      tamanhos.forEach((dados, tamanho) => {
        if (dados.quantidade > maiorQuantidade) {
          maiorQuantidade = dados.quantidade;
          maiorTotal = dados.total;
          maiorTamanho = tamanho;
        }
      });

      return { marca, tamanho: maiorTamanho, quantidade: maiorQuantidade, total: maiorTotal };
    }).sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredAndAggregated]);

  const tamanhoPorCategoria = useMemo(() => {
    const categoriaTamanhoMap = new Map<string, Map<string, { quantidade: number; total: number }>>();

    filteredAndAggregated.forEach((agg) => {
      if (!agg.categoria || !agg.tamanho) return;

      if (!categoriaTamanhoMap.has(agg.categoria)) {
        categoriaTamanhoMap.set(agg.categoria, new Map());
      }

      const tamanhos = categoriaTamanhoMap.get(agg.categoria)!;
      if (!tamanhos.has(agg.tamanho)) {
        tamanhos.set(agg.tamanho, { quantidade: 0, total: 0 });
      }

      const dados = tamanhos.get(agg.tamanho)!;
      dados.quantidade += agg.quantidade_vendida;
      dados.total += agg.total_vendas;
    });

    return Array.from(categoriaTamanhoMap.entries()).map(([categoria, tamanhos]) => {
      let maiorTamanho = '';
      let maiorQuantidade = 0;
      let maiorTotal = 0;

      tamanhos.forEach((dados, tamanho) => {
        if (dados.quantidade > maiorQuantidade) {
          maiorQuantidade = dados.quantidade;
          maiorTotal = dados.total;
          maiorTamanho = tamanho;
        }
      });

      return { categoria, tamanho: maiorTamanho, quantidade: maiorQuantidade, total: maiorTotal };
    }).sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredAndAggregated]);

  const ticketMedioPorTamanho = useMemo(() => {
    const tamanhoMap = new Map<string, { total: number; quantidade: number; vendas: number }>();

    rawSales.forEach((sale) => {
      if (!sale.tamanho) return;

      if (!tamanhoMap.has(sale.tamanho)) {
        tamanhoMap.set(sale.tamanho, { total: 0, quantidade: 0, vendas: 0 });
      }

      const dados = tamanhoMap.get(sale.tamanho)!;
      dados.total += sale.valor_total;
      dados.quantidade += sale.quantidade;
      dados.vendas += 1;
    });

    return Array.from(tamanhoMap.entries())
      .map(([tamanho, dados]) => ({
        tamanho,
        ticket_medio: dados.vendas > 0 ? dados.total / dados.vendas : 0,
        quantidade: dados.quantidade,
        total: dados.total,
        pedidos: dados.vendas,
      }))
      .sort((a, b) => b.ticket_medio - a.ticket_medio);
  }, [rawSales]);

  const ticketMedioPorMarca = useMemo(() => {
    const marcaMap = new Map<string, { total: number; quantidade: number; vendas: number }>();

    rawSales.forEach((sale) => {
      if (!sale.marca) return;

      if (!marcaMap.has(sale.marca)) {
        marcaMap.set(sale.marca, { total: 0, quantidade: 0, vendas: 0 });
      }

      const dados = marcaMap.get(sale.marca)!;
      dados.total += sale.valor_total;
      dados.quantidade += sale.quantidade;
      dados.vendas += 1;
    });

    return Array.from(marcaMap.entries())
      .map(([marca, dados]) => ({
        marca,
        ticket_medio: dados.vendas > 0 ? dados.total / dados.vendas : 0,
        quantidade: dados.quantidade,
        total: dados.total,
        pedidos: dados.vendas,
      }))
      .sort((a, b) => b.ticket_medio - a.ticket_medio);
  }, [rawSales]);

  const marcaPorVendedor = useMemo(() => {
    const vendedorMarcaMap = new Map<string, Map<string, { quantidade: number; total: number }>>();

    rawSales.forEach((sale) => {
      if (!sale.vendedor_nome || !sale.marca) return;

      if (!vendedorMarcaMap.has(sale.vendedor_nome)) {
        vendedorMarcaMap.set(sale.vendedor_nome, new Map());
      }

      const marcas = vendedorMarcaMap.get(sale.vendedor_nome)!;
      if (!marcas.has(sale.marca)) {
        marcas.set(sale.marca, { quantidade: 0, total: 0 });
      }

      const dados = marcas.get(sale.marca)!;
      dados.quantidade += sale.quantidade;
      dados.total += sale.valor_total;
    });

    return Array.from(vendedorMarcaMap.entries()).map(([vendedor, marcas]) => {
      let maiorMarca = '';
      let maiorQuantidade = 0;
      let maiorTotal = 0;

      marcas.forEach((dados, marca) => {
        if (dados.quantidade > maiorQuantidade) {
          maiorQuantidade = dados.quantidade;
          maiorTotal = dados.total;
          maiorMarca = marca;
        }
      });

      return { vendedor, marca: maiorMarca, quantidade: maiorQuantidade, total: maiorTotal };
    }).sort((a, b) => b.quantidade - a.quantidade);
  }, [rawSales]);

  const ticketMedioMarcaPorVendedor = useMemo(() => {
    const vendedorMarcaMap = new Map<string, Map<string, { total: number; vendas: number }>>();

    rawSales.forEach((sale) => {
      if (!sale.vendedor_nome || !sale.marca) return;

      if (!vendedorMarcaMap.has(sale.vendedor_nome)) {
        vendedorMarcaMap.set(sale.vendedor_nome, new Map());
      }

      const marcas = vendedorMarcaMap.get(sale.vendedor_nome)!;
      if (!marcas.has(sale.marca)) {
        marcas.set(sale.marca, { total: 0, vendas: 0 });
      }

      const dados = marcas.get(sale.marca)!;
      dados.total += sale.valor_total;
      dados.vendas += 1;
    });

    const result: Array<{ vendedor: string; marca: string; ticket_medio: number; total: number; vendas: number }> = [];

    vendedorMarcaMap.forEach((marcas, vendedor) => {
      marcas.forEach((dados, marca) => {
        result.push({
          vendedor,
          marca,
          ticket_medio: dados.vendas > 0 ? dados.total / dados.vendas : 0,
          total: dados.total,
          vendas: dados.vendas,
        });
      });
    });

    return result.sort((a, b) => b.ticket_medio - a.ticket_medio);
  }, [rawSales]);

  const vendasPorHorario = useMemo(() => {
    const horarioMap = new Map<number, { quantidade: number; vendas: number; total: number }>();

    rawSales.forEach((sale) => {
      if (sale.hora_pedido === undefined) return;

      if (!horarioMap.has(sale.hora_pedido)) {
        horarioMap.set(sale.hora_pedido, { quantidade: 0, vendas: 0, total: 0 });
      }

      const dados = horarioMap.get(sale.hora_pedido)!;
      dados.quantidade += sale.quantidade;
      dados.vendas += 1;
      dados.total += sale.valor_total;
    });

    return Array.from(horarioMap.entries())
      .map(([hora, dados]) => ({
        hora,
        quantidade: dados.quantidade,
        pedidos: dados.vendas,
        total: dados.total,
        label: `${hora.toString().padStart(2, '0')}:00`,
      }))
      .sort((a, b) => a.hora - b.hora);
  }, [rawSales]);

  const ticketMedioPorHorario = useMemo(() => {
    const horarioMap = new Map<number, { total: number; vendas: number }>();

    rawSales.forEach((sale) => {
      if (sale.hora_pedido === undefined) return;

      if (!horarioMap.has(sale.hora_pedido)) {
        horarioMap.set(sale.hora_pedido, { total: 0, vendas: 0 });
      }

      const dados = horarioMap.get(sale.hora_pedido)!;
      dados.total += sale.valor_total;
      dados.vendas += 1;
    });

    return Array.from(horarioMap.entries())
      .map(([hora, dados]) => ({
        hora,
        ticket_medio: dados.vendas > 0 ? dados.total / dados.vendas : 0,
        total: dados.total,
        pedidos: dados.vendas,
        label: `${hora.toString().padStart(2, '0')}:00`,
      }))
      .sort((a, b) => b.ticket_medio - a.ticket_medio);
  }, [rawSales]);

  const tendenciaTamanhoPorMarca = useMemo(() => {
    const hoje = new Date();
    const data30 = subDays(hoje, 30);
    const data60 = subDays(hoje, 60);
    const data90 = subDays(hoje, 90);

    const marcaTamanhoMap = new Map<string, Map<string, { periodo_30: number; periodo_60: number; periodo_90: number }>>();

    rawSales.forEach((sale) => {
      if (!sale.marca || !sale.tamanho || !sale.data_pedido) return;

      const dataVenda = new Date(sale.data_pedido);
      const key = `${sale.marca}|${sale.tamanho}`;

      if (!marcaTamanhoMap.has(sale.marca)) {
        marcaTamanhoMap.set(sale.marca, new Map());
      }

      const tamanhos = marcaTamanhoMap.get(sale.marca)!;
      if (!tamanhos.has(sale.tamanho)) {
        tamanhos.set(sale.tamanho, { periodo_30: 0, periodo_60: 0, periodo_90: 0 });
      }

      const dados = tamanhos.get(sale.tamanho)!;

      if (dataVenda >= data30) {
        dados.periodo_30 += sale.quantidade;
      }
      if (dataVenda >= data60) {
        dados.periodo_60 += sale.quantidade;
      }
      if (dataVenda >= data90) {
        dados.periodo_90 += sale.quantidade;
      }
    });

    const result: Array<{ marca: string; tamanho: string; periodo_30: number; periodo_60: number; periodo_90: number; tendencia: 'crescendo' | 'caindo' | 'estavel' }> = [];

    marcaTamanhoMap.forEach((tamanhos, marca) => {
      tamanhos.forEach((dados, tamanho) => {
        const media30 = dados.periodo_30 / 30;
        const media60 = (dados.periodo_60 - dados.periodo_30) / 30;
        const media90 = (dados.periodo_90 - dados.periodo_60) / 30;

        let tendencia: 'crescendo' | 'caindo' | 'estavel' = 'estavel';
        if (media30 > media60 * 1.1) {
          tendencia = 'crescendo';
        } else if (media30 < media60 * 0.9) {
          tendencia = 'caindo';
        }

        result.push({
          marca,
          tamanho,
          periodo_30: dados.periodo_30,
          periodo_60: dados.periodo_60 - dados.periodo_30,
          periodo_90: dados.periodo_90 - dados.periodo_60,
          tendencia,
        });
      });
    });

    return result.sort((a, b) => b.periodo_30 - a.periodo_30);
  }, [rawSales]);

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
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/erp/dashboard')}
            title="Voltar para Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Inteligência de Vendas de Produtos</h1>
            <p className="text-muted-foreground">
              Análise avançada e inteligente de produtos vendidos
            </p>
          </div>
        </div>
      </div>

      {/* Filtros Principais - Layout Compacto */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Filtros Visíveis */}
            <div className="grid gap-4 md:grid-cols-4 flex-1">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Período</label>
                <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                  <SelectTrigger className="h-9">
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

              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Loja</label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="h-9">
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
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Vendedor</label>
                <Select value={selectedColaboradora} onValueChange={setSelectedColaboradora}>
                  <SelectTrigger className="h-9">
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

              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Código, descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Botão Mais Filtros */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 min-w-[130px]">
                  <Filter className="h-4 w-4" />
                  Mais Filtros
                  {(filterCategoria !== 'all' || filterSubcategoria !== 'all' || filterMarca !== 'all' || filterTamanho !== 'all' || filterCor !== 'all') && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {[filterCategoria, filterSubcategoria, filterMarca, filterTamanho, filterCor].filter(f => f !== 'all').length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-4" align="end">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filtros de Produto</h4>
                    <p className="text-sm text-muted-foreground">
                      Refine sua busca por características do produto
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium mb-1.5 block">Categoria</label>
                        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                          <SelectTrigger className="h-8">
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
                        <label className="text-xs font-medium mb-1.5 block">Subcategoria</label>
                        <Select value={filterSubcategoria} onValueChange={setFilterSubcategoria}>
                          <SelectTrigger className="h-8">
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
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Marca</label>
                      <Select value={filterMarca} onValueChange={setFilterMarca}>
                        <SelectTrigger className="h-8">
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium mb-1.5 block">Tamanho</label>
                        <Select value={filterTamanho} onValueChange={setFilterTamanho}>
                          <SelectTrigger className="h-8">
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
                        <label className="text-xs font-medium mb-1.5 block">Cor</label>
                        <Select value={filterCor} onValueChange={setFilterCor}>
                          <SelectTrigger className="h-8">
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
                    </div>
                  </div>

                  {(filterCategoria !== 'all' || filterSubcategoria !== 'all' || filterMarca !== 'all' || filterTamanho !== 'all' || filterCor !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterCategoria('all');
                        setFilterSubcategoria('all');
                        setFilterMarca('all');
                        setFilterTamanho('all');
                        setFilterCor('all');
                      }}
                      className="w-full mt-2 h-8"
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Filtro de Data Personalizada (aparece apenas se selecionado) */}
          {periodPreset === 'custom' && (
            <div className="flex items-end gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Data Início</label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Data Fim</label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}
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

      {/* Análises Inteligentes - Abas Reorganizadas */}
      <Tabs defaultValue="rankings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rankings">Rankings de Vendas</TabsTrigger>
          <TabsTrigger value="attributes">Atributos (Cor/Tam)</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="intelligence">Inteligência</TabsTrigger>
        </TabsList>

        {/* GRUPO 1: RANKINGS */}
        <TabsContent value="rankings" className="space-y-4">
          <Tabs defaultValue="products" className="w-full">
            <div className="flex items-center justify-center mb-4">
              <TabsList className="w-auto">
                <TabsTrigger value="products">Produtos</TabsTrigger>
                <TabsTrigger value="categories">Categorias</TabsTrigger>
                <TabsTrigger value="brands">Marcas</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Produtos Mais Vendidos</CardTitle>
                      <CardDescription>
                        Ranking completo de produtos por valor total de vendas
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Agrupar por..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Produto (Padrão)</SelectItem>
                          <SelectItem value="brand">Marca</SelectItem>
                          <SelectItem value="category">Categoria</SelectItem>
                          <SelectItem value="seller">Vendedor</SelectItem>
                        </SelectContent>
                      </Select>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Columns className="h-4 w-4 mr-2" />
                            Colunas
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Exibir/Ocultar Colunas</DialogTitle>
                            <DialogDescription>
                              Selecione quais colunas deseja exibir na tabela
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            {[
                              { key: 'rank', label: 'Rank' },
                              { key: 'descricao', label: 'Descrição' },
                              { key: 'categoria', label: 'Categoria' },
                              { key: 'marca', label: 'Marca' },
                              { key: 'tamanho', label: 'Tamanho' },
                              { key: 'cor', label: 'Cor' },
                              { key: 'quantidade', label: 'Qtd. Vendida' },
                              { key: 'totalVendas', label: 'Total Vendas' },
                              { key: 'ticketMedio', label: 'Ticket Médio' },
                            ].map((col) => (
                              <div key={col.key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={col.key}
                                  checked={visibleColumns[col.key] ?? true}
                                  onCheckedChange={(checked) => {
                                    setVisibleColumns(prev => ({
                                      ...prev,
                                      [col.key]: checked as boolean,
                                    }));
                                  }}
                                />
                                <Label
                                  htmlFor={col.key}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {col.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    {groupBy === 'product' ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {visibleColumns.rank && <TableHead>Rank</TableHead>}
                            {visibleColumns.descricao && <TableHead>Descrição</TableHead>}
                            {visibleColumns.categoria && <TableHead>Categoria</TableHead>}
                            {visibleColumns.marca && <TableHead>Marca</TableHead>}
                            {visibleColumns.tamanho && <TableHead>Tamanho</TableHead>}
                            {visibleColumns.cor && <TableHead>Cor</TableHead>}
                            {visibleColumns.quantidade && <TableHead className="text-right">Qtd. Vendida</TableHead>}
                            {visibleColumns.totalVendas && <TableHead className="text-right">Total Vendas</TableHead>}
                            {visibleColumns.ticketMedio && <TableHead className="text-right">Ticket Médio</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndAggregated.slice(0, 50).map((agg, index) => (
                            <TableRow key={index}>
                              {visibleColumns.rank && <TableCell className="font-medium">#{index + 1}</TableCell>}
                              {visibleColumns.descricao && (
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{agg.descricao || agg.codigo || 'Sem descrição'}</div>
                                    {agg.codigo && (
                                      <div className="text-xs text-muted-foreground">Cód: {agg.codigo}</div>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.categoria && (
                                <TableCell>
                                  <Badge variant="outline">{agg.categoria}</Badge>
                                  {agg.subcategoria && (
                                    <Badge variant="secondary" className="ml-1">{agg.subcategoria}</Badge>
                                  )}
                                </TableCell>
                              )}
                              {visibleColumns.marca && <TableCell>{agg.marca || '-'}</TableCell>}
                              {visibleColumns.tamanho && <TableCell>{agg.tamanho || '-'}</TableCell>}
                              {visibleColumns.cor && <TableCell>{agg.cor || ''}</TableCell>}
                              {visibleColumns.quantidade && (
                                <TableCell className="text-right font-medium">
                                  {agg.quantidade_vendida.toLocaleString('pt-BR')}
                                </TableCell>
                              )}
                              {visibleColumns.totalVendas && (
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(agg.total_vendas)}
                                </TableCell>
                              )}
                              {visibleColumns.ticketMedio && (
                                <TableCell className="text-right">
                                  {formatCurrency(agg.ticket_medio)}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>
                              {groupBy === 'brand' ? 'Marca' :
                                groupBy === 'category' ? 'Categoria' :
                                  groupBy === 'seller' ? 'Vendedor' : 'Item'}
                            </TableHead>
                            <TableHead className="text-right">Total Vendas</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Ticket Médio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const groupedMap = new Map<string, { total: number; quantidade: number }>();
                            filteredAndAggregated.forEach((agg) => {
                              let key = '';
                              if (groupBy === 'brand') key = agg.marca || 'Sem Marca';
                              else if (groupBy === 'category') key = agg.categoria || 'Sem Categoria';
                              else if (groupBy === 'seller') key = agg.vendedor_nome || 'Sem Vendedor';

                              if (!groupedMap.has(key)) {
                                groupedMap.set(key, { total: 0, quantidade: 0 });
                              }
                              const g = groupedMap.get(key)!;
                              g.total += agg.total_vendas;
                              g.quantidade += agg.quantidade_vendida;
                            });

                            const sortedGroup = Array.from(groupedMap.entries())
                              .map(([key, data]) => ({ key, ...data }))
                              .sort((a, b) => b.total - a.total);

                            return sortedGroup.map((item, index) => (
                              <TableRow key={item.key}>
                                <TableCell className="font-medium">#{index + 1}</TableCell>
                                <TableCell className="font-medium">{item.key}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.total)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.quantidade.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.quantidade > 0 ? item.total / item.quantidade : 0)}
                                </TableCell>
                              </TableRow>
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ NOVA TAB: Categorias */}
            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Categorias Mais Vendidas</CardTitle>
                  <CardDescription>
                    Análise de vendas por categoria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const categoriaMap = new Map<string, { total: number; quantidade: number }>();
                          filteredAndAggregated.forEach((agg) => {
                            if (!agg.categoria) return;
                            if (!categoriaMap.has(agg.categoria)) {
                              categoriaMap.set(agg.categoria, { total: 0, quantidade: 0 });
                            }
                            const c = categoriaMap.get(agg.categoria)!;
                            c.total += agg.total_vendas;
                            c.quantidade += agg.quantidade_vendida;
                          });
                          const topCategorias = Array.from(categoriaMap.entries())
                            .map(([categoria, data]) => ({ categoria, ...data }))
                            .sort((a, b) => b.total - a.total);

                          return topCategorias.map((cat, index) => (
                            <TableRow key={cat.categoria}>
                              <TableCell className="font-medium">#{index + 1}</TableCell>
                              <TableCell className="font-medium">{cat.categoria}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(cat.total)}
                              </TableCell>
                              <TableCell className="text-right">
                                {cat.quantidade.toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(cat.quantidade > 0 ? cat.total / cat.quantidade : 0)}
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
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

          </Tabs>
        </TabsContent>

        {/* GRUPO 2: ATRIBUTOS */}
        <TabsContent value="attributes" className="space-y-4">
          <Tabs defaultValue="sizes" className="w-full">
            <div className="flex items-center justify-center mb-4">
              <TabsList className="w-auto">
                <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
                <TabsTrigger value="colors">Cores</TabsTrigger>
              </TabsList>
            </div>

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
        </TabsContent>

        {/* GRUPO 4: INTELIGÊNCIA */}
        <TabsContent value="intelligence" className="space-y-4">
          <Tabs defaultValue="analytics" className="w-full">
            <div className="flex items-center justify-center mb-4">
              <TabsList className="w-auto">
                <TabsTrigger value="analytics">Análises Cruzadas</TabsTrigger>
                <TabsTrigger value="trends">Tendências</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tamanho Mais Vendido por Marca</CardTitle>
                  <CardDescription>Qual tamanho vende mais em cada marca</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Tamanho Mais Vendido</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(tamanhoPorMarca || []).map((item, index) => (
                          <TableRow key={`${item.marca}-${index}`}>
                            <TableCell className="font-medium">{item.marca}</TableCell>
                            <TableCell><Badge variant="outline">{item.tamanho}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tamanho Mais Vendido por Categoria</CardTitle>
                  <CardDescription>Qual tamanho vende mais em cada categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Tamanho Mais Vendido</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tamanhoPorCategoria.map((item, index) => (
                          <TableRow key={`${item.categoria}-${index}`}>
                            <TableCell className="font-medium">{item.categoria}</TableCell>
                            <TableCell><Badge variant="outline">{item.tamanho}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ NOVA TAB: Tendências */}
            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tendência de Venda de Tamanho por Marca</CardTitle>
                  <CardDescription>Evolução de vendas nos últimos 30, 60 e 90 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead className="text-right">30 dias</TableHead>
                          <TableHead className="text-right">60 dias</TableHead>
                          <TableHead className="text-right">90 dias</TableHead>
                          <TableHead>Tendência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(tendenciaTamanhoPorMarca || []).slice(0, 50).map((item, index) => (
                          <TableRow key={`${item.marca}-${item.tamanho}-${index}`}>
                            <TableCell className="font-medium">{item.marca}</TableCell>
                            <TableCell><Badge variant="outline">{item.tamanho}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{item.periodo_30.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{item.periodo_60.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{item.periodo_90.toLocaleString('pt-BR')}</TableCell>
                            <TableCell>
                              {item.tendencia === 'crescendo' && <Badge className="bg-green-600"><TrendingUp className="h-3 w-3 mr-1" />Crescendo</Badge>}
                              {item.tendencia === 'caindo' && <Badge variant="destructive"><TrendingUp className="h-3 w-3 mr-1 rotate-180" />Caindo</Badge>}
                              {item.tendencia === 'estavel' && <Badge variant="secondary">Estável</Badge>}
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
        </TabsContent>

        {/* GRUPO 3: PERFORMANCE */}
        <TabsContent value="performance" className="space-y-4">
          <Tabs defaultValue="sellers" className="w-full">
            <div className="flex items-center justify-center mb-4">
              <TabsList className="w-auto">
                <TabsTrigger value="sellers">Vendedores</TabsTrigger>
                <TabsTrigger value="hours">Horários</TabsTrigger>
                <TabsTrigger value="tickets">Tickets Médios</TabsTrigger>
              </TabsList>
            </div>

            {/* ✅ NOVA TAB: Vendedores */}
            <TabsContent value="sellers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Marca Mais Vendida por Vendedor</CardTitle>
                  <CardDescription>Qual marca cada vendedor mais vende</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Marca Mais Vendida</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marcaPorVendedor.map((item, index) => (
                          <TableRow key={`${item.vendedor}-${index}`}>
                            <TableCell className="font-medium">{item.vendedor}</TableCell>
                            <TableCell><Badge variant="outline">{item.marca}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Médio de Marca por Vendedor</CardTitle>
                  <CardDescription>Performance de cada vendedor por marca</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketMedioMarcaPorVendedor.slice(0, 50).map((item, index) => (
                          <TableRow key={`${item.vendedor}-${item.marca}-${index}`}>
                            <TableCell className="font-medium">{item.vendedor}</TableCell>
                            <TableCell><Badge variant="outline">{item.marca}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.ticket_medio)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-right">{item.vendas}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ NOVA TAB: Horários */}
            <TabsContent value="hours" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Horário</CardTitle>
                  <CardDescription>Distribuição de vendas ao longo do dia</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vendasPorHorario}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hora" label={{ value: 'Hora do Dia', position: 'insideBottom', offset: -5 }} tickFormatter={(value) => `${value}h`} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} labelFormatter={(label) => `${label}h`} />
                        <Legend />
                        <Bar dataKey="quantidade" fill="#8884d8" name="Quantidade Vendida" />
                        <Bar dataKey="pedidos" fill="#82ca9d" name="Número de Pedidos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Horário</TableHead>
                          <TableHead className="text-right">Quantidade Vendida</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Nº Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendasPorHorario.map((item) => (
                          <TableRow key={item.hora}>
                            <TableCell className="font-medium">{item.hora}h</TableCell>
                            <TableCell className="text-right font-medium">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-right">{item.pedidos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ NOVA TAB: Tickets Médios */}
            <TabsContent value="tickets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Médio por Tamanho</CardTitle>
                  <CardDescription>Valor médio dos pedidos por tamanho</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tamanho</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketMedioPorTamanho.map((item, index) => (
                          <TableRow key={`${item.tamanho}-${index}`}>
                            <TableCell className="font-medium"><Badge variant="outline">{item.tamanho}</Badge></TableCell>
                            <TableCell className="text-right font-medium text-lg">{formatCurrency(item.ticket_medio)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-right">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{item.pedidos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Médio por Marca</CardTitle>
                  <CardDescription>Valor médio dos pedidos por marca</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketMedioPorMarca.map((item, index) => (
                          <TableRow key={`${item.marca}-${index}`}>
                            <TableCell className="font-medium"><Badge variant="outline">{item.marca}</Badge></TableCell>
                            <TableCell className="text-right font-medium text-lg">{formatCurrency(item.ticket_medio)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-right">{item.quantidade.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{item.pedidos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Médio por Horário</CardTitle>
                  <CardDescription>Valor médio dos pedidos em cada horário do dia</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketMedioPorHorario}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hora" label={{ value: 'Hora do Dia', position: 'insideBottom', offset: -5 }} tickFormatter={(value) => `${value}h`} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `${label}h`} />
                        <Legend />
                        <Bar dataKey="ticket_medio" fill="#8884d8" name="Ticket Médio" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Horário</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketMedioPorHorario.map((item) => (
                          <TableRow key={item.hora}>
                            <TableCell className="font-medium">{item.hora}h</TableCell>
                            <TableCell className="text-right font-medium text-lg">{formatCurrency(item.ticket_medio)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-right">{item.pedidos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs >
    </div>
  );
}

