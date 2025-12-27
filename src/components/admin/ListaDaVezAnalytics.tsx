import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Download, Loader2, BarChart3, Users, Clock, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListaDaVezAnalytics } from "@/hooks/use-lista-da-vez-analytics";
import * as XLSX from "xlsx";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const ListaDaVezAnalytics = () => {
    const { profile } = useAuth();
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'lastMonth' | 'custom'>('month');
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

    const {
        loading,
        getStoreDetailedMetrics,
        getPeriodTrends,
        getLossReasonsAnalytics,
        getHourlyAnalytics,
        getCollaboratorsRanking,
        comparePeriods,
        exportAttendanceData
    } = useListaDaVezAnalytics(selectedStoreId !== 'all' ? selectedStoreId : null);

    const [storeMetrics, setStoreMetrics] = useState<any>(null);
    const [trends, setTrends] = useState<any[]>([]);
    const [lossReasons, setLossReasons] = useState<any[]>([]);
    const [hourlyData, setHourlyData] = useState<any[]>([]);
    const [ranking, setRanking] = useState<any[]>([]);
    const [comparison, setComparison] = useState<any[]>([]);

    useEffect(() => {
        fetchStores();
    }, [profile]);

    // Quando stores são carregadas, selecionar primeira loja se necessário
    useEffect(() => {
        if (stores.length > 0 && (selectedStoreId === 'all' || !selectedStoreId)) {
            setSelectedStoreId(stores[0].id);
        }
    }, [stores]);

    useEffect(() => {
        if (stores.length > 0 && selectedStoreId && selectedStoreId !== 'all') {
            fetchAllAnalytics();
        } else {
            // Limpar dados quando não há loja selecionada ou é 'all'
            setStoreMetrics(null);
            setTrends([]);
            setLossReasons([]);
            setHourlyData([]);
            setRanking([]);
            setComparison([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStoreId, period, startDate, endDate, groupBy]);

    const fetchStores = async () => {
        if (!profile?.id) return;

        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('admin_id', profile.id)
                .order('name');

            if (error) throw error;
            setStores(data || []);
        } catch (error: any) {
            console.error('[ListaDaVezAnalytics] Erro ao buscar lojas:', error);
        }
    };

    const getDateRange = () => {
        const today = new Date();
        let start: Date;
        let end: Date = endOfDay(today);

        switch (period) {
            case 'today':
                start = startOfDay(today);
                end = endOfDay(today);
                break;
            case 'week':
                start = startOfDay(subDays(today, 7));
                end = endOfDay(today);
                break;
            case 'month':
                start = startOfMonth(today);
                end = endOfDay(today);
                break;
            case 'lastMonth':
                start = startOfMonth(subMonths(today, 1));
                end = endOfMonth(subMonths(today, 1));
                break;
            case 'custom':
                start = new Date(startDate);
                end = new Date(endDate);
                break;
            default:
                start = startOfMonth(today);
                end = endOfDay(today);
        }

        return { start, end };
    };

    const fetchAllAnalytics = async () => {
        if (selectedStoreId === 'all') return;

        const { start, end } = getDateRange();

        try {
            const [
                metricsData,
                trendsData,
                lossReasonsData,
                hourlyDataResult,
                rankingData
            ] = await Promise.all([
                getStoreDetailedMetrics(start, end),
                getPeriodTrends(start, end, groupBy),
                getLossReasonsAnalytics(start, end),
                getHourlyAnalytics(start, end),
                getCollaboratorsRanking(start, end, 10)
            ]);

            setStoreMetrics(metricsData);
            setTrends(trendsData || []);
            setLossReasons(lossReasonsData || []);
            setHourlyData(hourlyDataResult || []);
            setRanking(rankingData || []);

            // Comparação com período anterior
            if (period === 'month') {
                const lastMonthStart = startOfMonth(subMonths(start, 1));
                const lastMonthEnd = endOfMonth(subMonths(start, 1));
                const comparisonData = await comparePeriods(start, end, lastMonthStart, lastMonthEnd);
                setComparison(comparisonData || []);
            }
        } catch (error: any) {
            console.error('[ListaDaVezAnalytics] Erro ao buscar analytics:', error);
        }
    };

    const handleExport = async () => {
        if (selectedStoreId === 'all') return;

        const { start, end } = getDateRange();
        const data = await exportAttendanceData(start, end);

        if (data.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');
        XLSX.writeFile(wb, `lista-da-vez-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.xlsx`);
    };

    const trendsChartData = trends.map(t => ({
        periodo: t.period_label,
        atendimentos: t.total_attendances,
        vendas: t.total_sales,
        conversao: t.conversion_rate
    }));

    const hourlyChartData = Array.from({ length: 24 }, (_, i) => {
        const hourData = hourlyData.find(h => h.hour === i);
        return {
            hora: `${i}h`,
            atendimentos: hourData?.total_attendances || 0,
            vendas: hourData?.total_sales || 0,
            conversao: hourData?.conversion_rate || 0
        };
    });

    const lossReasonsPieData = lossReasons.map((lr, idx) => ({
        name: lr.loss_reason_name,
        value: lr.total_losses,
        color: COLORS[idx % COLORS.length]
    }));

    // Sempre renderizar, mesmo sem dados
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Analytics Detalhada</CardTitle>
                    <CardDescription>
                        Análise detalhada de desempenho, tendências e métricas avançadas
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label>Loja</Label>
                            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as lojas</SelectItem>
                                    {stores.map(store => (
                                        <SelectItem key={store.id} value={store.id}>
                                            {store.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Período</Label>
                            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Hoje</SelectItem>
                                    <SelectItem value="week">Últimos 7 dias</SelectItem>
                                    <SelectItem value="month">Este mês</SelectItem>
                                    <SelectItem value="lastMonth">Mês anterior</SelectItem>
                                    <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {period === 'custom' && (
                            <>
                                <div>
                                    <Label>Data Inicial</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Data Final</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        {period !== 'custom' && (
                            <div>
                                <Label>Agrupar por</Label>
                                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="day">Dia</SelectItem>
                                        <SelectItem value="week">Semana</SelectItem>
                                        <SelectItem value="month">Mês</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <Button onClick={handleExport} variant="outline" className="w-full md:w-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Dados (Excel)
                    </Button>
                </CardContent>
            </Card>

            {loading && !storeMetrics ? (
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            ) : storeMetrics ? (
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                        <TabsTrigger value="trends">Tendências</TabsTrigger>
                        <TabsTrigger value="hourly">Por Horário</TabsTrigger>
                        <TabsTrigger value="losses">Motivos de Perda</TabsTrigger>
                        <TabsTrigger value="ranking">Ranking</TabsTrigger>
                        {comparison.length > 0 && (
                            <TabsTrigger value="comparison">Comparação</TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Atendimentos</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{storeMetrics.total_attendances}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Taxa Conversão</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{storeMetrics.conversion_rate.toFixed(1)}%</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Faturamento</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{formatCurrency(storeMetrics.total_sale_value)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Tempo Médio</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">
                                        {Math.floor(storeMetrics.avg_attendance_duration / 60)}min
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {storeMetrics.top_collaborator_name && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Top Colaboradora</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{storeMetrics.top_collaborator_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {storeMetrics.top_collaborator_sales} vendas realizadas
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="trends" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tendências de Atendimentos e Vendas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={trendsChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="periodo" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="atendimentos" stroke="#0088FE" name="Atendimentos" />
                                        <Line type="monotone" dataKey="vendas" stroke="#00C49F" name="Vendas" />
                                        <Line type="monotone" dataKey="conversao" stroke="#FF8042" name="Conversão %" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="hourly" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Analytics por Horário do Dia</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={hourlyChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="hora" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="atendimentos" fill="#0088FE" name="Atendimentos" />
                                        <Bar dataKey="vendas" fill="#00C49F" name="Vendas" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="losses" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Análise de Motivos de Perda</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={lossReasonsPieData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {lossReasonsPieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Motivo</TableHead>
                                                <TableHead>Quantidade</TableHead>
                                                <TableHead>Percentual</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {lossReasons.map(lr => (
                                                <TableRow key={lr.loss_reason_id}>
                                                    <TableCell>{lr.loss_reason_name}</TableCell>
                                                    <TableCell>{lr.total_losses}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={lr.percentual} className="w-20" />
                                                            <span>{lr.percentual.toFixed(1)}%</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="ranking" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ranking de Colaboradoras</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Posição</TableHead>
                                            <TableHead>Colaboradora</TableHead>
                                            <TableHead>Atendimentos</TableHead>
                                            <TableHead>Vendas</TableHead>
                                            <TableHead>Taxa Conversão</TableHead>
                                            <TableHead>Faturamento</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ranking.map((colab, idx) => (
                                            <TableRow key={colab.profile_id}>
                                                <TableCell>
                                                    <Badge variant={idx < 3 ? "default" : "outline"}>
                                                        {colab.rank}º
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{colab.profile_name}</TableCell>
                                                <TableCell>{colab.total_attendances}</TableCell>
                                                <TableCell>{colab.total_sales}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={colab.conversion_rate} className="w-20" />
                                                        <span>{colab.conversion_rate.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatCurrency(colab.total_sale_value)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {comparison.length > 0 && (
                        <TabsContent value="comparison" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Comparação com Período Anterior</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Métrica</TableHead>
                                                <TableHead>Período Atual</TableHead>
                                                <TableHead>Período Anterior</TableHead>
                                                <TableHead>Diferença</TableHead>
                                                <TableHead>Variação %</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {comparison.map((comp, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{comp.metric_name}</TableCell>
                                                    <TableCell>{comp.period2_value.toFixed(2)}</TableCell>
                                                    <TableCell>{comp.period1_value.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <span className={comp.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            {comp.difference >= 0 ? '+' : ''}{comp.difference.toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {comp.percent_change >= 0 ? (
                                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <TrendingDown className="h-4 w-4 text-red-600" />
                                                            )}
                                                            <span className={comp.percent_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                {comp.percent_change >= 0 ? '+' : ''}{comp.percent_change.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>
            ) : (
                <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                        {stores.length === 0 ? (
                            <p>Carregando lojas...</p>
                        ) : selectedStoreId === 'all' ? (
                            <p>Selecione uma loja específica para ver as analytics</p>
                        ) : (
                            <p>Nenhum dado disponível para o período selecionado</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

