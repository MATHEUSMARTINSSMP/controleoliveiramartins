import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, startOfDay, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { Calendar, TrendingUp, DollarSign, ShoppingBag, Package, Loader2, Users } from "lucide-react";
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

interface CollaboratorPerformance {
    colaboradora_id: string;
    colaboradora_name: string;
    vendido_mes: number;
    vendido_dia: number;
    falta_meta_mes: number;
    falta_meta_dia: number;
    pa_mes: number;
    ticket_medio_mes: number;
    total_vendas_mes: number;
    total_pecas_mes: number;
    meta_mensal: number;
    meta_diaria: number;
}

interface StoreGoalProjection {
    store_id: string;
    store_name: string;
    vendido_mes: number;
    meta_mensal: number;
    esperado_ate_data: number;
    diferenca: number;
    percentual_atingimento: number;
    projecao_faturamento: number;
}

export const StorePerformanceReports = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<Record<string, PeriodReport>>({});
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    
    // Estados para relatório de vendedores
    const [selectedStoreForVendedores, setSelectedStoreForVendedores] = useState<string>('');
    const [vendedoresData, setVendedoresData] = useState<CollaboratorPerformance[]>([]);
    const [loadingVendedores, setLoadingVendedores] = useState(false);
    
    // Estados para filtros personalizados
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [customReport, setCustomReport] = useState<PeriodReport | null>(null);
    const [loadingCustom, setLoadingCustom] = useState(false);
    
    // Estados para metas e projeções
    const [goalsProjections, setGoalsProjections] = useState<StoreGoalProjection[]>([]);
    const [loadingGoals, setLoadingGoals] = useState(false);

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
            const ontem = subDays(hoje, 1);
            const periods = {
                'dia': {
                    start: format(startOfDay(hoje), 'yyyy-MM-dd'),
                    end: format(hoje, 'yyyy-MM-dd'),
                    label: 'Hoje'
                },
                'ontem': {
                    start: format(startOfDay(ontem), 'yyyy-MM-dd'),
                    end: format(startOfDay(ontem), 'yyyy-MM-dd'),
                    label: 'Ontem'
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

    const fetchCustomPeriod = async () => {
        if (!customStartDate || !customEndDate) {
            return;
        }

        setLoadingCustom(true);
        try {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length === 0) {
                setLoadingCustom(false);
                return;
            }

            const { data: dailyData, error } = await supabase
                .schema('sistemaretiradas')
                .from('analytics_daily_performance')
                .select('*')
                .in('store_id', storeIds)
                .gte('data_referencia', customStartDate)
                .lte('data_referencia', customEndDate)
                .order('store_name', { ascending: true });

            if (error) throw error;

            // Agregar por loja (mesmo código do fetchAllReports)
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

            const storePerformances = Object.values(storeAgg).map(s => ({
                ...s,
                ticket_medio: s.total_vendas > 0 ? s.total_valor / s.total_vendas : 0,
                pa: s.total_vendas > 0 ? s.total_pecas / s.total_vendas : 0,
                preco_medio: s.total_pecas > 0 ? s.total_valor / s.total_pecas : 0
            }));

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

            storePerformances.sort((a, b) => b.total_valor - a.total_valor);

            setCustomReport({
                period: `${format(new Date(customStartDate), 'dd/MM/yyyy')} a ${format(new Date(customEndDate), 'dd/MM/yyyy')}`,
                stores: storePerformances,
                totals: {
                    total_valor: totalValor,
                    total_vendas: totalVendas,
                    total_pecas: totalPecas,
                    ticket_medio: totalVendas > 0 ? totalValor / totalVendas : 0,
                    pa: totalVendas > 0 ? totalPecas / totalVendas : 0
                }
            });
        } catch (error) {
            console.error('Erro ao buscar período personalizado:', error);
        } finally {
            setLoadingCustom(false);
        }
    };

    const fetchVendedoresPerformance = async () => {
        if (!selectedStoreForVendedores) {
            setVendedoresData([]);
            return;
        }

        setLoadingVendedores(true);
        try {
            const hoje = new Date();
            const mesAtual = format(hoje, 'yyyyMM');
            const hojeStr = format(hoje, 'yyyy-MM-dd');
            const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
            const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');

            // Buscar colaboradoras ativas da loja
            const { data: colaboradoras, error: colabError } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .eq('role', 'COLABORADORA')
                .eq('store_id', selectedStoreForVendedores)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (colabError) throw colabError;

            if (!colaboradoras || colaboradoras.length === 0) {
                setVendedoresData([]);
                setLoadingVendedores(false);
                return;
            }

            const colaboradoraIds = colaboradoras.map(c => c.id);
            const performances: CollaboratorPerformance[] = [];

            // Buscar metas e vendas para cada colaboradora
            for (const colab of colaboradoras) {
                // Buscar meta individual
                const { data: goal } = await supabase
                    .schema('sistemaretiradas')
                    .from('goals')
                    .select('meta_valor, daily_weights')
                    .eq('colaboradora_id', colab.id)
                    .eq('store_id', selectedStoreForVendedores)
                    .eq('mes_referencia', mesAtual)
                    .eq('tipo', 'INDIVIDUAL')
                    .maybeSingle();

                // Buscar vendas do mês
                const { data: salesMes } = await supabase
                    .schema('sistemaretiradas')
                    .from('sales')
                    .select('valor, qtd_pecas')
                    .eq('colaboradora_id', colab.id)
                    .gte('data_venda', `${inicioMes}T00:00:00`)
                    .lte('data_venda', `${fimMes}T23:59:59`);

                // Buscar vendas do dia
                const { data: salesDia } = await supabase
                    .schema('sistemaretiradas')
                    .from('sales')
                    .select('valor, qtd_pecas')
                    .eq('colaboradora_id', colab.id)
                    .gte('data_venda', `${hojeStr}T00:00:00`)
                    .lte('data_venda', `${hojeStr}T23:59:59`);

                const vendidoMes = salesMes?.reduce((sum, s) => sum + Number(s.valor || 0), 0) || 0;
                const vendidoDia = salesDia?.reduce((sum, s) => sum + Number(s.valor || 0), 0) || 0;
                const totalVendasMes = salesMes?.length || 0;
                const totalPecasMes = salesMes?.reduce((sum, s) => sum + Number(s.qtd_pecas || 0), 0) || 0;

                const metaMensal = goal ? Number(goal.meta_valor || 0) : 0;
                
                // Calcular meta diária
                let metaDiaria = 0;
                if (goal && metaMensal > 0) {
                    const dailyWeights = goal.daily_weights || {};
                    if (Object.keys(dailyWeights).length > 0) {
                        const hojePeso = dailyWeights[hojeStr] || 0;
                        metaDiaria = (metaMensal * hojePeso) / 100;
                    } else {
                        const totalDias = getDaysInMonth(hoje);
                        metaDiaria = metaMensal / totalDias;
                    }
                }

                const faltaMetaMes = Math.max(0, metaMensal - vendidoMes);
                const faltaMetaDia = Math.max(0, metaDiaria - vendidoDia);
                const paMes = totalVendasMes > 0 ? totalPecasMes / totalVendasMes : 0;
                const ticketMedioMes = totalVendasMes > 0 ? vendidoMes / totalVendasMes : 0;

                performances.push({
                    colaboradora_id: colab.id,
                    colaboradora_name: colab.name,
                    vendido_mes: vendidoMes,
                    vendido_dia: vendidoDia,
                    falta_meta_mes: faltaMetaMes,
                    falta_meta_dia: faltaMetaDia,
                    pa_mes: paMes,
                    ticket_medio_mes: ticketMedioMes,
                    total_vendas_mes: totalVendasMes,
                    total_pecas_mes: totalPecasMes,
                    meta_mensal: metaMensal,
                    meta_diaria: metaDiaria
                });
            }

            // Ordenar por vendido no mês (maior primeiro)
            performances.sort((a, b) => b.vendido_mes - a.vendido_mes);

            setVendedoresData(performances);
        } catch (error) {
            console.error('Erro ao buscar performance de vendedores:', error);
        } finally {
            setLoadingVendedores(false);
        }
    };

    useEffect(() => {
        if (selectedStoreForVendedores) {
            fetchVendedoresPerformance();
        }
    }, [selectedStoreForVendedores]);

    const fetchGoalsProjections = async () => {
        if (stores.length === 0) return;
        
        setLoadingGoals(true);
        try {
            const hoje = new Date();
            const mesAtual = format(hoje, 'yyyyMM');
            const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
            const diaAtual = hoje.getDate();
            
            const projections: StoreGoalProjection[] = [];
            
            for (const store of stores) {
                // Buscar meta mensal da loja (tipo LOJA)
                const { data: goalData } = await supabase
                    .schema('sistemaretiradas')
                    .from('goals')
                    .select('meta_valor, daily_weights')
                    .eq('store_id', store.id)
                    .eq('mes_referencia', mesAtual)
                    .eq('tipo', 'LOJA')
                    .maybeSingle();
                
                const metaMensal = goalData ? Number(goalData.meta_valor || 0) : 0;
                const dailyWeights = goalData?.daily_weights || {};
                
                // Calcular o esperado até a data usando os pesos diários
                let esperadoAteData = 0;
                if (metaMensal > 0 && Object.keys(dailyWeights).length > 0) {
                    // Somar os pesos diários do dia 1 até hoje
                    for (let dia = 1; dia <= diaAtual; dia++) {
                        const dataStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), dia), 'yyyy-MM-dd');
                        const peso = dailyWeights[dataStr] || 0;
                        esperadoAteData += (metaMensal * peso) / 100;
                    }
                } else if (metaMensal > 0) {
                    // Se não há pesos, distribuir igualmente
                    const totalDias = getDaysInMonth(hoje);
                    esperadoAteData = (metaMensal / totalDias) * diaAtual;
                }
                
                // Buscar vendas do mês atual
                const { data: salesData } = await supabase
                    .schema('sistemaretiradas')
                    .from('analytics_daily_performance')
                    .select('total_valor')
                    .eq('store_id', store.id)
                    .gte('data_referencia', inicioMes)
                    .lte('data_referencia', format(hoje, 'yyyy-MM-dd'));
                
                const vendidoMes = salesData?.reduce((sum, s) => sum + Number(s.total_valor || 0), 0) || 0;
                
                // Calcular diferença e percentual com proteção contra divisão por zero
                const diferenca = esperadoAteData - vendidoMes;
                
                let percentualAtingimento = 0;
                let projecaoFaturamento = 0;
                
                if (esperadoAteData > 0) {
                    percentualAtingimento = (vendidoMes / esperadoAteData) * 100;
                    projecaoFaturamento = metaMensal * (vendidoMes / esperadoAteData);
                } else if (metaMensal > 0 && vendidoMes > 0) {
                    // Se não há esperado mas há vendas, considerar vendido como projeção mínima
                    percentualAtingimento = 100;
                    projecaoFaturamento = vendidoMes;
                } else if (metaMensal === 0 && vendidoMes > 0) {
                    // Sem meta definida mas com vendas
                    percentualAtingimento = 100;
                    projecaoFaturamento = vendidoMes;
                }
                
                projections.push({
                    store_id: store.id,
                    store_name: store.name,
                    vendido_mes: vendidoMes,
                    meta_mensal: metaMensal,
                    esperado_ate_data: esperadoAteData,
                    diferenca: diferenca,
                    percentual_atingimento: percentualAtingimento,
                    projecao_faturamento: projecaoFaturamento
                });
            }
            
            // Ordenar por projeção de faturamento (maior primeiro)
            projections.sort((a, b) => b.projecao_faturamento - a.projecao_faturamento);
            
            setGoalsProjections(projections);
        } catch (error) {
            console.error('Erro ao buscar metas e projeções:', error);
        } finally {
            setLoadingGoals(false);
        }
    };
    
    useEffect(() => {
        if (stores.length > 0) {
            fetchGoalsProjections();
        }
    }, [stores]);

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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                            <div className="text-center space-y-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Vendido</p>
                                <p className="text-xs sm:text-base lg:text-lg font-bold text-primary truncate">
                                    {formatCurrency(report.totals.total_valor)}
                                </p>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Vendas</p>
                                <p className="text-xs sm:text-base lg:text-lg font-bold">{report.totals.total_vendas}</p>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Peças</p>
                                <p className="text-xs sm:text-base lg:text-lg font-bold">{report.totals.total_pecas}</p>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Ticket Médio</p>
                                <p className="text-xs sm:text-base lg:text-lg font-bold truncate">
                                    {formatCurrency(report.totals.ticket_medio)}
                                </p>
                            </div>
                            <div className="text-center space-y-1 col-span-2 sm:col-span-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">PA</p>
                                <p className="text-xs sm:text-base lg:text-lg font-bold">
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

            <Tabs defaultValue="loja" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 gap-2">
                    <TabsTrigger value="loja" className="text-xs sm:text-sm">
                        Performance por Loja
                    </TabsTrigger>
                    <TabsTrigger value="vendedor" className="text-xs sm:text-sm">
                        Performance por Vendedor
                    </TabsTrigger>
                    <TabsTrigger value="metas" className="text-xs sm:text-sm">
                        Metas e Projeções
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="loja" className="space-y-4">
                    <Tabs defaultValue="dia" className="space-y-4">
                        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                            <TabsTrigger value="dia" className="text-xs px-2 py-1.5 flex-1 min-w-[60px]">
                                Hoje
                            </TabsTrigger>
                            <TabsTrigger value="ontem" className="text-xs px-2 py-1.5 flex-1 min-w-[60px]">
                                Ontem
                            </TabsTrigger>
                            <TabsTrigger value="semana" className="text-xs px-2 py-1.5 flex-1 min-w-[70px]">
                                Semana
                            </TabsTrigger>
                            <TabsTrigger value="ultimos7" className="text-xs px-2 py-1.5 flex-1 min-w-[60px]">
                                7 Dias
                            </TabsTrigger>
                            <TabsTrigger value="mes_atual" className="text-xs px-2 py-1.5 flex-1 min-w-[80px]">
                                Mês Atual
                            </TabsTrigger>
                            <TabsTrigger value="mes_anterior" className="text-xs px-2 py-1.5 flex-1 min-w-[90px]">
                                Mês Anterior
                            </TabsTrigger>
                            <TabsTrigger value="personalizado" className="text-xs px-2 py-1.5 flex-1 min-w-[100px]">
                                Personalizado
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

                <TabsContent value="ontem">
                    {reports.ontem ? renderPeriodTable('ontem', reports.ontem) : (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="personalizado">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base sm:text-lg">Período Personalizado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customStart" className="text-xs sm:text-sm">Data Inicial</Label>
                                    <Input
                                        id="customStart"
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customEnd" className="text-xs sm:text-sm">Data Final</Label>
                                    <Input
                                        id="customEnd"
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={fetchCustomPeriod}
                                disabled={!customStartDate || !customEndDate || loadingCustom}
                                className="w-full sm:w-auto"
                                size="sm"
                            >
                                {loadingCustom ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Carregando...
                                    </>
                                ) : (
                                    'Buscar Relatório'
                                )}
                            </Button>
                            {customReport && renderPeriodTable('personalizado', customReport)}
                        </CardContent>
                    </Card>
                </TabsContent>
                    </Tabs>
                </TabsContent>

                <TabsContent value="vendedor" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Performance por Vendedor
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="storeSelect" className="text-xs sm:text-sm">Selecionar Loja</Label>
                                <Select value={selectedStoreForVendedores} onValueChange={setSelectedStoreForVendedores}>
                                    <SelectTrigger id="storeSelect" className="text-xs sm:text-sm">
                                        <SelectValue placeholder="Selecione uma loja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map(store => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {loadingVendedores ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : vendedoresData.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs sm:text-sm font-bold min-w-[150px]">Vendedor</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Vendido no Mês</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Vendido no Dia</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Falta Meta Mês</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Falta Meta Dia</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">PA no Mês</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Ticket Médio Mês</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vendedoresData.map((vendedor) => (
                                                <TableRow key={vendedor.colaboradora_id}>
                                                    <TableCell className="text-xs sm:text-sm font-medium">
                                                        {vendedor.colaboradora_name}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center font-semibold text-primary">
                                                        {formatCurrency(vendedor.vendido_mes)}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center font-semibold">
                                                        {formatCurrency(vendedor.vendido_dia)}
                                                    </TableCell>
                                                    <TableCell className={`text-xs sm:text-sm text-center font-semibold ${
                                                        vendedor.falta_meta_mes > 0 ? 'text-status-behind' : 'text-status-ahead'
                                                    }`}>
                                                        {formatCurrency(vendedor.falta_meta_mes)}
                                                    </TableCell>
                                                    <TableCell className={`text-xs sm:text-sm text-center font-semibold ${
                                                        vendedor.falta_meta_dia > 0 ? 'text-status-behind' : 'text-status-ahead'
                                                    }`}>
                                                        {formatCurrency(vendedor.falta_meta_dia)}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center">
                                                        {vendedor.pa_mes.toFixed(1)}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center">
                                                        {formatCurrency(vendedor.ticket_medio_mes)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : selectedStoreForVendedores ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        Nenhum vendedor encontrado para esta loja.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        Selecione uma loja para ver a performance dos vendedores.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="metas" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Metas e Projeções do Mês Atual
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingGoals ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : goalsProjections.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs sm:text-sm font-bold min-w-[150px]">Loja</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Vendido no Mês</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Meta Mensal</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Esperado até Hoje</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Diferença</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">% Atingimento</TableHead>
                                                <TableHead className="text-xs sm:text-sm text-center">Projeção Final</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {goalsProjections.map((projection) => (
                                                <TableRow key={projection.store_id}>
                                                    <TableCell className="text-xs sm:text-sm font-medium">
                                                        {projection.store_name}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center font-semibold text-primary">
                                                        {formatCurrency(projection.vendido_mes)}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center">
                                                        {formatCurrency(projection.meta_mensal)}
                                                    </TableCell>
                                                    <TableCell className="text-xs sm:text-sm text-center">
                                                        {formatCurrency(projection.esperado_ate_data)}
                                                    </TableCell>
                                                    <TableCell className={`text-xs sm:text-sm text-center font-semibold ${
                                                        projection.diferenca > 0 ? 'text-status-behind' : 'text-status-ahead'
                                                    }`}>
                                                        {projection.diferenca > 0 ? '-' : '+'}
                                                        {formatCurrency(Math.abs(projection.diferenca))}
                                                    </TableCell>
                                                    <TableCell className={`text-xs sm:text-sm text-center font-semibold ${
                                                        projection.percentual_atingimento >= 100 ? 'text-status-ahead' : 
                                                        projection.percentual_atingimento >= 80 ? 'text-status-warning' : 'text-status-behind'
                                                    }`}>
                                                        {projection.percentual_atingimento.toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell className={`text-xs sm:text-sm text-center font-bold ${
                                                        projection.projecao_faturamento >= projection.meta_mensal ? 'text-status-ahead' : 'text-status-behind'
                                                    }`}>
                                                        {formatCurrency(projection.projecao_faturamento)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {/* Linha de Total */}
                                            <TableRow className="bg-primary/5 font-bold border-t-2 border-primary">
                                                <TableCell className="text-xs sm:text-sm font-bold">TOTAL</TableCell>
                                                <TableCell className="text-xs sm:text-sm text-center font-bold text-primary">
                                                    {formatCurrency(goalsProjections.reduce((sum, p) => sum + p.vendido_mes, 0))}
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm text-center font-bold">
                                                    {formatCurrency(goalsProjections.reduce((sum, p) => sum + p.meta_mensal, 0))}
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm text-center font-bold">
                                                    {formatCurrency(goalsProjections.reduce((sum, p) => sum + p.esperado_ate_data, 0))}
                                                </TableCell>
                                                <TableCell className={`text-xs sm:text-sm text-center font-bold ${
                                                    goalsProjections.reduce((sum, p) => sum + p.diferenca, 0) > 0 ? 'text-status-behind' : 'text-status-ahead'
                                                }`}>
                                                    {goalsProjections.reduce((sum, p) => sum + p.diferenca, 0) > 0 ? '-' : '+'}
                                                    {formatCurrency(Math.abs(goalsProjections.reduce((sum, p) => sum + p.diferenca, 0)))}
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm text-center font-bold">
                                                    {(() => {
                                                        const totalEsperado = goalsProjections.reduce((sum, p) => sum + p.esperado_ate_data, 0);
                                                        const totalVendido = goalsProjections.reduce((sum, p) => sum + p.vendido_mes, 0);
                                                        return totalEsperado > 0 ? ((totalVendido / totalEsperado) * 100).toFixed(1) : '0.0';
                                                    })()}%
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm text-center font-bold">
                                                    {formatCurrency(goalsProjections.reduce((sum, p) => sum + p.projecao_faturamento, 0))}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        Nenhuma meta configurada para as lojas no mês atual.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

