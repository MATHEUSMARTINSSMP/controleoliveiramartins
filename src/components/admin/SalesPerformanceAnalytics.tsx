import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingBag, AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CollaboratorPerformance {
    colaboradora_id: string;
    colaboradora_nome: string;
    total_vendas: number;
    total_valor: number;
    total_pecas: number;
    ticket_medio: number;
    pa: number;
    vendas_perdidas: number;
    taxa_conversao: number;
    motivos_perda: Record<string, number>;
}

interface StorePerformance {
    store_id: string;
    store_name: string;
    total_vendas: number;
    total_valor: number;
    total_pecas: number;
    ticket_medio: number;
    pa: number;
    vendas_perdidas: number;
    taxa_conversao: number;
    colaboradoras: CollaboratorPerformance[];
}

interface LossReasonStats {
    motivo: string;
    quantidade: number;
    percentual: number;
}

const MOTIVOS_PERDA_LABELS: Record<string, string> = {
    'PRECO_ALTO': 'Preço alto',
    'NAO_GOSTOU_PRODUTO': 'Não gostou do produto',
    'SEM_ESTOQUE': 'Sem estoque/tamanho',
    'PENSAR_MELHOR': 'Vai pensar melhor',
    'COMPRAR_OUTRO_DIA': 'Vai comprar outro dia',
    'ATENDIMENTO': 'Problema no atendimento',
    'OUTRO': 'Outro motivo',
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const SalesPerformanceAnalytics = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [period, setPeriod] = useState<'month' | 'last3months' | 'custom'>('month');
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(endOfDay(new Date()), 'yyyy-MM-dd'));
    const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
    const [collaboratorPerformance, setCollaboratorPerformance] = useState<CollaboratorPerformance[]>([]);
    const [lossReasons, setLossReasons] = useState<LossReasonStats[]>([]);

    useEffect(() => {
        fetchStores();
    }, [profile]);

    useEffect(() => {
        if (stores.length > 0) {
            fetchPerformance();
        }
    }, [selectedStoreId, period, startDate, endDate, stores]);

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
            console.error('[SalesPerformanceAnalytics] Erro ao buscar lojas:', error);
        }
    };

    const getDateRange = () => {
        const today = new Date();
        let start: Date;
        let end: Date = endOfDay(today);

        switch (period) {
            case 'month':
                start = startOfMonth(today);
                end = endOfDay(today);
                break;
            case 'last3months':
                start = startOfMonth(subMonths(today, 2));
                end = endOfDay(today);
                break;
            case 'custom':
                start = startOfDay(new Date(startDate));
                end = endOfDay(new Date(endDate));
                break;
            default:
                start = startOfMonth(today);
                end = endOfDay(today);
        }

        return {
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd'),
        };
    };

    const fetchPerformance = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();
            const storeIds = selectedStoreId === 'all' 
                ? stores.map(s => s.id) 
                : [selectedStoreId];

            const storePerfs: StorePerformance[] = [];
            const collaboratorPerfs: CollaboratorPerformance[] = [];
            const lossReasonsMap: Record<string, number> = {};

            for (const storeId of storeIds) {
                // Buscar vendas do período
                const { data: sales, error: salesError } = await supabase
                    .schema('sistemaretiradas')
                    .from('sales')
                    .select(`
                        id,
                        colaboradora_id,
                        valor,
                        qtd_pecas,
                        venda_perdida,
                        motivo_perda_venda,
                        data_venda,
                        profiles!sales_colaboradora_id_fkey(name),
                        stores!sales_store_id_fkey(name)
                    `)
                    .eq('store_id', storeId)
                    .gte('data_venda', `${start}T00:00:00`)
                    .lte('data_venda', `${end}T23:59:59`);

                if (salesError) throw salesError;

                const storeName = sales?.[0]?.stores?.name || stores.find(s => s.id === storeId)?.name || 'Loja';

                // Agregar por colaboradora
                const colabMap = new Map<string, CollaboratorPerformance>();

                sales?.forEach((sale: any) => {
                    const colabId = sale.colaboradora_id;
                    const colabName = sale.profiles?.name || 'Sem nome';

                    if (!colabMap.has(colabId)) {
                        colabMap.set(colabId, {
                            colaboradora_id: colabId,
                            colaboradora_nome: colabName,
                            total_vendas: 0,
                            total_valor: 0,
                            total_pecas: 0,
                            ticket_medio: 0,
                            pa: 0,
                            vendas_perdidas: 0,
                            taxa_conversao: 0,
                            motivos_perda: {},
                        });
                    }

                    const perf = colabMap.get(colabId)!;
                    perf.total_vendas += 1;
                    perf.total_valor += Number(sale.valor || 0);
                    perf.total_pecas += Number(sale.qtd_pecas || 0);

                    if (sale.venda_perdida) {
                        perf.vendas_perdidas += 1;
                        const motivo = sale.motivo_perda_venda || 'OUTRO';
                        const motivoKey = motivo.startsWith('OUTRO:') ? 'OUTRO' : motivo;
                        perf.motivos_perda[motivoKey] = (perf.motivos_perda[motivoKey] || 0) + 1;
                        lossReasonsMap[motivoKey] = (lossReasonsMap[motivoKey] || 0) + 1;
                    }
                });

                // Calcular métricas finais
                colabMap.forEach((perf) => {
                    perf.ticket_medio = perf.total_vendas > 0 ? perf.total_valor / perf.total_vendas : 0;
                    perf.pa = perf.total_vendas > 0 ? perf.total_pecas / perf.total_vendas : 0;
                    perf.taxa_conversao = perf.total_vendas > 0 
                        ? ((perf.total_vendas - perf.vendas_perdidas) / perf.total_vendas) * 100 
                        : 0;
                });

                const colabArray = Array.from(colabMap.values());
                collaboratorPerfs.push(...colabArray);

                // Agregar dados da loja
                const storeTotalVendas = sales?.length || 0;
                const storeTotalValor = sales?.reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0) || 0;
                const storeTotalPecas = sales?.reduce((sum: number, s: any) => sum + Number(s.qtd_pecas || 0), 0) || 0;
                const storeVendasPerdidas = sales?.filter((s: any) => s.venda_perdida).length || 0;

                storePerfs.push({
                    store_id: storeId,
                    store_name: storeName,
                    total_vendas: storeTotalVendas,
                    total_valor: storeTotalValor,
                    total_pecas: storeTotalPecas,
                    ticket_medio: storeTotalVendas > 0 ? storeTotalValor / storeTotalVendas : 0,
                    pa: storeTotalVendas > 0 ? storeTotalPecas / storeTotalVendas : 0,
                    vendas_perdidas: storeVendasPerdidas,
                    taxa_conversao: storeTotalVendas > 0 
                        ? ((storeTotalVendas - storeVendasPerdidas) / storeTotalVendas) * 100 
                        : 0,
                    colaboradoras: colabArray,
                });
            }

            setStorePerformance(storePerfs);
            setCollaboratorPerformance(collaboratorPerfs);

            // Processar motivos de perda
            const totalLosses = Object.values(lossReasonsMap).reduce((sum, val) => sum + val, 0);
            const lossReasonsArray: LossReasonStats[] = Object.entries(lossReasonsMap)
                .map(([motivo, quantidade]) => ({
                    motivo,
                    quantidade,
                    percentual: totalLosses > 0 ? (quantidade / totalLosses) * 100 : 0,
                }))
                .sort((a, b) => b.quantidade - a.quantidade);

            setLossReasons(lossReasonsArray);
        } catch (error: any) {
            console.error('[SalesPerformanceAnalytics] Erro ao buscar performance:', error);
        } finally {
            setLoading(false);
        }
    };

    const chartData = collaboratorPerformance.map(perf => ({
        name: perf.colaboradora_nome,
        vendas: perf.total_vendas - perf.vendas_perdidas,
        perdidas: perf.vendas_perdidas,
        valor: perf.total_valor,
    }));

    const pieData = lossReasons.map((lr, idx) => ({
        name: MOTIVOS_PERDA_LABELS[lr.motivo] || lr.motivo,
        value: lr.quantidade,
        color: COLORS[idx % COLORS.length],
    }));

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Analytics de Desempenho - Lista da Vez</CardTitle>
                    <CardDescription>
                        Análise detalhada de desempenho individual e da loja, incluindo motivos de perda de venda
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
                                    <SelectItem value="month">Este mês</SelectItem>
                                    <SelectItem value="last3months">Últimos 3 meses</SelectItem>
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
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="loja" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="loja">Desempenho da Loja</TabsTrigger>
                    <TabsTrigger value="individual">Desempenho Individual</TabsTrigger>
                    <TabsTrigger value="perdas">Análise de Perdas</TabsTrigger>
                </TabsList>

                <TabsContent value="loja" className="space-y-4">
                    {storePerformance.map(store => (
                        <Card key={store.store_id}>
                            <CardHeader>
                                <CardTitle>{store.store_name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total de Vendas</p>
                                        <p className="text-2xl font-bold">{store.total_vendas}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Faturamento</p>
                                        <p className="text-2xl font-bold">{formatCurrency(store.total_valor)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                                        <p className="text-2xl font-bold">{store.taxa_conversao.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ticket Médio</p>
                                        <p className="text-2xl font-bold">{formatCurrency(store.ticket_medio)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">PA (Peças/Venda)</p>
                                        <p className="text-xl font-semibold">{store.pa.toFixed(1)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vendas Perdidas</p>
                                        <p className="text-xl font-semibold text-destructive">{store.vendas_perdidas}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total de Peças</p>
                                        <p className="text-xl font-semibold">{store.total_pecas}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="individual" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Desempenho Individual por Colaboradora</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="vendas" fill="#0088FE" name="Vendas Concluídas" />
                                        <Bar dataKey="perdidas" fill="#FF8042" name="Vendas Perdidas" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colaboradora</TableHead>
                                        <TableHead>Vendas</TableHead>
                                        <TableHead>Faturamento</TableHead>
                                        <TableHead>Ticket Médio</TableHead>
                                        <TableHead>PA</TableHead>
                                        <TableHead>Taxa Conversão</TableHead>
                                        <TableHead>Perdidas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {collaboratorPerformance
                                        .sort((a, b) => b.total_valor - a.total_valor)
                                        .map(perf => (
                                            <TableRow key={perf.colaboradora_id}>
                                                <TableCell className="font-medium">{perf.colaboradora_nome}</TableCell>
                                                <TableCell>{perf.total_vendas}</TableCell>
                                                <TableCell>{formatCurrency(perf.total_valor)}</TableCell>
                                                <TableCell>{formatCurrency(perf.ticket_medio)}</TableCell>
                                                <TableCell>{perf.pa.toFixed(1)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={perf.taxa_conversao} className="w-20" />
                                                        <span className="text-sm">{perf.taxa_conversao.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={perf.vendas_perdidas > 0 ? "destructive" : "secondary"}>
                                                        {perf.vendas_perdidas}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="perdas" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Análise de Motivos de Perda de Venda</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {lossReasons.length > 0 ? (
                                <>
                                    <div className="mb-6">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
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
                                                <TableRow key={lr.motivo}>
                                                    <TableCell className="font-medium">
                                                        {MOTIVOS_PERDA_LABELS[lr.motivo] || lr.motivo}
                                                    </TableCell>
                                                    <TableCell>{lr.quantidade}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={lr.percentual} className="w-32" />
                                                            <span className="text-sm">{lr.percentual.toFixed(1)}%</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    Nenhuma venda perdida registrada no período selecionado
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

