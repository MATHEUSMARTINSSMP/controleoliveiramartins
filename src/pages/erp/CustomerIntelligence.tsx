/**
 * Dashboard de Inteligência de Clientes
 * Análises avançadas de comportamento e padrões de compra
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, ShoppingBag, Award, Clock, Calendar, Package, ArrowLeft, Users, DollarSign, Heart, MapPin, Mail, Phone, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface CustomerRanking {
    cliente_id: string;
    cliente_nome: string;
    cliente_cpf_cnpj: string | null;
    total_compras: number;
    quantidade_pedidos: number;
    ticket_medio: number;
    ultima_compra: string;
    primeira_compra: string;
    frequencia_dias: number;
    loja_favorita?: string;
    categoria_favorita?: string;
}

interface PurchasePattern {
    item: string;
    quantidade: number;
    valor_total: number;
    percentual: number;
}

interface CustomerSegment {
    segmento: string;
    quantidade: number;
    valor_total: number;
    ticket_medio: number;
}

export default function CustomerIntelligence() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [topLimit, setTopLimit] = useState<number>(10);
    const [storeId, setStoreId] = useState<string | undefined>();
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // Rankings
    const [topBuyers, setTopBuyers] = useState<CustomerRanking[]>([]);
    const [topTicket, setTopTicket] = useState<CustomerRanking[]>([]);
    const [topFrequency, setTopFrequency] = useState<CustomerRanking[]>([]);
    const [topGrowth, setTopGrowth] = useState<CustomerRanking[]>([]);
    
    // Segmentação
    const [segments, setSegments] = useState<CustomerSegment[]>([]);
    
    // Padrões de compra
    const [topBrands, setTopBrands] = useState<PurchasePattern[]>([]);
    const [topSizes, setTopSizes] = useState<PurchasePattern[]>([]);
    const [topColors, setTopColors] = useState<PurchasePattern[]>([]);
    const [hourlyPattern, setHourlyPattern] = useState<any[]>([]);
    const [weekdayPattern, setWeekdayPattern] = useState<any[]>([]);
    const [monthlyPattern, setMonthlyPattern] = useState<any[]>([]);

    // Estatísticas gerais
    const [stats, setStats] = useState<{
        total_clientes: number;
        total_vendas: number;
        ticket_medio_geral: number;
        crescimento_mes: number;
        clientes_ativos: number;
        clientes_inativos: number;
    } | null>(null);

    useEffect(() => {
        fetchCustomerIntelligence();
    }, [topLimit, storeId, dateFrom, dateTo]);

    const fetchCustomerIntelligence = async () => {
        try {
            setLoading(true);

            // Construir query base
            let query = supabase
                .schema('sistemaretiradas')
                .from('tiny_orders')
                .select('*');

            if (storeId) {
                query = query.eq('store_id', storeId);
            }

            if (dateFrom) {
                query = query.gte('data_pedido', dateFrom);
            }

            if (dateTo) {
                query = query.lte('data_pedido', dateTo);
            }

            const { data: orders, error } = await query;

            if (error) {
                console.error('Erro ao buscar pedidos:', error);
                return;
            }

            if (!orders || orders.length === 0) {
                setLoading(false);
                return;
            }

            // Agrupar por cliente
            const clientMap = new Map<string, any>();
            let totalVendas = 0;
            let totalValor = 0;

            orders.forEach((order: any) => {
                if (!order.cliente_id) return;

                totalVendas++;
                totalValor += parseFloat(order.valor_total || 0);

                const clienteId = order.cliente_id;
                
                if (!clientMap.has(clienteId)) {
                    clientMap.set(clienteId, {
                        cliente_id: clienteId,
                        cliente_nome: order.cliente_nome || 'Cliente sem nome',
                        cliente_cpf_cnpj: order.cliente_cpf_cnpj || null,
                        pedidos: [],
                        valores: [],
                        datas: [],
                        primeira_compra: order.data_pedido,
                        ultima_compra: order.data_pedido,
                    });
                }

                const cliente = clientMap.get(clienteId);
                cliente.pedidos.push(order);
                cliente.valores.push(parseFloat(order.valor_total || 0));
                cliente.datas.push(new Date(order.data_pedido).getTime());

                if (new Date(order.data_pedido) > new Date(cliente.ultima_compra)) {
                    cliente.ultima_compra = order.data_pedido;
                }

                if (new Date(order.data_pedido) < new Date(cliente.primeira_compra)) {
                    cliente.primeira_compra = order.data_pedido;
                }
            });

            // Processar dados dos clientes
            const clientesProcessados: CustomerRanking[] = Array.from(clientMap.values()).map((cliente: any) => {
                const quantidadePedidos = cliente.pedidos.length;
                const totalCompras = cliente.valores.reduce((sum: number, v: number) => sum + v, 0);
                const ticketMedio = totalCompras / quantidadePedidos;
                
                // Calcular frequência média (dias entre compras)
                let frequenciaDias = 0;
                if (cliente.datas.length > 1) {
                    cliente.datas.sort((a: number, b: number) => b - a);
                    const intervals: number[] = [];
                    for (let i = 0; i < cliente.datas.length - 1; i++) {
                        intervals.push((cliente.datas[i] - cliente.datas[i + 1]) / (1000 * 60 * 60 * 24));
                    }
                    frequenciaDias = Math.round(intervals.reduce((sum, i) => sum + i, 0) / intervals.length);
                }

                // Extrair categoria favorita dos itens
                const categoriaMap = new Map<string, number>();
                cliente.pedidos.forEach((pedido: any) => {
                    if (pedido.itens && Array.isArray(pedido.itens)) {
                        pedido.itens.forEach((item: any) => {
                            const categoria = item.categoria || item.categoria_produto || 'Sem categoria';
                            categoriaMap.set(categoria, (categoriaMap.get(categoria) || 0) + 1);
                        });
                    }
                });
                const categoriaFavorita = Array.from(categoriaMap.entries())
                    .sort((a, b) => b[1] - a[1])[0]?.[0];

                return {
                    cliente_id: cliente.cliente_id,
                    cliente_nome: cliente.cliente_nome,
                    cliente_cpf_cnpj: cliente.cliente_cpf_cnpj,
                    total_compras: totalCompras,
                    quantidade_pedidos: quantidadePedidos,
                    ticket_medio: ticketMedio,
                    ultima_compra: cliente.ultima_compra,
                    primeira_compra: cliente.primeira_compra,
                    frequencia_dias: frequenciaDias,
                    categoria_favorita: categoriaFavorita,
                };
            });

            // Top compradores
            const topBuyersSorted = [...clientesProcessados]
                .sort((a, b) => b.total_compras - a.total_compras)
                .slice(0, topLimit);
            setTopBuyers(topBuyersSorted);

            // Top ticket médio
            const topTicketSorted = [...clientesProcessados]
                .sort((a, b) => b.ticket_medio - a.ticket_medio)
                .slice(0, topLimit);
            setTopTicket(topTicketSorted);

            // Top frequência
            const topFrequencySorted = [...clientesProcessados]
                .sort((a, b) => b.quantidade_pedidos - a.quantidade_pedidos)
                .slice(0, topLimit);
            setTopFrequency(topFrequencySorted);

            // Top crescimento (clientes com mais compras recentes)
            const now = new Date().getTime();
            const topGrowthSorted = [...clientesProcessados]
                .map(c => ({
                    ...c,
                    dias_desde_ultima: Math.floor((now - new Date(c.ultima_compra).getTime()) / (1000 * 60 * 60 * 24)),
                }))
                .filter(c => c.dias_desde_ultima <= 90)
                .sort((a, b) => {
                    // Priorizar clientes com muitas compras recentes
                    const scoreA = a.quantidade_pedidos / (a.dias_desde_ultima || 1);
                    const scoreB = b.quantidade_pedidos / (b.dias_desde_ultima || 1);
                    return scoreB - scoreA;
                })
                .slice(0, topLimit);
            setTopGrowth(topGrowthSorted as CustomerRanking[]);

            // Segmentação de clientes (do maior para o menor)
            const segmentos: CustomerSegment[] = [
                {
                    segmento: 'BLACK (>R$ 10.000)',
                    quantidade: clientesProcessados.filter(c => c.total_compras > 10000).length,
                    valor_total: clientesProcessados.filter(c => c.total_compras > 10000).reduce((sum, c) => sum + c.total_compras, 0),
                    ticket_medio: 0,
                },
                {
                    segmento: 'PLATINUM (R$ 5.000 - R$ 10.000)',
                    quantidade: clientesProcessados.filter(c => c.total_compras >= 5000 && c.total_compras <= 10000).length,
                    valor_total: clientesProcessados.filter(c => c.total_compras >= 5000 && c.total_compras <= 10000).reduce((sum, c) => sum + c.total_compras, 0),
                    ticket_medio: 0,
                },
                {
                    segmento: 'VIP (R$ 1.000 - R$ 5.000)',
                    quantidade: clientesProcessados.filter(c => c.total_compras >= 1000 && c.total_compras < 5000).length,
                    valor_total: clientesProcessados.filter(c => c.total_compras >= 1000 && c.total_compras < 5000).reduce((sum, c) => sum + c.total_compras, 0),
                    ticket_medio: 0,
                },
                {
                    segmento: 'REGULAR (<R$ 1.000)',
                    quantidade: clientesProcessados.filter(c => c.total_compras < 1000).length,
                    valor_total: clientesProcessados.filter(c => c.total_compras < 1000).reduce((sum, c) => sum + c.total_compras, 0),
                    ticket_medio: 0,
                },
            ].map(seg => ({
                ...seg,
                ticket_medio: seg.quantidade > 0 ? seg.valor_total / seg.quantidade : 0,
            }));
            setSegments(segmentos);

            // Estatísticas gerais
            const ticketMedioGeral = totalVendas > 0 ? totalValor / totalVendas : 0;
            const clientesAtivos = clientesProcessados.filter(c => {
                const diasDesdeUltima = Math.floor((now - new Date(c.ultima_compra).getTime()) / (1000 * 60 * 60 * 24));
                return diasDesdeUltima <= 90;
            }).length;

            setStats({
                total_clientes: clientMap.size,
                total_vendas: totalVendas,
                ticket_medio_geral: ticketMedioGeral,
                crescimento_mes: 0, // TODO: calcular crescimento mês a mês
                clientes_ativos: clientesAtivos,
                clientes_inativos: clientMap.size - clientesAtivos,
            });

            // Padrões de compra - extrair de itens
            const brandMap = new Map<string, { quantidade: number; valor_total: number }>();
            const sizeMap = new Map<string, { quantidade: number; valor_total: number }>();
            const colorMap = new Map<string, { quantidade: number; valor_total: number }>();

            orders.forEach((order: any) => {
                if (order.itens && Array.isArray(order.itens)) {
                    order.itens.forEach((item: any) => {
                        // Marcas
                        const marca = item.marca || item.marca_produto;
                        if (marca) {
                            const existing = brandMap.get(marca) || { quantidade: 0, valor_total: 0 };
                            existing.quantidade += parseFloat(item.quantidade || 1);
                            existing.valor_total += parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 1);
                            brandMap.set(marca, existing);
                        }

                        // Tamanhos
                        const tamanho = item.tamanho;
                        if (tamanho) {
                            const existing = sizeMap.get(tamanho) || { quantidade: 0, valor_total: 0 };
                            existing.quantidade += parseFloat(item.quantidade || 1);
                            existing.valor_total += parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 1);
                            sizeMap.set(tamanho, existing);
                        }

                        // Cores
                        const cor = item.cor;
                        if (cor) {
                            const existing = colorMap.get(cor) || { quantidade: 0, valor_total: 0 };
                            existing.quantidade += parseFloat(item.quantidade || 1);
                            existing.valor_total += parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 1);
                            colorMap.set(cor, existing);
                        }
                    });
                }
            });

            const totalValorBrands = Array.from(brandMap.values()).reduce((sum, b) => sum + b.valor_total, 0);
            const topBrandsData = Array.from(brandMap.entries())
                .map(([item, data]) => ({
                    item,
                    quantidade: data.quantidade,
                    valor_total: data.valor_total,
                    percentual: (data.valor_total / totalValorBrands) * 100,
                }))
                .sort((a, b) => b.valor_total - a.valor_total)
                .slice(0, 10);
            setTopBrands(topBrandsData);

            const totalValorSizes = Array.from(sizeMap.values()).reduce((sum, s) => sum + s.valor_total, 0);
            const topSizesData = Array.from(sizeMap.entries())
                .map(([item, data]) => ({
                    item,
                    quantidade: data.quantidade,
                    valor_total: data.valor_total,
                    percentual: (data.valor_total / totalValorSizes) * 100,
                }))
                .sort((a, b) => b.valor_total - a.valor_total)
                .slice(0, 10);
            setTopSizes(topSizesData);

            const totalValorColors = Array.from(colorMap.values()).reduce((sum, c) => sum + c.valor_total, 0);
            const topColorsData = Array.from(colorMap.entries())
                .map(([item, data]) => ({
                    item,
                    quantidade: data.quantidade,
                    valor_total: data.valor_total,
                    percentual: (data.valor_total / totalValorColors) * 100,
                }))
                .sort((a, b) => b.valor_total - a.valor_total)
                .slice(0, 10);
            setTopColors(topColorsData);

            // Padrão por horário
            const hourMap: any = {};
            orders.forEach((order: any) => {
                if (order.data_pedido) {
                    const hour = new Date(order.data_pedido).getHours();
                    if (!hourMap[hour]) {
                        hourMap[hour] = { vendas: 0, valor: 0 };
                    }
                    hourMap[hour].vendas += 1;
                    hourMap[hour].valor += parseFloat(order.valor_total || 0);
                }
            });

            const hourlyData = Object.entries(hourMap)
                .map(([hour, data]: [string, any]) => ({
                    hora: `${hour}:00`,
                    vendas: data.vendas,
                    valor: data.valor,
                }))
                .sort((a, b) => parseInt(a.hora) - parseInt(b.hora));
            setHourlyPattern(hourlyData);

            // Padrão por dia da semana
            const weekMap: any = {};
            const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

            orders.forEach((order: any) => {
                if (order.data_pedido) {
                    const day = new Date(order.data_pedido).getDay();
                    const dayName = dias[day];
                    if (!weekMap[dayName]) {
                        weekMap[dayName] = { vendas: 0, valor: 0 };
                    }
                    weekMap[dayName].vendas += 1;
                    weekMap[dayName].valor += parseFloat(order.valor_total || 0);
                }
            });

            const weeklyData = dias.map(dia => ({
                dia,
                vendas: weekMap[dia]?.vendas || 0,
                valor: weekMap[dia]?.valor || 0,
            }));
            setWeekdayPattern(weeklyData);

            // Padrão mensal
            const monthMap: any = {};
            orders.forEach((order: any) => {
                if (order.data_pedido) {
                    const monthKey = format(new Date(order.data_pedido), 'MMM/yyyy', { locale: ptBR });
                    if (!monthMap[monthKey]) {
                        monthMap[monthKey] = { vendas: 0, valor: 0 };
                    }
                    monthMap[monthKey].vendas += 1;
                    monthMap[monthKey].valor += parseFloat(order.valor_total || 0);
                }
            });

            const monthlyData = Object.entries(monthMap)
                .map(([mes, data]: [string, any]) => ({
                    mes,
                    vendas: data.vendas,
                    valor: data.valor,
                }))
                .sort((a, b) => {
                    const dateA = new Date(a.mes.split('/').reverse().join('-'));
                    const dateB = new Date(b.mes.split('/').reverse().join('-'));
                    return dateA.getTime() - dateB.getTime();
                });
            setMonthlyPattern(monthlyData);

        } catch (error) {
            console.error('Erro ao buscar inteligência de clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Buscar lojas para filtro
    useEffect(() => {
        const fetchStores = async () => {
            if (profile?.role === 'ADMIN') {
                const { data } = await supabase
                    .schema('sistemaretiradas')
                    .from('stores')
                    .select('id, name')
                    .eq('active', true);
                // TODO: adicionar seletor de loja no filtro
            }
        };
        fetchStores();
    }, [profile]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header com botão voltar */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/erp/dashboard')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao Dashboard
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Inteligência de Clientes</h1>
                    <p className="text-muted-foreground">Análises avançadas de comportamento e padrões de compra</p>
                </div>
                <Select value={topLimit.toString()} onValueChange={(v) => setTopLimit(Number(v))}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">Top 10</SelectItem>
                        <SelectItem value="20">Top 20</SelectItem>
                        <SelectItem value="50">Top 50</SelectItem>
                        <SelectItem value="100">Top 100</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Data Inicial</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Data Final</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Limpar Filtros</Label>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                    setStoreId(undefined);
                                }}
                            >
                                Limpar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Estatísticas Gerais */}
            {stats && (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_clientes}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_vendas}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.ticket_medio_geral)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.clientes_ativos}</div>
                            <p className="text-xs text-muted-foreground">Últimos 90 dias</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Inativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.clientes_inativos}</div>
                            <p className="text-xs text-muted-foreground">Mais de 90 dias</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs defaultValue="rankings" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="rankings">Rankings de Clientes</TabsTrigger>
                    <TabsTrigger value="segments">Segmentação</TabsTrigger>
                    <TabsTrigger value="patterns">Padrões de Compra</TabsTrigger>
                </TabsList>

                <TabsContent value="rankings" className="space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Top Compradores */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-5 w-5" />
                                    Maiores Compradores
                                </CardTitle>
                                <CardDescription>Por valor total</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topBuyers.map((customer, idx) => (
                                            <TableRow key={customer.cliente_id}>
                                                <TableCell>
                                                    <Badge variant={idx < 3 ? 'default' : 'secondary'}>{idx + 1}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">{customer.cliente_nome}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {formatCurrency(customer.total_compras)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Top Ticket Médio */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Award className="h-5 w-5" />
                                    Maior Ticket Médio
                                </CardTitle>
                                <CardDescription>Valor médio por pedido</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Ticket</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topTicket.map((customer, idx) => (
                                            <TableRow key={customer.cliente_id}>
                                                <TableCell>
                                                    <Badge variant={idx < 3 ? 'default' : 'secondary'}>{idx + 1}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">{customer.cliente_nome}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {formatCurrency(customer.ticket_medio)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Top Frequência */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ShoppingBag className="h-5 w-5" />
                                    Maior Frequência
                                </CardTitle>
                                <CardDescription>Quantidade de pedidos</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Pedidos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topFrequency.map((customer, idx) => (
                                            <TableRow key={customer.cliente_id}>
                                                <TableCell>
                                                    <Badge variant={idx < 3 ? 'default' : 'secondary'}>{idx + 1}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">{customer.cliente_nome}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {customer.quantidade_pedidos}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Top Crescimento */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-5 w-5" />
                                    Maior Crescimento
                                </CardTitle>
                                <CardDescription>Clientes ativos recentes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Pedidos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topGrowth.map((customer, idx) => (
                                            <TableRow key={customer.cliente_id}>
                                                <TableCell>
                                                    <Badge variant={idx < 3 ? 'default' : 'secondary'}>{idx + 1}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-xs">{customer.cliente_nome}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {customer.quantidade_pedidos}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="segments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Segmentação de Clientes</CardTitle>
                            <CardDescription>Agrupamento por valor total de compras</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Segmento</TableHead>
                                        <TableHead className="text-right">Quantidade</TableHead>
                                        <TableHead className="text-right">Valor Total</TableHead>
                                        <TableHead className="text-right">Ticket Médio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {segments.map((segment) => (
                                        <TableRow key={segment.segmento}>
                                            <TableCell className="font-medium">{segment.segmento}</TableCell>
                                            <TableCell className="text-right">{segment.quantidade}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(segment.valor_total)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(segment.ticket_medio)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="patterns" className="space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                        {/* Marcas Favoritas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Marcas Mais Vendidas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Marca</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="text-right">%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topBrands.map((brand) => (
                                            <TableRow key={brand.item}>
                                                <TableCell className="font-medium">{brand.item}</TableCell>
                                                <TableCell className="text-right">{brand.quantidade}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(brand.valor_total)}</TableCell>
                                                <TableCell className="text-right">{brand.percentual.toFixed(1)}%</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Tamanhos Preferidos */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Tamanhos Mais Vendidos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tamanho</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="text-right">%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topSizes.map((size) => (
                                            <TableRow key={size.item}>
                                                <TableCell className="font-medium">{size.item}</TableCell>
                                                <TableCell className="text-right">{size.quantidade}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(size.valor_total)}</TableCell>
                                                <TableCell className="text-right">{size.percentual.toFixed(1)}%</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Cores Preferidas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Cores Mais Vendidas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cor</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="text-right">%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topColors.map((color) => (
                                            <TableRow key={color.item}>
                                                <TableCell className="font-medium">{color.item}</TableCell>
                                                <TableCell className="text-right">{color.quantidade}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(color.valor_total)}</TableCell>
                                                <TableCell className="text-right">{color.percentual.toFixed(1)}%</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Padrão por Horário */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Vendas por Horário
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hora</TableHead>
                                            <TableHead className="text-right">Vendas</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {hourlyPattern.map((hour) => (
                                            <TableRow key={hour.hora}>
                                                <TableCell className="font-medium">{hour.hora}</TableCell>
                                                <TableCell className="text-right">{hour.vendas}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(hour.valor)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Padrão por Dia da Semana */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Vendas por Dia da Semana
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Dia</TableHead>
                                            <TableHead className="text-right">Vendas</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {weekdayPattern.map((day) => (
                                            <TableRow key={day.dia}>
                                                <TableCell className="font-medium">{day.dia}</TableCell>
                                                <TableCell className="text-right">{day.vendas}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(day.valor)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Padrão Mensal */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Vendas por Mês
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mês</TableHead>
                                            <TableHead className="text-right">Vendas</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyPattern.map((month) => (
                                            <TableRow key={month.mes}>
                                                <TableCell className="font-medium">{month.mes}</TableCell>
                                                <TableCell className="text-right">{month.vendas}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(month.valor)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
