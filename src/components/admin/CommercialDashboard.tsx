import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, startOfDay, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, DollarSign, ShoppingBag, Package, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

// Interfaces
interface StoreAnalytics {
    store_id: string;
    store_name: string;
    total_vendas: number;
    total_valor: number;
    total_pecas: number;
    ticket_medio: number;
    pa: number;
    preco_medio: number;
}

interface StoreBenchmark {
    store_id: string;
    ideal_ticket_medio: number;
    ideal_pa: number;
    ideal_preco_medio: number;
}

interface StoreGoal {
    store_id: string;
    meta_valor: number;
    super_meta_valor: number;
}

interface TodaySales {
    store_id: string;
    store_name: string;
    total_vendas: number;
    total_valor: number;
    total_pecas: number;
    ticket_medio: number;
    pa: number;
}

type QuickFilter = 'today' | 'yesterday' | 'last7' | 'month' | 'lastMonth';
type PeriodFilter = 'today' | 'week' | 'month' | 'custom';

export const CommercialDashboard = () => {
    const [analytics, setAnalytics] = useState<StoreAnalytics[]>([]);
    const [benchmarks, setBenchmarks] = useState<Record<string, StoreBenchmark>>({});
    const [goals, setGoals] = useState<Record<string, StoreGoal>>({});
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date());
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);
    const [todaySales, setTodaySales] = useState<TodaySales[]>([]);
    const [loadingToday, setLoadingToday] = useState(true);
    const [showByStore, setShowByStore] = useState(true); // Toggle para visualização por loja
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('today');
    const [salesSummary, setSalesSummary] = useState<{
        total_valor: number;
        total_vendas: number;
        total_pecas: number;
        ticket_medio: number;
        pa: number;
        stores: TodaySales[];
    } | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [monthlySalesByStore, setMonthlySalesByStore] = useState<Record<string, number>>({}); // Faturamento mensal acumulado por loja
    const hasMountedRef = useRef(false);
    const lastFetchParamsRef = useRef<string>('');

    useEffect(() => {
        // Only fetch once on mount
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            fetchTodaySales();
            fetchData();
            fetchSalesSummary();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Skip on initial mount (already handled above)
        if (!hasMountedRef.current) return;
        
        // Prevent duplicate calls with same params
        const paramsKey = `${month.getTime()}-${periodFilter}-${customStartDate}-${customEndDate}`;
        if (lastFetchParamsRef.current === paramsKey) {
            return;
        }
        lastFetchParamsRef.current = paramsKey;
        
        fetchData();
    }, [month, periodFilter, customStartDate, customEndDate]);

    useEffect(() => {
        // Skip on initial mount (already handled above)
        if (!hasMountedRef.current) return;
        
        fetchSalesSummary();
    }, [quickFilter]);

    const fetchTodaySales = async () => {
        setLoadingToday(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            
            // Buscar vendas de hoje diretamente da tabela sales
            const { data: salesData, error } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('store_id, valor, qtd_pecas, stores(name)')
                .gte('data_venda', `${today}T00:00:00`)
                .lte('data_venda', `${today}T23:59:59`);

            if (error) throw error;

            // Agregar por loja
            const storeAgg: Record<string, TodaySales> = {};

            salesData?.forEach((sale: any) => {
                const storeName = sale.stores?.name || 'Loja Desconhecida';
                if (!storeAgg[sale.store_id]) {
                    storeAgg[sale.store_id] = {
                        store_id: sale.store_id,
                        store_name: storeName,
                        total_vendas: 0,
                        total_valor: 0,
                        total_pecas: 0,
                        ticket_medio: 0,
                        pa: 0
                    };
                }

                storeAgg[sale.store_id].total_vendas += 1;
                storeAgg[sale.store_id].total_valor += Number(sale.valor || 0);
                storeAgg[sale.store_id].total_pecas += Number(sale.qtd_pecas || 0);
            });

            // Calcular KPIs finais
            const finalTodaySales = Object.values(storeAgg).map(s => ({
                ...s,
                ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0
            }));

            setTodaySales(finalTodaySales);
        } catch (error) {
            console.error("Error fetching today's sales:", error);
        } finally {
            setLoadingToday(false);
        }
    };

    const fetchSalesSummary = async () => {
        setLoadingSummary(true);
        try {
            const hoje = new Date();
            let start: string;
            let end: string = format(hoje, 'yyyy-MM-dd');

            switch (quickFilter) {
                case 'today':
                    start = format(startOfDay(hoje), 'yyyy-MM-dd');
                    break;
                case 'yesterday':
                    const yesterday = subDays(hoje, 1);
                    start = format(startOfDay(yesterday), 'yyyy-MM-dd');
                    end = format(startOfDay(yesterday), 'yyyy-MM-dd');
                    break;
                case 'last7':
                    start = format(subDays(hoje, 7), 'yyyy-MM-dd');
                    break;
                case 'month':
                    start = format(startOfMonth(hoje), 'yyyy-MM-dd');
                    end = format(endOfMonth(hoje), 'yyyy-MM-dd');
                    break;
                case 'lastMonth':
                    const lastMonth = subMonths(hoje, 1);
                    start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
                    end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
                    break;
                default:
                    start = format(startOfDay(hoje), 'yyyy-MM-dd');
            }

            // Buscar diretamente da tabela sales
            const { data: salesData, error } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('store_id, valor, qtd_pecas, stores(name)')
                .gte('data_venda', `${start}T00:00:00`)
                .lte('data_venda', `${end}T23:59:59`);

            if (error) throw error;

            // Agregar por loja
            const storeAgg: Record<string, TodaySales> = {};
            let totalValor = 0;
            let totalVendas = 0;
            let totalPecas = 0;

            salesData?.forEach((sale: any) => {
                const storeName = sale.stores?.name || 'Loja Desconhecida';
                if (!storeAgg[sale.store_id]) {
                    storeAgg[sale.store_id] = {
                        store_id: sale.store_id,
                        store_name: storeName,
                        total_vendas: 0,
                        total_valor: 0,
                        total_pecas: 0,
                        ticket_medio: 0,
                        pa: 0
                    };
                }

                const valor = Number(sale.valor || 0);
                const pecas = Number(sale.qtd_pecas || 0);
                
                storeAgg[sale.store_id].total_vendas += 1;
                storeAgg[sale.store_id].total_valor += valor;
                storeAgg[sale.store_id].total_pecas += pecas;

                totalVendas += 1;
                totalValor += valor;
                totalPecas += pecas;
            });

            // Calcular KPIs finais por loja
            const stores = Object.values(storeAgg).map(s => ({
                ...s,
                ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0
            }));

            setSalesSummary({
                total_valor: totalValor,
                total_vendas: totalVendas,
                total_pecas: totalPecas,
                ticket_medio: totalVendas > 0 ? totalValor / totalVendas : 0,
                pa: totalVendas > 0 ? totalPecas / totalVendas : 0,
                stores
            });
        } catch (error) {
            console.error("Error fetching sales summary:", error);
        } finally {
            setLoadingSummary(false);
        }
    };

    const getDateRange = () => {
        const hoje = new Date();
        let start: Date;
        let end: Date = hoje;

        switch (periodFilter) {
            case 'today':
                start = startOfDay(hoje);
                end = hoje;
                break;
            case 'week':
                start = startOfWeek(hoje, { weekStartsOn: 1 });
                end = endOfWeek(hoje, { weekStartsOn: 1 });
                break;
            case 'month':
                start = startOfMonth(month);
                end = endOfMonth(month);
                break;
            case 'custom':
                if (customStartDate && customEndDate) {
                    start = new Date(customStartDate);
                    end = new Date(customEndDate);
                } else {
                    start = startOfMonth(month);
                    end = endOfMonth(month);
                }
                break;
            default:
                start = startOfMonth(month);
                end = endOfMonth(month);
        }

        return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();
            const monthStr = format(month, 'yyyyMM');

            // 1. Fetch Benchmarks
            const { data: benchData } = await supabase.schema('sistemaretiradas').from('store_benchmarks').select('*');
            const benchMap: Record<string, StoreBenchmark> = {};
            benchData?.forEach((b: any) => benchMap[b.store_id] = b);
            setBenchmarks(benchMap);

            // 2. Fetch Goals
            const { data: goalsData } = await supabase
                .schema("sistemaretiradas")
                .from('goals')
                .select('store_id, meta_valor, super_meta_valor')
                .eq('tipo', 'MENSAL')
                .eq('mes_referencia', monthStr);

            const goalsMap: Record<string, StoreGoal> = {};
            goalsData?.forEach((g: any) => goalsMap[g.store_id] = g);
            setGoals(goalsMap);

            // 3. Fetch Sales directly from sales table
            const { data: salesData, error } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('store_id, valor, qtd_pecas, data_venda, stores(name)')
                .gte('data_venda', `${start}T00:00:00`)
                .lte('data_venda', `${end}T23:59:59`)
                .order('data_venda', { ascending: true });

            if (error) throw error;

            // Aggregate by Store
            const storeAgg: Record<string, StoreAnalytics> = {};

            salesData?.forEach((sale: any) => {
                const storeName = sale.stores?.name || 'Loja Desconhecida';
                if (!storeAgg[sale.store_id]) {
                    storeAgg[sale.store_id] = {
                        store_id: sale.store_id,
                        store_name: storeName,
                        total_vendas: 0,
                        total_valor: 0,
                        total_pecas: 0,
                        ticket_medio: 0,
                        pa: 0,
                        preco_medio: 0
                    };
                }

                storeAgg[sale.store_id].total_vendas += 1;
                storeAgg[sale.store_id].total_valor += Number(sale.valor || 0);
                storeAgg[sale.store_id].total_pecas += Number(sale.qtd_pecas || 0);
            });

            // Calculate Final KPIs
            const finalAnalytics = Object.values(storeAgg).map(s => ({
                ...s,
                ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0,
                preco_medio: s.total_pecas > 0 ? s.total_valor / s.total_pecas : 0
            }));

            setAnalytics(finalAnalytics);

            // Prepare daily trends data for charts (with total)
            // Usar data original como chave para garantir ordenação correta
            const trendsMap: Record<string, any> = {};
            salesData?.forEach((sale: any) => {
                const storeName = sale.stores?.name || 'Loja Desconhecida';
                const saleDate = sale.data_venda.split('T')[0]; // yyyy-MM-dd
                const sortKey = saleDate;
                const dateKey = format(new Date(saleDate), 'dd/MM');
                if (!trendsMap[sortKey]) {
                    trendsMap[sortKey] = { date: dateKey, sortKey, total: 0 };
                }
                if (!trendsMap[sortKey][storeName]) {
                    trendsMap[sortKey][storeName] = 0;
                }
                const valor = Number(sale.valor || 0);
                trendsMap[sortKey][storeName] += valor;
                trendsMap[sortKey].total += valor;
            });
            // Ordenar por data original antes de exibir
            const sortedTrends = Object.values(trendsMap).sort((a, b) => 
                a.sortKey.localeCompare(b.sortKey)
            );
            setDailyTrends(sortedTrends);

            // ✅ Buscar faturamento mensal acumulado para calcular progresso mensal corretamente
            // (independente do período filtrado)
            const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
            const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
            
            const { data: monthlyData } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('store_id, valor')
                .gte('data_venda', `${monthStart}T00:00:00`)
                .lte('data_venda', `${monthEnd}T23:59:59`);

            const monthlySalesMap: Record<string, number> = {};
            monthlyData?.forEach((sale: any) => {
                monthlySalesMap[sale.store_id] = (monthlySalesMap[sale.store_id] || 0) + Number(sale.valor || 0);
            });
            setMonthlySalesByStore(monthlySalesMap);

        } catch (error) {
            console.error("Error fetching commercial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getKPIColor = (value: number, benchmark: number) => {
        if (!benchmark) return "text-muted-foreground";
        const ratio = value / benchmark;
        if (ratio >= 1) return "text-status-ahead";
        if (ratio >= 0.9) return "text-status-ontrack";
        return "text-status-behind";
    };

    const todayTotal = todaySales.reduce((sum, store) => sum + store.total_valor, 0);
    const todayTotalVendas = todaySales.reduce((sum, store) => sum + store.total_vendas, 0);
    const todayTotalPecas = todaySales.reduce((sum, store) => sum + store.total_pecas, 0);

    if (loading && loadingToday) {
        return <div className="text-center py-10">Carregando dados comerciais...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Resumo das Vendas - PRINCIPAL */}
            <Card className="border-2 border-primary/20 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            <span className="text-lg sm:text-xl">Resumo das Vendas</span>
                        </div>
                        {/* Filtros Rápidos */}
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <Button
                                variant={quickFilter === 'today' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setQuickFilter('today')}
                                className="text-xs sm:text-sm"
                            >
                                Hoje
                            </Button>
                            <Button
                                variant={quickFilter === 'yesterday' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setQuickFilter('yesterday')}
                                className="text-xs sm:text-sm"
                            >
                                Ontem
                            </Button>
                            <Button
                                variant={quickFilter === 'last7' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setQuickFilter('last7')}
                                className="text-xs sm:text-sm"
                            >
                                Últimos 7 dias
                            </Button>
                            <Button
                                variant={quickFilter === 'month' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setQuickFilter('month')}
                                className="text-xs sm:text-sm"
                            >
                                Mês Atual
                            </Button>
                            <Button
                                variant={quickFilter === 'lastMonth' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setQuickFilter('lastMonth')}
                                className="text-xs sm:text-sm"
                            >
                                Mês Passado
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6">
                    {/* Total Geral */}
                    {loadingSummary ? (
                        <div className="text-center py-6 text-muted-foreground">Carregando dados...</div>
                    ) : salesSummary ? (
                        <>
                            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                                            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-muted-foreground">Faturamento</p>
                                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary break-words">
                                                {formatCurrency(salesSummary.total_valor)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                                            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-primary/80" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm text-muted-foreground">Total de Vendas</p>
                                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary/80">
                                                {salesSummary.total_vendas}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                                            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary/70" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
                                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary/70 break-words">
                                                {formatCurrency(salesSummary.ticket_medio)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                                            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary/60" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm text-muted-foreground">PA</p>
                                            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary/60">
                                                {salesSummary.pa.toFixed(1)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vendas por Loja */}
                            {salesSummary.stores.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {salesSummary.stores.map((store) => (
                                        <Card 
                                            key={store.store_id} 
                                            className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow"
                                        >
                                            <CardHeader className="pb-2 bg-muted/30">
                                                <CardTitle className="text-base sm:text-lg">{store.store_name}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-3 sm:pt-4 space-y-2 sm:space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs sm:text-sm text-muted-foreground">Faturamento:</span>
                                                    <span className="text-lg sm:text-xl font-bold text-primary">
                                                        {formatCurrency(store.total_valor)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center pt-2 border-t">
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Vendas</p>
                                                        <p className="text-sm sm:text-base font-semibold">{store.total_vendas}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Peças</p>
                                                        <p className="text-sm sm:text-base font-semibold">{store.total_pecas}</p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">TM</p>
                                                        <p className="text-[10px] sm:text-xs font-semibold break-words">
                                                            {formatCurrency(store.ticket_medio)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">PA</p>
                                                        <p className="text-[10px] sm:text-xs font-semibold">
                                                            {store.pa.toFixed(1)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 sm:py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm sm:text-base">Nenhuma venda registrada neste período</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm sm:text-base">Nenhuma venda registrada</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filtros de Período - SECUNDÁRIO */}
            <Card className="border border-muted">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="h-4 w-4" />
                        Filtros de Período (Para relatórios detalhados)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <Label>Período</Label>
                            <Select value={periodFilter} onValueChange={(v: PeriodFilter) => setPeriodFilter(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Hoje</SelectItem>
                                    <SelectItem value="week">Esta Semana</SelectItem>
                                    <SelectItem value="month">Este Mês</SelectItem>
                                    <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {periodFilter === 'custom' && (
                            <>
                                <div>
                                    <Label>Data Início</Label>
                                    <Input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Data Fim</Label>
                                    <Input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        {periodFilter === 'month' && (
                            <div>
                                <Label>Mês</Label>
                                <Input
                                    type="month"
                                    value={format(month, 'yyyy-MM')}
                                    onChange={(e) => {
                                        const [year, monthNum] = e.target.value.split('-');
                                        setMonth(new Date(parseInt(year), parseInt(monthNum) - 1));
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Informação sobre relatórios detalhados */}
            {periodFilter !== 'today' && (
                <Card className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/30">
                    <CardContent className="pt-6">
                        <p className="text-sm text-foreground">
                            <strong>Dica:</strong> Para informações mais detalhadas, acesse a página de{" "}
                            <strong>Relatórios</strong> no menu principal.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Gráfico de Tendência Diária */}
            {dailyTrends.length > 0 && (
                <Card className="shadow-lg border-2 border-primary/10">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                Evolução Diária de Vendas
                            </CardTitle>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Label htmlFor="show-by-store" className="text-xs sm:text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
                                    {showByStore ? <Eye className="h-3 w-3 sm:h-4 sm:w-4" /> : <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />}
                                    <span className="hidden sm:inline">Por Loja</span>
                                </Label>
                                <Switch
                                    id="show-by-store"
                                    checked={showByStore}
                                    onCheckedChange={setShowByStore}
                                />
                                <span className="text-xs sm:text-sm text-muted-foreground sm:hidden">Loja</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 sm:pt-6">
                        <ResponsiveContainer width="100%" height={300} className="min-h-[250px] sm:min-h-[300px]">
                            <LineChart data={dailyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    {Object.keys(dailyTrends[0] || {}).filter(key => !['date', 'sortKey', 'total'].includes(key)).map((storeName, idx) => (
                                        <linearGradient key={`gradient-${storeName}`} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={`hsl(${idx * 137.5}, 70%, 50%)`} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={`hsl(${idx * 137.5}, 70%, 50%)`} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#6b7280"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis 
                                    stroke="#6b7280"
                                    style={{ fontSize: '12px' }}
                                    tickFormatter={(value) => `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`}
                                />
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                                />
                                <Legend 
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="line"
                                />
                                {showByStore ? (
                                    Object.keys(dailyTrends[0] || {}).filter(key => !['date', 'sortKey', 'total'].includes(key)).map((storeName, idx) => (
                                        <Line
                                            key={storeName}
                                            type="monotone"
                                            dataKey={storeName}
                                            stroke={`hsl(${idx * 137.5}, 70%, 50%)`}
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: `hsl(${idx * 137.5}, 70%, 50%)` }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))
                                ) : (
                                    <Line
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#8884d8"
                                        strokeWidth={3}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6 }}
                                        name="Total"
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Gráfico de Comparação entre Lojas */}
            {analytics.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">Comparação de Vendas por Loja</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 sm:pt-6">
                        <ResponsiveContainer width="100%" height={280} className="min-h-[250px] sm:min-h-[280px]">
                            <BarChart data={analytics} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                    dataKey="store_name" 
                                    stroke="#6b7280"
                                    style={{ fontSize: '11px' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis 
                                    stroke="#6b7280"
                                    style={{ fontSize: '11px' }}
                                    tickFormatter={(value) => `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`}
                                />
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                    formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} 
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Bar dataKey="total_valor" fill="#8884d8" name="Vendas (R$)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Cards de KPIs por Loja */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {analytics.map(store => {
                    const goal = goals[store.store_id];
                    const bench = benchmarks[store.store_id];
                    // ✅ Usar faturamento mensal acumulado para calcular progresso mensal, não o do período filtrado
                    const monthlyTotal = monthlySalesByStore[store.store_id] || 0;
                    const progress = goal ? (monthlyTotal / goal.meta_valor) * 100 : 0;

                    return (
                        <Card key={store.store_id} className="overflow-hidden border-t-4 border-t-primary shadow-md hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2 bg-muted/20">
                                <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                                    <span className="text-base sm:text-lg">{store.store_name}</span>
                                    <span className="text-xs sm:text-sm font-normal text-muted-foreground capitalize">
                                        {format(month, 'MMMM/yyyy', { locale: ptBR })}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 sm:pt-4 space-y-4 sm:space-y-6">
                                {/* Main Goal Progress */}
                                <div>
                                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                                        <span className="text-muted-foreground">Meta Mensal</span>
                                        <span className={`font-bold text-sm sm:text-base ${progress >= 100 ? 'text-status-ahead' : 'text-primary'}`}>
                                            {progress.toFixed(1)}%
                                        </span>
                                    </div>
                                    <Progress value={progress} className="h-2 sm:h-3" />
                                    <div className="flex justify-between text-[10px] sm:text-xs mt-1 text-muted-foreground">
                                        <span className="break-words pr-1">R$ {monthlyTotal.toLocaleString('pt-BR')}</span>
                                        <span className="break-words pl-1">R$ {goal?.meta_valor?.toLocaleString('pt-BR') || '0'}</span>
                                    </div>
                                </div>

                                {/* Summary KPIs */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-t pt-3">
                                    <div className="p-2 bg-primary/10 dark:bg-primary/5 rounded-lg">
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Vendas</div>
                                        <div className="font-bold text-sm sm:text-base text-primary">
                                            {store.total_vendas}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-primary/10 dark:bg-primary/5 rounded-lg">
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Ticket Médio</div>
                                        <div className={`font-bold text-xs sm:text-sm ${getKPIColor(store.ticket_medio, bench?.ideal_ticket_medio)}`}>
                                            {formatCurrency(store.ticket_medio, { decimals: 0 })}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-primary/10 dark:bg-primary/5 rounded-lg">
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">P.A.</div>
                                        <div className={`font-bold text-xs sm:text-sm ${getKPIColor(store.pa, bench?.ideal_pa)}`}>
                                            {store.pa.toFixed(1)}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-primary/10 dark:bg-primary/5 rounded-lg">
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Preço Médio</div>
                                        <div className={`font-bold text-xs sm:text-sm ${getKPIColor(store.preco_medio, bench?.ideal_preco_medio)}`}>
                                            {formatCurrency(store.preco_medio, { decimals: 0 })}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {analytics.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        Nenhuma venda registrada neste mês.
                    </div>
                )}
            </div>
        </div>
    );
};
