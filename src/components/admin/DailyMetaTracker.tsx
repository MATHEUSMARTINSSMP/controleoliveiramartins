import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface DailyCollaborator {
    id: string;
    name: string;
    vendidoHoje: number;
    metaDiariaAjustada: number;
    progress: number;
    status: 'ahead' | 'behind' | 'on-track';
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
            const hoje = new Date();
            const hojeStr = format(hoje, "yyyy-MM-dd");
            const mesAtual = format(hoje, "yyyyMM");
            const diaAtual = hoje.getDate();
            const totalDias = getDaysInMonth(hoje);

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

            // Para cada colaboradora, buscar meta e vendas
            const collaboratorsWithProgress = await Promise.all(
                colabsData.map(async (colab) => {
                    // Buscar meta individual
                    const { data: metaData } = await supabase
                        .from("goals")
                        .select("meta_valor, daily_weights")
                        .eq("colaboradora_id", colab.id)
                        .eq("mes_referencia", mesAtual)
                        .eq("tipo", "INDIVIDUAL")
                        .maybeSingle();

                    // Buscar vendas de hoje
                    const { data: salesToday } = await supabase
                        .from("sales")
                        .select("valor")
                        .eq("colaboradora_id", colab.id)
                        .gte("data_venda", `${hojeStr}T00:00:00`)
                        .lte("data_venda", `${hojeStr}T23:59:59`);

                    // Buscar vendas do mês até ontem para calcular déficit
                    const { data: salesMonth } = await supabase
                        .from("sales")
                        .select("data_venda, valor")
                        .eq("colaboradora_id", colab.id)
                        .gte("data_venda", `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`)
                        .lt("data_venda", `${hojeStr}T00:00:00`);

                    const vendidoHoje = salesToday?.reduce((sum, s) => sum + Number(s.valor || 0), 0) || 0;
                    const metaMensal = Number(metaData?.meta_valor || 0);
                    const dailyWeights = metaData?.daily_weights || {};

                    // Calcular meta diária padrão
                    let metaDiariaPadrao = metaMensal / totalDias;
                    if (Object.keys(dailyWeights).length > 0) {
                        const hojePeso = dailyWeights[hojeStr] || 0;
                        metaDiariaPadrao = (metaMensal * hojePeso) / 100;
                    }

                    // Calcular déficit
                    const vendidoAteOntem = salesMonth?.reduce((sum, s) => sum + Number(s.valor || 0), 0) || 0;
                    const metaEsperadaAteOntem = Object.keys(dailyWeights).length > 0
                        ? (() => {
                            let soma = 0;
                            for (let dia = 1; dia < diaAtual; dia++) {
                                const dataDia = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
                                const dataStr = format(dataDia, 'yyyy-MM-dd');
                                const peso = dailyWeights[dataStr] || 0;
                                soma += (metaMensal * peso) / 100;
                            }
                            return soma;
                        })()
                        : metaDiariaPadrao * (diaAtual - 1);

                    const deficit = metaEsperadaAteOntem - vendidoAteOntem;
                    const diasRestantes = totalDias - diaAtual;

                    // Calcular meta diária ajustada
                    let metaDiariaAjustada = metaDiariaPadrao;
                    if (diasRestantes > 0 && deficit > 0) {
                        metaDiariaAjustada = metaDiariaPadrao + (deficit / diasRestantes);
                    }

                    const progress = metaDiariaAjustada > 0 ? (vendidoHoje / metaDiariaAjustada) * 100 : 0;

                    let status: 'ahead' | 'behind' | 'on-track' = 'on-track';
                    if (deficit > 0) status = 'behind';
                    else if (deficit < -metaDiariaPadrao * 2) status = 'ahead';

                    totalVendidoHoje += vendidoHoje;
                    totalMetaDiaria += metaDiariaAjustada;

                    return {
                        id: colab.id,
                        name: colab.name,
                        vendidoHoje,
                        metaDiariaAjustada,
                        progress: Math.min(progress, 100),
                        status,
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'ahead':
                return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
            case 'behind':
                return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
            default:
                return <Calendar className="h-3.5 w-3.5 text-blue-600" />;
        }
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
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
                    <Calendar className="h-5 w-5 text-primary" />
                    Meta Diária
                    {abaixoDaMetaCount > 0 && (
                        <Badge variant="destructive" className="ml-auto text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {abaixoDaMetaCount} abaixo de 80%
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Resumo Geral */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Total Vendido Hoje</span>
                        <span className="text-lg font-bold text-green-600">{formatCurrency(totalVendido)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Meta Total do Dia</span>
                        <span className="text-sm font-semibold">{formatCurrency(totalMeta)}</span>
                    </div>
                    <Progress value={progressGeral} className={`h-2 ${getProgressColor(progressGeral)}`} />
                    <div className="text-xs text-right mt-1 font-semibold">{progressGeral.toFixed(0)}%</div>
                </div>

                {/* Lista de Colaboradoras */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {collaborators.map((colab) => (
                        <div
                            key={colab.id}
                            className={`p-2.5 rounded-lg border ${colab.abaixoDaMeta ? 'bg-red-50 border-red-200' : 'bg-muted/50 border-border/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {getStatusIcon(colab.status)}
                                    <span className="text-sm font-medium truncate">{colab.name}</span>
                                </div>
                                <span className="text-xs font-semibold">{colab.progress.toFixed(0)}%</span>
                            </div>
                            <Progress value={colab.progress} className={`h-1.5 ${getProgressColor(colab.progress)}`} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                <span>{formatCurrency(colab.vendidoHoje)}</span>
                                <span>Meta: {formatCurrency(colab.metaDiariaAjustada)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
