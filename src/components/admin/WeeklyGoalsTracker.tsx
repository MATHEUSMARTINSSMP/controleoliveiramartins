import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, Circle } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";

interface GincanaCollaborator {
    id: string;
    name: string;
    vendidoSemana: number;
    metaSemanal: number;
    superMetaSemanal: number;
    progress: number;
    checkpoint1: boolean;
    checkpointFinal: boolean;
}

export function WeeklyGoalsTracker() {
    const [collaborators, setCollaborators] = useState<GincanaCollaborator[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGincanaProgress();
        const interval = setInterval(fetchGincanaProgress, 30000);
        return () => clearInterval(interval);
    }, []);

    const getCurrentWeekRef = () => {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        return `${String(week).padStart(2, '0')}${year}`;
    };

    const fetchGincanaProgress = async () => {
        try {
            const currentWeek = getCurrentWeekRef();
            const weekRange = {
                start: startOfWeek(new Date(), { weekStartsOn: 1 }),
                end: endOfWeek(new Date(), { weekStartsOn: 1 })
            };

            // Buscar todas as colaboradoras ativas
            const { data: colabsData, error: colabsError } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, store_id")
                .eq("role", "COLABORADORA")
                .eq("is_active", true);

            if (colabsError) throw colabsError;

            if (!colabsData || colabsData.length === 0) {
                setCollaborators([]);
                setLoading(false);
                return;
            }

            // Para cada colaboradora, buscar meta semanal e vendas
            const collaboratorsWithProgress = await Promise.all(
                colabsData.map(async (colab) => {
                    // Buscar meta semanal individual (gincana)
                    const { data: metaData, error: metaError } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .select("meta_valor, super_meta_valor")
                        .eq("colaboradora_id", colab.id)
                        .eq("semana_referencia", currentWeek)
                        .eq("tipo", "SEMANAL")
                        .maybeSingle();

                    if (metaError) {
                        console.error(`[WeeklyGoalsTracker] Erro ao buscar meta para ${colab.name}:`, metaError);
                    }

                    // Buscar vendas da semana
                    const { data: salesData } = await supabase
                        .schema("sistemaretiradas")
                        .from("sales")
                        .select("valor")
                        .eq("colaboradora_id", colab.id)
                        .gte("data_venda", format(weekRange.start, "yyyy-MM-dd'T'00:00:00"))
                        .lte("data_venda", format(weekRange.end, "yyyy-MM-dd'T'23:59:59"));

                    const vendidoSemana = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
                    const metaSemanal = Number(metaData?.meta_valor || 0);
                    const superMetaSemanal = Number(metaData?.super_meta_valor || 0);
                    const progress = metaSemanal > 0 ? (vendidoSemana / metaSemanal) * 100 : 0;

                    // Checkpoint 1: atingiu a meta semanal (100% ou mais)
                    const checkpoint1 = metaSemanal > 0 && vendidoSemana >= metaSemanal;
                    
                    // Checkpoint Final: atingiu a super meta semanal
                    const checkpointFinal = superMetaSemanal > 0 && vendidoSemana >= superMetaSemanal;

                    console.log(`[WeeklyGoalsTracker] ${colab.name}: vendido=${vendidoSemana}, meta=${metaSemanal}, super=${superMetaSemanal}, CP1=${checkpoint1}, Final=${checkpointFinal}`);

                    return {
                        id: colab.id,
                        name: colab.name,
                        vendidoSemana,
                        metaSemanal,
                        superMetaSemanal,
                        progress: Math.min(progress, 100),
                        checkpoint1,
                        checkpointFinal,
                    };
                })
            );

            // Filtrar apenas quem tem meta semanal definida e ordenar por valor vendido (maior primeiro)
            const withGoals = collaboratorsWithProgress
                .filter(c => c.metaSemanal > 0)
                .sort((a, b) => b.vendidoSemana - a.vendidoSemana);

            setCollaborators(withGoals);
        } catch (error) {
            console.error("Error fetching gincana progress:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-primary";
        if (progress >= 80) return "bg-primary/70";
        return "bg-primary/50";
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Gincana Semanal
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

    const checkpoint1Count = collaborators.filter((c) => c.checkpoint1).length;
    const checkpointFinalCount = collaborators.filter((c) => c.checkpointFinal).length;

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5 text-primary" />
                    Gincana Semanal
                    <div className="ml-auto flex gap-1">
                        <Badge variant="outline" className="text-xs">
                            CP1: {checkpoint1Count}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                            Final: {checkpointFinalCount}
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {collaborators.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma colaboradora com gincana semanal ativa
                    </p>
                ) : (
                    <div className="space-y-2">
                        {collaborators.map((colab) => (
                            <div
                                key={colab.id}
                                className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm break-words">{colab.name}</h4>
                                        <p className="text-xs text-muted-foreground">
                                            R$ {colab.vendidoSemana.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R${" "}
                                            {colab.metaSemanal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            {colab.superMetaSemanal > 0 && (
                                                <span className="ml-1 text-primary font-semibold">
                                                    (Super: R$ {colab.superMetaSemanal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {colab.checkpoint1 ? (
                                            <CheckCircle2 className="h-4 w-4 text-primary" title="Checkpoint 1" />
                                        ) : (
                                            <Circle className="h-4 w-4 text-muted-foreground" title="Checkpoint 1" />
                                        )}
                                        {colab.superMetaSemanal > 0 && (
                                            colab.checkpointFinal ? (
                                                <CheckCircle2 className="h-4 w-4 text-primary/70" title="Checkpoint Final" />
                                            ) : (
                                                <Circle className="h-4 w-4 text-muted-foreground" title="Checkpoint Final" />
                                            )
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Progresso</span>
                                        <span className="font-semibold">{colab.progress.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={colab.progress} className={`h-1.5 ${getProgressColor(colab.progress)}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
