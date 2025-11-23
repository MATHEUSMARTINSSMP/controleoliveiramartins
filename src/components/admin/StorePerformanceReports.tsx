import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { Calendar, TrendingUp, DollarSign, ShoppingBag, Package, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StorePerformance {
    store_id: string;
    store_name: string;
    total_valor: number;
    total_vendas: number;
    total_pecas: number;
    ticket_medio: number;
    pa: number;
    preco_medio: number;
}

interface PeriodReport {
    period: string;
    stores: StorePerformance[];
    totals: {
        total_valor: number;
        total_vendas: number;
        total_pecas: number;
        ticket_medio: number;
        pa: number;
    };
}

export const StorePerformanceReports = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<Record<string, PeriodReport>>({});
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        if (profile && profile.role === 'ADMIN') {
            fetchStores();
        }
    }, [profile]);

    useEffect(() => {
        if (stores.length > 0) {
            fetchAllReports();
        }
    }, [stores]);

    const fetchStores = async () => {
        try {
            // Buscar todas as lojas associadas ao admin
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('admin_id', profile?.id)
                .eq('active', true)
                .order('name', { ascending: true });

            if (error) throw error;

            setStores(data || []);
        } catch (error) {
            console.error('Erro ao buscar lojas:', error);
        }
    };

    const fetchAllReports = async () => {
        setLoading(true);
        try {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length === 0) {
                setLoading(false);
                return;
            }

            const hoje = new Date();
            const periods = {
                'dia': {
                    start: format(startOfDay(hoje), 'yyyy-MM-dd'),
                    end: format(hoje, 'yyyy-MM-dd'),
                    label: 'Hoje'
                },
                'semana': {
                    start: format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                    end: format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                    label: 'Semana Atual'
                },
                'ultimos7': {
                    start: format(subDays(hoje, 7), 'yyyy-MM-dd'),
                    end: format(hoje, 'yyyy-MM-dd'),
                    label: 'Últimos 7 Dias'
                },
                'mes_atual': {
                    start: format(startOfMonth(hoje), 'yyyy-MM-dd'),
                    end: format(endOfMonth(hoje), 'yyyy-MM-dd'),
                    label: 'Mês Atual'
                },
                'mes_anterior': {
                    start: format(startOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd'),
                    end: format(endOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd'),
                    label: 'Mês Anterior'
                }
            };

            const allReports: Record<string, PeriodReport> = {};

            // Buscar dados para cada período
            for (const [key, period] of Object.entries(periods)) {
                const { data: dailyData, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('analytics_daily_performance')
                    .select('*')
                    .in('store_id', storeIds)
                    .gte('data_referencia', period.start)
                    .lte('data_referencia', period.end)
                    .order('store_name', { ascending: true });

                if (error) {
                    console.error(`Erro ao buscar dados do período ${key}:`, error);
                    continue;
                }

                // Agregar por loja
                const storeAgg: Record<string, StorePerformance> = {};
                let totalValor = 0;
                let totalVendas = 0;
                let totalPecas = 0;

                dailyData?.forEach((day: any) => {
                    if (!storeAgg[day.store_id]) {
                        storeAgg[day.store_id] = {
                            store_id: day.store_id,
                            store_name: day.store_name,
                            total_valor: 0,
                            total_vendas: 0,
                            total_pecas: 0,
                            ticket_medio: 0,
                            pa: 0,
                            preco_medio: 0
                        };
                    }

                    storeAgg[day.store_id].total_vendas += day.total_vendas || 0;
                    storeAgg[day.store_id].total_valor += day.total_valor || 0;
                    storeAgg[day.store_id].total_pecas += day.total_pecas || 0;

                    totalVendas += day.total_vendas || 0;
                    totalValor += day.total_valor || 0;
                    totalPecas += day.total_pecas || 0;
                });

                // Calcular KPIs por loja
                const storePerformances = Object.values(storeAgg).map(s => ({
                    ...s,
                    ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                    pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0,
                    preco_medio: s.total_pecas > 0 ? s.total_valor / s.total_pecas : 0
                }));

                // Garantir que todas as lojas apareçam, mesmo sem vendas
                stores.forEach(store => {
                    if (!storePerformances.find(sp => sp.store_id === store.id)) {
                        storePerformances.push({
                            store_id: store.id,
                            store_name: store.name,
                            total_valor: 0,
                            total_vendas: 0,
                            total_pecas: 0,
                            ticket_medio: 0,
                            pa: 0,
                            preco_medio: 0
                        });
                    }
                });

                // Ordenar por valor total (maior primeiro)
                storePerformances.sort((a, b) => b.total_valor - a.total_valor);

                allReports[key] = {
                    period: period.label,
                    stores: storePerformances,
                    totals: {
                        total_valor: totalValor,
                        total_vendas: totalVendas,
                        total_pecas: totalPecas,
                        ticket_medio: totalVendas > 0 ? totalValor / totalVendas : 0,
                        pa: totalVendas > 0 ? totalPecas / totalVendas : 0
                    }
                };
            }

            setReports(allReports);
        } catch (error) {
            console.error('Erro ao buscar relatórios:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderPeriodTable = (periodKey: string, report: PeriodReport) => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {/* Resumo Total */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Resumo Geral - {report.period}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                            <div className="text-center">
                                <p className="text-xs sm:text-sm text-muted-foreground">Total Vendido</p>
                                <p className="text-base sm:text-lg font-bold text-primary">
                                    {formatCurrency(report.totals.total_valor)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs sm:text-sm text-muted-foreground">Total Vendas</p>
                                <p className="text-base sm:text-lg font-bold">{report.totals.total_vendas}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs sm:text-sm text-muted-foreground">Total Peças</p>
                                <p className="text-base sm:text-lg font-bold">{report.totals.total_pecas}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
                                <p className="text-base sm:text-lg font-bold">
                                    {formatCurrency(report.totals.ticket_medio)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs sm:text-sm text-muted-foreground">PA</p>
                                <p className="text-base sm:text-lg font-bold">
                                    {report.totals.pa.toFixed(1)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabela por Loja */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Performance por Loja</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm font-bold min-w-[150px]">Loja</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">Total Vendido</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">Vendas</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">Peças</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">Ticket Médio</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">PA</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-center">Preço Médio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.stores.map((store) => (
                                        <TableRow key={store.store_id}>
                                            <TableCell className="text-xs sm:text-sm font-medium">
                                                {store.store_name}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center font-semibold text-primary">
                                                {formatCurrency(store.total_valor)}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center">
                                                {store.total_vendas}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center">
                                                {store.total_pecas}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center">
                                                {formatCurrency(store.ticket_medio)}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center">
                                                {store.pa.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm text-center">
                                                {formatCurrency(store.preco_medio)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Linha de Total */}
                                    <TableRow className="bg-primary/5 font-bold border-t-2 border-primary">
                                        <TableCell className="text-xs sm:text-sm font-bold">TOTAL</TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold text-primary">
                                            {formatCurrency(report.totals.total_valor)}
                                        </TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold">
                                            {report.totals.total_vendas}
                                        </TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold">
                                            {report.totals.total_pecas}
                                        </TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold">
                                            {formatCurrency(report.totals.ticket_medio)}
                                        </TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold">
                                            {report.totals.pa.toFixed(1)}
                                        </TableCell>
                                        <TableCell className="text-xs sm:text-sm text-center font-bold">
                                            {formatCurrency(
                                                report.totals.total_pecas > 0
                                                    ? report.totals.total_valor / report.totals.total_pecas
                                                    : 0
                                            )}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    if (!profile || profile.role !== 'ADMIN') {
        return null;
    }

    if (stores.length === 0 && !loading) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        Nenhuma loja associada ao seu perfil de administrador.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Relatórios de Performance por Loja
                    </CardTitle>
                </CardHeader>
            </Card>

            <Tabs defaultValue="dia" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2">
                    <TabsTrigger value="dia" className="text-xs sm:text-sm">
                        Hoje
                    </TabsTrigger>
                    <TabsTrigger value="semana" className="text-xs sm:text-sm">
                        Semana
                    </TabsTrigger>
                    <TabsTrigger value="ultimos7" className="text-xs sm:text-sm">
                        7 Dias
                    </TabsTrigger>
                    <TabsTrigger value="mes_atual" className="text-xs sm:text-sm">
                        Mês Atual
                    </TabsTrigger>
                    <TabsTrigger value="mes_anterior" className="text-xs sm:text-sm">
                        Mês Anterior
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dia">
                    {reports.dia ? renderPeriodTable('dia', reports.dia) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="semana">
                    {reports.semana ? renderPeriodTable('semana', reports.semana) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="ultimos7">
                    {reports.ultimos7 ? renderPeriodTable('ultimos7', reports.ultimos7) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mes_atual">
                    {reports.mes_atual ? renderPeriodTable('mes_atual', reports.mes_atual) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mes_anterior">
                    {reports.mes_anterior ? renderPeriodTable('mes_anterior', reports.mes_anterior) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

