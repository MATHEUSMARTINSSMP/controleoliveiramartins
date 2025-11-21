import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp } from "lucide-react";

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

type PeriodFilter = 'today' | 'week' | 'month' | 'custom';

export const CommercialDashboard = () => {
    const [analytics, setAnalytics] = useState<StoreAnalytics[]>([]);
    const [benchmarks, setBenchmarks] = useState<Record<string, StoreBenchmark>>({});
    const [goals, setGoals] = useState<Record<string, StoreGoal>>({});
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date());
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, [month, periodFilter, customStartDate, customEndDate]);

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
                .from('goals')
                .select('store_id, meta_valor, super_meta_valor')
                .eq('tipo', 'MENSAL')
                .eq('mes_referencia', monthStr);

            const goalsMap: Record<string, StoreGoal> = {};
            goalsData?.forEach((g: any) => goalsMap[g.store_id] = g);
            setGoals(goalsMap);

            // 3. Fetch Sales Analytics (Aggregated by Store)
            const { data: dailyData, error } = await supabase
                .schema('sistemaretiradas')
                .from('analytics_daily_performance')
                .select('*')
                .gte('data_referencia', start)
                .lte('data_referencia', end)
                .order('data_referencia', { ascending: true });

            if (error) throw error;

            // Aggregate by Store
            const storeAgg: Record<string, StoreAnalytics> = {};

            dailyData?.forEach((day: any) => {
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

            // Calculate Final KPIs
            const finalAnalytics = Object.values(storeAgg).map(s => ({
                ...s,
                ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0,
                preco_medio: s.total_pecas > 0 ? s.total_valor / s.total_pecas : 0
            }));

            setAnalytics(finalAnalytics);

            // Prepare daily trends data for charts
            const trendsMap: Record<string, any> = {};
            dailyData?.forEach((day: any) => {
                const dateKey = format(new Date(day.data_referencia), 'dd/MM');
                if (!trendsMap[dateKey]) {
                    trendsMap[dateKey] = { date: dateKey };
                }
                trendsMap[dateKey][day.store_name] = day.total_valor;
            });
            setDailyTrends(Object.values(trendsMap));

        } catch (error) {
            console.error("Error fetching commercial data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get color based on performance vs benchmark
    const getKPIColor = (value: number, benchmark: number) => {
        if (!benchmark) return "text-gray-500";
        const ratio = value / benchmark;
        if (ratio >= 1) return "text-green-600";
        if (ratio >= 0.9) return "text-yellow-600";
        return "text-red-600";
    };

    if (loading) {
        return <div className="text-center py-10">Carregando dados comerciais...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Filtros de Período */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Filtros de Período
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            {/* Gráfico de Tendência Diária */}
            {dailyTrends.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Evolução Diária de Vendas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
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
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Gráfico de Comparação entre Lojas */}
            {analytics.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Comparação de Vendas por Loja</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="store_name" />
                                <YAxis />
                                <Tooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Legend />
                                <Bar dataKey="total_valor" fill="#8884d8" name="Vendas (R$)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Cards de KPIs por Loja */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analytics.map(store => {
                    const goal = goals[store.store_id];
                    const bench = benchmarks[store.store_id];
                    const progress = goal ? (store.total_valor / goal.meta_valor) * 100 : 0;

                    return (
                        <Card key={store.store_id} className="overflow-hidden border-t-4 border-t-primary shadow-md hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2 bg-muted/20">
                                <CardTitle className="flex justify-between items-center">
                                    <span>{store.store_name}</span>
                                    <span className="text-sm font-normal text-muted-foreground capitalize">
                                        {format(month, 'MMMM/yyyy', { locale: ptBR })}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-6">
                                {/* Main Goal Progress */}
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">Meta Mensal</span>
                                        <span className={`font-bold ${progress >= 100 ? 'text-green-600' : 'text-primary'}`}>
                                            {progress.toFixed(1)}%
                                        </span>
                                    </div>
                                    <Progress value={progress} className="h-3" />
                                    <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                                        <span>R$ {store.total_valor.toLocaleString('pt-BR')}</span>
                                        <span>R$ {goal?.meta_valor?.toLocaleString('pt-BR') || '0'}</span>
                                    </div>
                                </div>

                                {/* KPIs Grid */}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-muted/30 rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Ticket Médio</div>
                                        <div className={`font-bold ${getKPIColor(store.ticket_medio, bench?.ideal_ticket_medio)}`}>
                                            R$ {store.ticket_medio.toFixed(0)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Meta: {bench?.ideal_ticket_medio || '-'}</div>
                                    </div>
                                    <div className="p-2 bg-muted/30 rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">P.A.</div>
                                        <div className={`font-bold ${getKPIColor(store.pa, bench?.ideal_pa)}`}>
                                            {store.pa.toFixed(1)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Meta: {bench?.ideal_pa || '-'}</div>
                                    </div>
                                    <div className="p-2 bg-muted/30 rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Preço Médio</div>
                                        <div className={`font-bold ${getKPIColor(store.preco_medio, bench?.ideal_preco_medio)}`}>
                                            R$ {store.preco_medio.toFixed(0)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Meta: {bench?.ideal_preco_medio || '-'}</div>
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
