import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sun, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface DailyCollaborator {
    id: string;
    name: string;
    vendidoHoje: number;
    metaDiaria: number;
    progress: number;
    abaixoDaMeta: boolean;
}

export function DailyMetaTracker() {
    const [collaborators, setCollaborators] = useState<DailyCollaborator[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalVendido, setTotalVendido] = useState(0);
    const [totalMeta, setTotalMeta] = useState(0);

    useEffect(() => {
        fetchDailyProgress();
        const interval = setInterval(fetchDailyProgress, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchDailyProgress = async () => {
        try {
            const hoje = format(new Date(), "yyyy-MM-dd");

            // Buscar todas as colaboradoras ativas
            const { data: colabsData, error: colabsError } = await supabase
                .from("profiles")
                .select("id, name, store_id")
                .eq("role", "COLABORADORA")
                .eq("active", true);

            if (colabsError) throw colabsError;

            if (!colabsData || colabsData.length === 0) {
                setCollaborators([]);
                setLoading(false);
                return;
            }

            let totalVendidoHoje = 0;
            let totalMetaDiaria = 0;

            // Para cada colaboradora, buscar vendas do dia e meta diária
            const collaboratorsWithProgress = await Promise.all(
                colabsData.map(async (colab) => {
                    // Buscar vendas de hoje
                    const { data: salesData } = await supabase
                        .from("sales")
                        .select("valor")
                        .eq("colaboradora_id", colab.id)
                        .gte("data_venda", `${hoje}T00:00:00`)
                        .lte("data_venda", `${hoje}T23:59:59`);

                    const vendidoHoje = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;

                    // Buscar meta diária (calculada dinamicamente)
                    // Aqui vamos buscar a meta mensal e calcular a diária
                    const mesAtual = format(new Date(), "yyyyMM");
                    const { data: metaData } = await supabase
                        .from("goals")
                        .select("meta_valor, daily_weights")
                        .eq("colaboradora_id", colab.id)
                        .eq("mes_referencia", mesAtual)
                        .eq("tipo", "INDIVIDUAL")
                        .maybeSingle();

                    // Calcular meta diária (simplificado: meta mensal / dias do mês)
                    const daysInMonth = new Date(
                        parseInt(mesAtual.slice(0, 4)),
                        parseInt(mesAtual.slice(4, 6)),
                        0
                    ).getDate();

                    const metaDiaria = metaData?.meta_valor ? Number(metaData.meta_valor) / daysInMonth : 0;
                    const progress = metaDiaria > 0 ? (vendidoHoje / metaDiaria) * 100 : 0;

                    totalVendidoHoje += vendidoHoje;
                    totalMetaDiaria += metaDiaria;

                    return {
                        id: colab.id,
                        name: colab.name,
                        vendidoHoje,
                        metaDiaria,
                        progress: Math.min(progress, 100),
                        abaixoDaMeta: progress < 80,
                    };
                })
            );

            // Ordenar por progresso (maior primeiro)
            collaboratorsWithProgress.sort((a, b) => b.progress - a.progress);

            setCollaborators(collaboratorsWithProgress);
            setTotalVendido(totalVendidoHoje);
            setTotalMeta(totalMetaDiaria);
        } catch (error) {
            console.error("Error fetching daily progress:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-red-500";
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sun className="h-5 w-5" />
                        Meta Diária
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

    const progressGeral = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
    const abaixoDaMetaCount = collaborators.filter((c) => c.abaixoDaMeta).length;

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sun className="h-5 w-5 text-primary" />
                    Meta Diária
                    <Badge variant={progressGeral >= 100 ? "default" : "secondary"} className="ml-auto">
                        {progressGeral.toFixed(0)}%
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vendido hoje</span>
                        <span className="font-semibold">
                            R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meta do dia</span>
                        <span className="font-semibold">
                            R$ {totalMeta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <Progress value={progressGeral} className={`h-3 ${getProgressColor(progressGeral)}`} />
                </div>

                {abaixoDaMetaCount > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">{abaixoDaMetaCount} abaixo de 80%</span>
                    </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {collaborators.map((colab, index) => (
                        <div
                            key={colab.id}
                            className={`p-2.5 rounded-lg border space-y-1.5 ${index < 3 ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border/50"
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {index < 3 && <TrendingUp className="h-3.5 w-3.5 text-primary" />}
                                    <span className="text-sm font-medium truncate">{colab.name}</span>
                                </div>
                                <span className="text-xs font-semibold">{colab.progress.toFixed(0)}%</span>
                            </div>
                            <Progress value={colab.progress} className={`h-1.5 ${getProgressColor(colab.progress)}`} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>R$ {colab.vendidoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                                <span>Meta: R$ {colab.metaDiaria.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
