import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface MonthlyData {
    metaMensal: number;
    vendidoMes: number;
    progress: number;
    diasRestantes: number;
    mediaDiariaNecessaria: number;
    top3: {
        id: string;
        name: string;
        vendido: number;
    }[];
}

export function MonthlyOverview() {
    const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMonthlyData();
        const interval = setInterval(fetchMonthlyData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchMonthlyData = async () => {
        try {
            const hoje = new Date();
            const mesAtual = format(hoje, "yyyyMM");
            const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
            const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
            const diasRestantes = daysInMonth - hoje.getDate() + 1;

            console.log("[MonthlyOverview] Buscando metas mensais INDIVIDUAIS para mês:", mesAtual);

            // Buscar todas as metas mensais INDIVIDUAIS (por colaboradora) - usar schema como no dashboard da loja
            const { data: metasData, error: metaError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, colaboradora_id")
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .not("colaboradora_id", "is", null);

            if (metaError) {
                console.error("[MonthlyOverview] Erro ao buscar metas:", metaError);
                throw metaError;
            }

            if (!metasData || metasData.length === 0) {
                console.warn("[MonthlyOverview] Nenhuma meta mensal individual encontrada para mês:", mesAtual);
                setMonthlyData(null);
                setLoading(false);
                return;
            }

            console.log("[MonthlyOverview] Metas individuais encontradas:", metasData.length, metasData);

            // Agregar todas as metas mensais individuais (soma de todas as colaboradoras)
            const metaMensalTotal = metasData.reduce((sum, meta) => sum + Number(meta.meta_valor || 0), 0);
            const colaboradoraIds = metasData.map(m => m.colaboradora_id).filter(Boolean) as string[];

            console.log("[MonthlyOverview] Meta mensal total agregada:", metaMensalTotal);
            console.log("[MonthlyOverview] Colaboradoras com meta:", colaboradoraIds.length);

            // Buscar vendas do mês de todas as colaboradoras - usar schema como no dashboard da loja
            let query = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id")
                .gte("data_venda", `${startOfMonth}T00:00:00`);

            if (colaboradoraIds.length > 0) {
                query = query.in("colaboradora_id", colaboradoraIds);
            }

            const { data: salesData, error: salesError } = await query;

            if (salesError) {
                console.error("[MonthlyOverview] Erro ao buscar vendas:", salesError);
                throw salesError;
            }

            console.log("[MonthlyOverview] Vendas encontradas:", salesData?.length || 0);

            const vendidoMes = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
            const metaMensal = metaMensalTotal;
            const progress = metaMensal > 0 ? (vendidoMes / metaMensal) * 100 : 0;

            console.log("[MonthlyOverview] Vendido no mês:", vendidoMes);
            console.log("[MonthlyOverview] Progresso:", progress.toFixed(2) + "%");

            // Calcular média diária necessária
            const faltaParaMeta = Math.max(0, metaMensal - vendidoMes);
            const mediaDiariaNecessaria = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;

            // Calcular Top 3 colaboradoras - buscar nomes das colaboradoras separadamente
            const salesByColab: Record<string, { id: string; vendido: number }> = {};
            salesData?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!salesByColab[colabId]) {
                    salesByColab[colabId] = { id: colabId, vendido: 0 };
                }
                salesByColab[colabId].vendido += Number(sale.valor || 0);
            });

            // Buscar nomes das colaboradoras do Top 3
            const top3Ids = Object.values(salesByColab)
                .sort((a, b) => b.vendido - a.vendido)
                .slice(0, 3)
                .map(c => c.id);

            let top3: { id: string; name: string; vendido: number }[] = [];
            if (top3Ids.length > 0) {
                const { data: profilesData } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name")
                    .in("id", top3Ids);

                const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p.name]));
                top3 = top3Ids.map(id => ({
                    id,
                    name: profilesMap.get(id) || "Desconhecida",
                    vendido: salesByColab[id].vendido
                }));
            }

            setMonthlyData({
                metaMensal,
                vendidoMes,
                progress: Math.min(progress, 100),
                diasRestantes,
                mediaDiariaNecessaria,
                top3: top3 as any[],
            });
        } catch (error) {
            console.error("Error fetching monthly data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Visão Mensal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!monthlyData) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Visão Mensal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma meta mensal configurada
                    </p>
                </CardContent>
            </Card>
        );
    }

    const getProgressColor = () => {
        if (monthlyData.progress >= 100) return "bg-green-500";
        if (monthlyData.progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Visão Mensal
                    <Badge
                        variant={monthlyData.progress >= 100 ? "default" : "secondary"}
                        className="ml-auto"
                    >
                        {monthlyData.progress.toFixed(0)}%
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vendido</span>
                        <span className="font-semibold">
                            R$ {monthlyData.vendidoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meta</span>
                        <span className="font-semibold">
                            R$ {monthlyData.metaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <Progress value={monthlyData.progress} className={`h-3 ${getProgressColor()}`} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Dias restantes</p>
                        <p className="text-lg font-bold">{monthlyData.diasRestantes}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Faltam</p>
                        <p className="text-lg font-bold">
                            R$ {Math.max(0, monthlyData.metaMensal - monthlyData.vendidoMes).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>

                {monthlyData.diasRestantes > 0 && monthlyData.progress < 100 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Média diária necessária</p>
                        <p className="text-lg font-bold text-primary">
                            R$ {monthlyData.mediaDiariaNecessaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                )}

                {monthlyData.top3.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Trophy className="h-4 w-4" />
                            <span>Top 3 do Mês</span>
                        </div>
                        <div className="space-y-1.5">
                            {monthlyData.top3.map((colab, index) => (
                                <div
                                    key={colab.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant={index === 0 ? "default" : "outline"} className="w-6 h-6 flex items-center justify-center p-0">
                                            {index + 1}
                                        </Badge>
                                        <span className="text-sm font-medium truncate">{colab.name}</span>
                                    </div>
                                    <span className="text-sm font-semibold">
                                        R$ {colab.vendido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {monthlyData.progress >= 100 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
                        <Trophy className="h-4 w-4" />
                        <span className="text-sm font-semibold">Meta mensal batida! 🎉</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
