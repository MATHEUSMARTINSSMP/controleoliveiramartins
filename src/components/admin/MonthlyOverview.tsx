import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface ColaboradoraMeta {
    id: string;
    name: string;
    metaMensal: number;
    vendidoMes: number;
    progress: number;
}

interface MonthlyData {
    colaboradoras: ColaboradoraMeta[];
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

            const colaboradoraIds = metasData.map(m => m.colaboradora_id).filter(Boolean) as string[];

            console.log("[MonthlyOverview] Colaboradoras com meta:", colaboradoraIds.length);

            // Buscar nomes de todas as colaboradoras
            const { data: profilesData } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name")
                .in("id", colaboradoraIds);

            const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p.name]));

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

            // Agrupar vendas por colaboradora
            const salesByColab: Record<string, number> = {};
            salesData?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!salesByColab[colabId]) {
                    salesByColab[colabId] = 0;
                }
                salesByColab[colabId] += Number(sale.valor || 0);
            });

            // Criar lista de colaboradoras com suas metas e vendas
            const colaboradoras: ColaboradoraMeta[] = metasData.map((meta: any) => {
                const colabId = meta.colaboradora_id;
                const metaMensal = Number(meta.meta_valor || 0);
                const vendidoMes = salesByColab[colabId] || 0;
                const progress = metaMensal > 0 ? (vendidoMes / metaMensal) * 100 : 0;

                return {
                    id: colabId,
                    name: profilesMap.get(colabId) || "Desconhecida",
                    metaMensal,
                    vendidoMes,
                    progress: Math.min(progress, 100),
                };
            });

            // Ordenar por progresso (maior primeiro)
            colaboradoras.sort((a, b) => b.progress - a.progress);

            console.log("[MonthlyOverview] Colaboradoras processadas:", colaboradoras.length);

            setMonthlyData({
                colaboradoras,
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

    if (!monthlyData || monthlyData.colaboradoras.length === 0) {
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

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Visão Mensal
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {monthlyData.colaboradoras.map((colab) => (
                        <div
                            key={colab.id}
                            className="p-3 rounded-lg bg-muted/50 border border-border/50"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium truncate">{colab.name}</span>
                                <Badge
                                    variant={colab.progress >= 100 ? "default" : "secondary"}
                                    className="ml-2"
                                >
                                    {colab.progress.toFixed(0)}%
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Vendido: R$ {colab.vendidoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Progress value={colab.progress} className={`h-2 ${getProgressColor(colab.progress)}`} />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
