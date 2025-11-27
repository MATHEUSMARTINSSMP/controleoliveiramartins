/**
 * Dashboard de Inteligência de Clientes
 * Análises avançadas de comportamento e padrões de compra
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, ShoppingBag, Award, Clock, Calendar, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CustomerRanking {
    cliente_id: string;
    cliente_nome: string;
    cliente_cpf_cnpj: string | null;
    total_compras: number;
    quantidade_pedidos: number;
    ticket_medio: number;
    ultima_compra: string;
}

interface PurchasePattern {
    item: string;
    quantidade: number;
    valor_total: number;
    percentual: number;
}

export default function CustomerIntelligence() {
    const [loading, setLoading] = useState(true);
    const [topLimit, setTopLimit] = useState<number>(10);

    // Rankings
    const [topBuyers, setTopBuyers] = useState<CustomerRanking[]>([]);
    const [topTicket, setTopTicket] = useState<CustomerRanking[]>([]);
    const [topFrequency, setTopFrequency] = useState<CustomerRanking[]>([]);

    // Padrões de compra
    const [topBrands, setTopBrands] = useState<PurchasePattern[]>([]);
    const [topSizes, setTopSizes] = useState<PurchasePattern[]>([]);
    const [hourlyPattern, setHourlyPattern] = useState<any[]>([]);
    const [weekdayPattern, setWeekdayPattern] = useState<any[]>([]);

    useEffect(() => {
        fetchCustomerIntelligence();
    }, [topLimit]);

    const fetchCustomerIntelligence = async () => {
        try {
            setLoading(true);

            // Top compradores (maior valor total)
            const { data: buyers } = await supabase
                .schema('sistemaretiradas')
                .from('vendas')
                .select('cliente_id, cliente_nome, cliente_cpf_cnpj, valor_total, data_pedido')
                .not('cliente_id', 'is', null)
                .order('valor_total', { ascending: false });

            if (buyers) {
                const grouped = buyers.reduce((acc: any, venda: any) => {
                    const key = venda.cliente_id;
                    if (!acc[key]) {
                        acc[key] = {
                            cliente_id: venda.cliente_id,
                            cliente_nome: venda.cliente_nome,
                            cliente_cpf_cnpj: venda.cliente_cpf_cnpj,
                            total_compras: 0,
                            quantidade_pedidos: 0,
                            ultima_compra: venda.data_pedido,
                        };
                    }
                    acc[key].total_compras += Number(venda.valor_total) || 0;
                    acc[key].quantidade_pedidos += 1;
                    if (venda.data_pedido > acc[key].ultima_compra) {
                        acc[key].ultima_compra = venda.data_pedido;
                    }
                    return acc;
                }, {});

                const ranked = Object.values(grouped)
                    .map((c: any) => ({
                        ...c,
                        ticket_medio: c.total_compras / c.quantidade_pedidos,
                    }))
                    .sort((a: any, b: any) => b.total_compras - a.total_compras)
                    .slice(0, topLimit);

                setTopBuyers(ranked as CustomerRanking[]);

                // Top ticket médio
                const byTicket = [...ranked].sort((a: any, b: any) => b.ticket_medio - a.ticket_medio);
                setTopTicket(byTicket as CustomerRanking[]);

                // Top frequência
                const byFrequency = [...ranked].sort((a: any, b: any) => b.quantidade_pedidos - a.quantidade_pedidos);
                setTopFrequency(byFrequency as CustomerRanking[]);
            }

            // Padrões de compra - Marcas
            const { data: brands } = await supabase
                .schema('sistemaretiradas')
                .from('vendas')
                .select('marca, quantidade, valor_total')
                .not('marca', 'is', null);

            if (brands) {
                const brandMap = brands.reduce((acc: any, v: any) => {
                    if (!acc[v.marca]) {
                        acc[v.marca] = { quantidade: 0, valor_total: 0 };
                    }
                    acc[v.marca].quantidade += Number(v.quantidade) || 0;
                    acc[v.marca].valor_total += Number(v.valor_total) || 0;
                    return acc;
                }, {});

                const totalValor = Object.values(brandMap).reduce((sum: number, b: any) => sum + b.valor_total, 0);
                const brandPatterns = Object.entries(brandMap)
                    .map(([item, data]: [string, any]) => ({
                        item,
                        quantidade: data.quantidade,
                        valor_total: data.valor_total,
                        percentual: (data.valor_total / totalValor) * 100,
                    }))
                    .sort((a, b) => b.valor_total - a.valor_total)
                    .slice(0, 10);

                setTopBrands(brandPatterns);
            }

            // Padrões de compra - Tamanhos
            const { data: sizes } = await supabase
                .schema('sistemaretiradas')
                .from('vendas')
                .select('tamanho, quantidade, valor_total')
                .not('tamanho', 'is', null);

            if (sizes) {
                const sizeMap = sizes.reduce((acc: any, v: any) => {
                    if (!acc[v.tamanho]) {
                        acc[v.tamanho] = { quantidade: 0, valor_total: 0 };
                    }
                    acc[v.tamanho].quantidade += v.quantidade || 0;
                    acc[v.tamanho].valor_total += v.valor_total || 0;
                    return acc;
                }, {});

                const totalValor = Object.values(sizeMap).reduce((sum: number, s: any) => sum + s.valor_total, 0);
                const sizePatterns = Object.entries(sizeMap)
                    .map(([item, data]: [string, any]) => ({
                        item,
                        quantidade: data.quantidade,
                        valor_total: data.valor_total,
                        percentual: (data.valor_total / totalValor) * 100,
                    }))
                    .sort((a, b) => b.valor_total - a.valor_total)
                    .slice(0, 10);

                setTopSizes(sizePatterns);
            }

            // Padrão por horário
            const { data: hourly } = await supabase
                .schema('sistemaretiradas')
                .from('vendas')
                .select('data_pedido, valor_total');

            if (hourly) {
                const hourMap: any = {};
                hourly.forEach((v: any) => {
                    if (v.data_pedido) {
                        const hour = new Date(v.data_pedido).getHours();
                        if (!hourMap[hour]) {
                            hourMap[hour] = { vendas: 0, valor: 0 };
                        }
                        hourMap[hour].vendas += 1;
                        hourMap[hour].valor += v.valor_total || 0;
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
            }

            // Padrão por dia da semana
            const { data: weekly } = await supabase
                .schema('sistemaretiradas')
                .from('vendas')
                .select('data_pedido, valor_total');

            if (weekly) {
                const weekMap: any = {};
                const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

                weekly.forEach((v: any) => {
                    if (v.data_pedido) {
                        const day = new Date(v.data_pedido).getDay();
                        const dayName = dias[day];
                        if (!weekMap[dayName]) {
                            weekMap[dayName] = { vendas: 0, valor: 0 };
                        }
                        weekMap[dayName].vendas += 1;
                        weekMap[dayName].valor += v.valor_total || 0;
                    }
                });

                const weeklyData = dias.map(dia => ({
                    dia,
                    vendas: weekMap[dia]?.vendas || 0,
                    valor: weekMap[dia]?.valor || 0,
                }));

                setWeekdayPattern(weeklyData);
            }

        } catch (error) {
            console.error('Erro ao buscar inteligência de clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
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

            <Tabs defaultValue="rankings" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="rankings">Rankings de Clientes</TabsTrigger>
                    <TabsTrigger value="patterns">Padrões de Compra</TabsTrigger>
                </TabsList>

                <TabsContent value="rankings" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Top Compradores */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    Maiores Compradores
                                </CardTitle>
                                <CardDescription>Por valor total de compras</CardDescription>
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
                                                <TableCell className="font-medium">{customer.cliente_nome}</TableCell>
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
                                <CardTitle className="flex items-center gap-2">
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
                                                <TableCell className="font-medium">{customer.cliente_nome}</TableCell>
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
                                <CardTitle className="flex items-center gap-2">
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
                                                <TableCell className="font-medium">{customer.cliente_nome}</TableCell>
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

                <TabsContent value="patterns" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
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
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
