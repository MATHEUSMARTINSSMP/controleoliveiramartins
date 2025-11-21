import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Trash2, ChevronDown, ChevronRight, Undo2, TrendingUp, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subDays, startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ParcelaData {
  id: string;
  compra_id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  data_baixa: string | null;
}

interface CompraData {
  id: string;
  colaboradora_nome: string;
  item: string;
  data_compra: string;
  preco_final: number;
  num_parcelas: number;
  parcelas: ParcelaData[];
}

interface DeletedItem {
  type: 'compra' | 'parcela' | 'adiantamento';
  id: string;
  compraId?: string;
  timestamp: number;
}

interface AdiantamentoData {
  id: string;
  colaboradora_id: string;
  colaboradora_nome: string;
  valor: number;
  data_solicitacao: string;
  mes_competencia: string;
  status: string;
  motivo_recusa: string | null;
}

const Relatorios = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [compras, setCompras] = useState<CompraData[]>([]);
  const [adiantamentos, setAdiantamentos] = useState<AdiantamentoData[]>([]);
  const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'compra' | 'parcela' | 'adiantamento'; id: string; compraId?: string } | null>(null);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [expandedCompras, setExpandedCompras] = useState<Set<string>>(new Set());
  
  const [filtros, setFiltros] = useState({
    mes: "TODOS_MESES",
    status: "TODOS_STATUS",
    tipo: "TODOS",
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    mes: "",
    status: "",
    tipo: "TODOS",
  });
  const [salesAnalytics, setSalesAnalytics] = useState<any[]>([]);
  const [storeComparison, setStoreComparison] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<Record<string, any>>({});
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'last7' | 'last30' | 'month' | 'lastMonth' | 'custom'>('last30');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    if (!loading && (!profile || profile.role !== "ADMIN")) {
      navigate("/");
    } else if (profile) {
      fetchData();
    }
  }, [profile, loading, navigate]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: colabData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .eq("role", "COLABORADORA")
        .eq("active", true);
      
      if (colabData) setColaboradoras(colabData);

      const { data: comprasData, error } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select(`
          id,
          item,
          data_compra,
          preco_final,
          num_parcelas,
          colaboradora_id,
          parcelas(
            id,
            n_parcela,
            competencia,
            valor_parcela,
            status_parcela,
            data_baixa
          )
        `)
        .order("data_compra", { ascending: false });

      if (error) throw error;

      // Buscar perfis das colaboradoras separadamente
      const colaboradoraIds = [...new Set(comprasData?.map((c: any) => c.colaboradora_id) || [])];
      const { data: profilesData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      const formattedData: CompraData[] = comprasData?.map((c: any) => ({
        id: c.id,
        colaboradora_nome: profilesMap.get(c.colaboradora_id) || "Desconhecido",
        item: c.item,
        data_compra: c.data_compra,
        preco_final: c.preco_final,
        num_parcelas: c.num_parcelas,
        parcelas: c.parcelas || [],
      })) || [];

      setCompras(formattedData);

      // Buscar adiantamentos
      const { data: adiantamentosData, error: adiantamentosError } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("*")
        .order("data_solicitacao", { ascending: false });

      if (adiantamentosError) throw adiantamentosError;

      // Buscar perfis das colaboradoras para adiantamentos
      const adiantamentoColaboradoraIds = [...new Set(adiantamentosData?.map(a => a.colaboradora_id) || [])];
      const { data: adiantamentoProfilesData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .in("id", adiantamentoColaboradoraIds);

      const adiantamentoProfilesMap = new Map(adiantamentoProfilesData?.map(p => [p.id, p.name]) || []);

      const formattedAdiantamentos: AdiantamentoData[] = adiantamentosData?.map((a: any) => ({
        ...a,
        colaboradora_nome: adiantamentoProfilesMap.get(a.colaboradora_id) || "Desconhecido"
      })) || [];

      setAdiantamentos(formattedAdiantamentos);
      
      // Buscar dados de analytics e benchmarks para gráficos
      await fetchAnalyticsData();
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const hoje = new Date();
      let start: Date;
      let end: Date = hoje;

      switch (periodFilter) {
        case 'today':
          start = startOfDay(hoje);
          end = hoje;
          break;
        case 'last7':
          start = subDays(hoje, 7);
          break;
        case 'last30':
          start = subDays(hoje, 30);
          break;
        case 'month':
          start = startOfMonth(hoje);
          end = endOfMonth(hoje);
          break;
        case 'lastMonth':
          const firstDayThisMonth = startOfMonth(hoje);
          start = startOfMonth(subDays(firstDayThisMonth, 1));
          end = endOfMonth(subDays(firstDayThisMonth, 1));
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            start = new Date(customStartDate);
            end = new Date(customEndDate);
          } else {
            start = subDays(hoje, 30);
          }
          break;
        default:
          start = subDays(hoje, 30);
      }

      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Buscar benchmarks
      const { data: benchData } = await supabase
        .schema('sistemaretiradas')
        .from('store_benchmarks')
        .select('*');

      const benchMap: Record<string, any> = {};
      benchData?.forEach((b: any) => benchMap[b.store_id] = b);
      setBenchmarks(benchMap);

      // Buscar analytics diários
      const { data: analyticsData } = await supabase
        .schema('sistemaretiradas')
        .from('analytics_daily_performance')
        .select('*')
        .gte('data_referencia', startStr)
        .lte('data_referencia', endStr)
        .order('data_referencia', { ascending: true });

      if (analyticsData) {
        // Preparar dados de tendência diária
        const trendsMap: Record<string, any> = {};
        analyticsData.forEach((day: any) => {
          const dateKey = format(new Date(day.data_referencia), 'dd/MM');
          if (!trendsMap[dateKey]) {
            trendsMap[dateKey] = { date: dateKey };
          }
          trendsMap[dateKey][day.store_name] = day.total_valor;
        });
        setDailyTrends(Object.values(trendsMap));

        // Agregar por loja
        const storeAgg: Record<string, any> = {};
        analyticsData.forEach((day: any) => {
          if (!storeAgg[day.store_id]) {
            storeAgg[day.store_id] = {
              store_id: day.store_id,
              store_name: day.store_name,
              total_vendas: 0,
              total_valor: 0,
              total_pecas: 0,
              ticket_medio: 0,
              pa: 0,
              preco_medio: 0
            };
          }
          storeAgg[day.store_id].total_vendas += day.total_vendas;
          storeAgg[day.store_id].total_valor += day.total_valor;
          storeAgg[day.store_id].total_pecas += day.total_pecas;
        });

        const finalStoreData = Object.values(storeAgg).map((s: any) => ({
          ...s,
          ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
          pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0,
          preco_medio: s.total_pecas > 0 ? s.total_valor / s.total_pecas : 0,
          ideal_ticket_medio: benchMap[s.store_id]?.ideal_ticket_medio || 0,
          ideal_pa: benchMap[s.store_id]?.ideal_pa || 0,
          ideal_preco_medio: benchMap[s.store_id]?.ideal_preco_medio || 0
        }));

        setStoreComparison(finalStoreData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchAnalyticsData();
    }
  }, [periodFilter, customStartDate, customEndDate, profile]);

  const handleDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.type === 'compra') {
        // Deletar parcelas primeiro
        const { error: parcelasError } = await supabase
          .schema("sistemaretiradas")
          .from("parcelas")
          .delete()
          .eq("compra_id", deleteDialog.id);

        if (parcelasError) throw parcelasError;

        // Deletar compra
        const { error: compraError } = await supabase
          .schema("sistemaretiradas")
          .from("purchases")
          .delete()
          .eq("id", deleteDialog.id);

        if (compraError) throw compraError;

        setDeletedItems([...deletedItems, { type: 'compra', id: deleteDialog.id, timestamp: Date.now() }]);
        toast.success("Compra excluída! Você pode desfazer nos próximos 30 segundos.");
      } else if (deleteDialog.type === 'parcela') {
        // Deletar parcela
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("parcelas")
          .delete()
          .eq("id", deleteDialog.id);

        if (error) throw error;

        setDeletedItems([...deletedItems, { 
          type: 'parcela', 
          id: deleteDialog.id, 
          compraId: deleteDialog.compraId,
          timestamp: Date.now() 
        }]);
        toast.success("Parcela excluída! Você pode desfazer nos próximos 30 segundos.");
      } else if (deleteDialog.type === 'adiantamento') {
        // Deletar adiantamento
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("adiantamentos")
          .delete()
          .eq("id", deleteDialog.id);

        if (error) throw error;

        setDeletedItems([...deletedItems, { type: 'adiantamento', id: deleteDialog.id, timestamp: Date.now() }]);
        toast.success("Adiantamento excluído! Você pode desfazer nos próximos 30 segundos.");
      }

      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleUndo = async (item: DeletedItem) => {
    // Remove from deleted items
    setDeletedItems(deletedItems.filter(d => d.id !== item.id));
    toast.success("Exclusão desfeita!");
    fetchData();
  };

  // Auto-remove deleted items after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDeletedItems(prev => prev.filter(item => now - item.timestamp < 30000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getMesesDisponiveis = () => {
    const mesesSet = new Set<string>();
    compras.forEach(c => {
      c.parcelas.forEach(p => mesesSet.add(p.competencia));
    });
    adiantamentos.forEach(a => {
      mesesSet.add(a.mes_competencia);
    });
    return Array.from(mesesSet).sort().reverse();
  };

  const aplicarFiltros = () => {
    setFiltrosAplicados({
      mes: filtros.mes,
      status: filtros.status,
      tipo: filtros.tipo,
    });
  };

  const filteredCompras = compras.filter(c => {
    // Filter by deleted items
    if (deletedItems.some(d => d.type === 'compra' && d.id === c.id)) return false;
    
    // Filter by type
    if (filtrosAplicados.tipo === "ADIANTAMENTOS") return false;
    
    // Filter by month and status (check if any parcela matches)
    if (filtrosAplicados.mes || filtrosAplicados.status) {
      const hasMatchingParcela = c.parcelas.some(p => {
        if (filtrosAplicados.mes && p.competencia !== filtrosAplicados.mes) return false;
        if (filtrosAplicados.status && p.status_parcela !== filtrosAplicados.status) return false;
        return true;
      });
      if (!hasMatchingParcela) return false;
    }
    
    return true;
  });

  const filteredAdiantamentos = adiantamentos.filter(a => {
    // Filter by deleted items
    if (deletedItems.some(d => d.type === 'adiantamento' && d.id === a.id)) return false;
    
    // Filter by type
    if (filtrosAplicados.tipo === "COMPRAS") return false;
    
    // Filter by month
    if (filtrosAplicados.mes && a.mes_competencia !== filtrosAplicados.mes) return false;
    
    // Filter by status
    if (filtrosAplicados.status && a.status !== filtrosAplicados.status) return false;
    
    return true;
  });

  const exportToCSV = () => {
    const headers = ["Colaboradora", "Item", "Data Compra", "Valor Total", "Parcelas", "Parcela N°", "Competência", "Valor Parcela", "Status"];
    const rows: string[][] = [];
    
    filteredCompras.forEach(c => {
      c.parcelas.forEach(p => {
        rows.push([
          c.colaboradora_nome,
          c.item,
          format(new Date(c.data_compra), "dd/MM/yyyy"),
          formatCurrency(c.preco_final, { showSymbol: false }),
          c.num_parcelas.toString(),
          p.n_parcela.toString(),
          `${p.competencia.substring(4)}/${p.competencia.substring(0, 4)}`,
          formatCurrency(p.valor_parcela, { showSymbol: false }),
          p.status_parcela,
        ]);
      });
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const toggleCompra = (compraId: string) => {
    const newExpanded = new Set(expandedCompras);
    if (newExpanded.has(compraId)) {
      newExpanded.delete(compraId);
    } else {
      newExpanded.add(compraId);
    }
    setExpandedCompras(newExpanded);
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-3 sm:p-4">
      <div className="container mx-auto py-4 sm:py-8">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-3 sm:mb-4 text-xs sm:text-sm" size="sm">
          <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg sm:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Relatórios
              </CardTitle>
              <Button onClick={exportToCSV} variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <Tabs defaultValue="compras" className="space-y-3 sm:space-y-4">
              <TabsList className="grid w-full grid-cols-2 h-auto">
                <TabsTrigger value="compras" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                  <span className="hidden sm:inline">Compras & Adiantamentos</span>
                  <span className="sm:hidden">Compras</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="text-xs sm:text-sm px-2 sm:px-3 py-2">
                  <span className="hidden sm:inline">Análise Comercial</span>
                  <span className="sm:hidden">Comercial</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compras" className="space-y-3 sm:space-y-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={filtros.mes} onValueChange={(v) => setFiltros({ ...filtros, mes: v === "TODOS_MESES" ? "" : v })}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS_MESES">Todos os meses</SelectItem>
                  {getMesesDisponiveis().map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {mes.slice(0, 4)}/{mes.slice(4)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtros.status} onValueChange={(v) => setFiltros({ ...filtros, status: v === "TODOS_STATUS" ? "" : v })}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS_STATUS">Todos os status</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="DESCONTADO">Descontado</SelectItem>
                  <SelectItem value="ESTORNADO">Estornado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtros.tipo} onValueChange={(v) => setFiltros({ ...filtros, tipo: v })}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="COMPRAS">Compras</SelectItem>
                  <SelectItem value="ADIANTAMENTOS">Adiantamentos</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={aplicarFiltros} className="w-full text-xs sm:text-sm" size="sm">
                Filtrar
              </Button>
            </div>

            {deletedItems.length > 0 && (
              <div className="mb-4 space-y-2">
                {deletedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                    <span className="text-sm">
                      {item.type === 'compra' ? 'Compra excluída' : item.type === 'parcela' ? 'Parcela excluída' : 'Adiantamento excluído'} - Você pode desfazer
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(item)}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Desfazer
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Compras Section */}
                {(filtrosAplicados.tipo === "TODOS" || filtrosAplicados.tipo === "COMPRAS") && (
                  <div className="space-y-2">
                    {filteredCompras.length > 0 && (
                      <h3 className="text-lg font-semibold text-foreground mb-2">Compras</h3>
                    )}
                    {filteredCompras.map((compra) => (
                    <Collapsible
                      key={compra.id}
                      open={expandedCompras.has(compra.id)}
                      onOpenChange={() => toggleCompra(compra.id)}
                    >
                      <div className="rounded-lg border border-primary/10 bg-card">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 hover:bg-accent/5 cursor-pointer transition-colors">
                            <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                              {expandedCompras.has(compra.id) ? (
                                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 flex-1 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Colaboradora</p>
                                  <p className="font-medium text-xs sm:text-sm truncate">{compra.colaboradora_nome}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Item</p>
                                  <p className="font-medium text-xs sm:text-sm truncate">{compra.item}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Data Compra</p>
                                  <p className="font-medium text-xs sm:text-sm">{format(new Date(compra.data_compra), "dd/MM/yyyy")}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Valor Total</p>
                                  <p className="font-medium text-xs sm:text-sm">{formatCurrency(compra.preco_final)}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Parcelas</p>
                                  <p className="font-medium text-xs sm:text-sm">{compra.num_parcelas}x de {formatCurrency(compra.preco_final / compra.num_parcelas)}</p>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDialog({ type: 'compra', id: compra.id });
                              }}
                              className="text-destructive hover:text-destructive ml-2 flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="border-t border-primary/10 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs sm:text-sm">Parcela</TableHead>
                                  <TableHead className="text-xs sm:text-sm">Competência</TableHead>
                                  <TableHead className="text-xs sm:text-sm">Valor</TableHead>
                                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Data Baixa</TableHead>
                                  <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {compra.parcelas
                                  .filter(p => !deletedItems.some(d => d.type === 'parcela' && d.id === p.id))
                                  .map((parcela) => (
                                  <TableRow key={parcela.id}>
                                    <TableCell className="text-xs sm:text-sm">{parcela.n_parcela}/{compra.num_parcelas}</TableCell>
                                    <TableCell className="text-xs sm:text-sm">
                                      {parcela.competencia.substring(4)}/{parcela.competencia.substring(0, 4)}
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm font-medium">{formatCurrency(parcela.valor_parcela)}</TableCell>
                                    <TableCell className="text-xs sm:text-sm">
                                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] sm:text-xs font-medium ${
                                        parcela.status_parcela === "DESCONTADO" ? "bg-success/10 text-success" :
                                        parcela.status_parcela === "AGENDADO" ? "bg-primary/10 text-primary" :
                                        parcela.status_parcela === "ESTORNADO" ? "bg-destructive/10 text-destructive" :
                                        "bg-muted text-muted-foreground"
                                      }`}>
                                        {parcela.status_parcela}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                                      {parcela.data_baixa ? format(new Date(parcela.data_baixa), "dd/MM/yyyy") : "-"}
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteDialog({ type: 'parcela', id: parcela.id, compraId: compra.id })}
                                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                    ))}
                  </div>
                )}

                {/* Adiantamentos Section */}
                {(filtrosAplicados.tipo === "TODOS" || filtrosAplicados.tipo === "ADIANTAMENTOS") && (
                  <div className="space-y-2">
                    {filteredAdiantamentos.length > 0 && (
                      <h3 className="text-lg font-semibold text-foreground mb-2">Adiantamentos</h3>
                    )}
                    {filteredAdiantamentos.map((adiantamento) => (
                      <div key={adiantamento.id} className="rounded-lg border border-primary/10 bg-card p-3 sm:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">Colaboradora</p>
                            <p className="font-medium text-xs sm:text-sm truncate">{adiantamento.colaboradora_nome}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">Valor</p>
                            <p className="font-medium text-xs sm:text-sm">{formatCurrency(adiantamento.valor)}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">Data Solicitação</p>
                            <p className="font-medium text-xs sm:text-sm">{format(new Date(adiantamento.data_solicitacao), "dd/MM/yyyy")}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-muted-foreground">Competência</p>
                            <p className="font-medium text-xs sm:text-sm">
                              {adiantamento.mes_competencia.substring(4)}/{adiantamento.mes_competencia.substring(0, 4)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between sm:block">
                            <div className="flex-1 sm:flex-none">
                              <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                              <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] sm:text-xs font-medium ${
                                adiantamento.status === "DESCONTADO" ? "bg-success/10 text-success" :
                                adiantamento.status === "APROVADO" ? "bg-primary/10 text-primary" :
                                adiantamento.status === "RECUSADO" ? "bg-destructive/10 text-destructive" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {adiantamento.status}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ type: 'adiantamento', id: adiantamento.id })}
                              className="text-destructive hover:text-destructive flex-shrink-0 h-8 w-8 p-0 sm:mt-2 sm:ml-0"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                        {adiantamento.motivo_recusa && (
                          <div className="mt-3 pt-3 border-t border-primary/10">
                            <p className="text-xs sm:text-sm text-muted-foreground">Motivo da Recusa:</p>
                            <p className="text-xs sm:text-sm">{adiantamento.motivo_recusa}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {filteredCompras.length === 0 && filteredAdiantamentos.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum registro encontrado
                  </div>
                )}
              </div>
            )}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                {/* Filtros de Período para Analytics */}
                <Card>
                  <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Filtros de Período</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-xs sm:text-sm">Período</Label>
                        <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Hoje</SelectItem>
                            <SelectItem value="last7">Últimos 7 dias</SelectItem>
                            <SelectItem value="last30">Últimos 30 dias</SelectItem>
                            <SelectItem value="month">Mês Atual</SelectItem>
                            <SelectItem value="lastMonth">Mês Passado</SelectItem>
                            <SelectItem value="custom">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {periodFilter === 'custom' && (
                        <>
                          <div>
                            <Label className="text-xs sm:text-sm">Data Início</Label>
                            <Input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm">Data Fim</Label>
                            <Input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="text-xs sm:text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico de Evolução Diária */}
                {dailyTrends.length > 0 && (
                  <Card>
                    <CardHeader className="p-3 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Evolução Diária de Vendas por Loja</span>
                        <span className="sm:hidden">Evolução Diária</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <ResponsiveContainer width="100%" height={300} className="min-h-[250px] sm:min-h-[350px]">
                        <LineChart data={dailyTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                          <Legend />
                          {Object.keys(dailyTrends[0] || {}).filter(key => key !== 'date').map((storeName, idx) => (
                            <Line
                              key={storeName}
                              type="monotone"
                              dataKey={storeName}
                              stroke={`hsl(${idx * 137.5}, 70%, 50%)`}
                              strokeWidth={2}
                              name={storeName}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Comparação de Vendas por Loja */}
                {storeComparison.length > 0 && (
                  <Card>
                    <CardHeader className="p-3 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Comparação de Vendas por Loja</span>
                        <span className="sm:hidden">Comparação</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <ResponsiveContainer width="100%" height={300} className="min-h-[250px] sm:min-h-[350px]">
                        <BarChart data={storeComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="store_name" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                          <Legend />
                          <Bar dataKey="total_valor" fill="#8884d8" name="Vendas Totais (R$)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Comparação com Benchmarks */}
                {storeComparison.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Ticket Médio vs Benchmark */}
                    <Card>
                      <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg">Ticket Médio vs Meta</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <ResponsiveContainer width="100%" height={250} className="min-h-[200px] sm:min-h-[250px]">
                          <BarChart data={storeComparison}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="store_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="ticket_medio" fill="#8884d8" name="Real" />
                            <Bar dataKey="ideal_ticket_medio" fill="#82ca9d" name="Meta" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* PA vs Benchmark */}
                    <Card>
                      <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg">P.A. vs Meta</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <ResponsiveContainer width="100%" height={250} className="min-h-[200px] sm:min-h-[250px]">
                          <BarChart data={storeComparison}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="store_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                            <Legend />
                            <Bar dataKey="pa" fill="#8884d8" name="Real" />
                            <Bar dataKey="ideal_pa" fill="#82ca9d" name="Meta" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Preço Médio vs Benchmark */}
                    <Card>
                      <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg">Preço Médio vs Meta</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <ResponsiveContainer width="100%" height={250} className="min-h-[200px] sm:min-h-[250px]">
                          <BarChart data={storeComparison}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="store_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="preco_medio" fill="#8884d8" name="Real" />
                            <Bar dataKey="ideal_preco_medio" fill="#82ca9d" name="Meta" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {storeComparison.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground">
                        Nenhum dado disponível para o período selecionado.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === 'compra' 
                ? 'Tem certeza que deseja excluir esta compra? Todas as parcelas associadas serão excluídas. Você terá 30 segundos para desfazer.'
                : deleteDialog?.type === 'parcela'
                ? 'Tem certeza que deseja excluir esta parcela? Você terá 30 segundos para desfazer.'
                : 'Tem certeza que deseja excluir este adiantamento? Você terá 30 segundos para desfazer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Relatorios;
